"use server";

import { AuditAction, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/rbac";
import { assertChurch, requireChurchContext } from "@/lib/tenant";

const STRUCTURE_ROLES = [Role.OVERSEER, Role.SUPERVISOR, Role.COORDINATOR, Role.HOMECELL_LEADER] as const;
const STRUCTURE_ROLE_ORDER = new Map<Role, number>([
  [Role.OVERSEER, 1],
  [Role.SUPERVISOR, 2],
  [Role.COORDINATOR, 3],
  [Role.HOMECELL_LEADER, 4],
]);

type StructureRole = (typeof STRUCTURE_ROLES)[number];

type ActionResult = {
  success: boolean;
  message: string;
};

const addNodeSchema = z
  .object({
    role: z
      .nativeEnum(Role)
      .refine((role) => STRUCTURE_ROLES.includes(role as StructureRole), { message: "Invalid role." }),
    parentLeaderId: z.string().cuid().optional().or(z.literal("")),
    regionId: z.string().cuid().optional().or(z.literal("")),
    zoneId: z.string().cuid().optional().or(z.literal("")),
    homecellId: z.string().cuid().optional().or(z.literal("")),
    userId: z.string().cuid().optional().or(z.literal("")),
    memberId: z.string().cuid().optional().or(z.literal("")),
  })
  .superRefine((value, ctx) => {
    const userId = value.userId?.trim() || "";
    const memberId = value.memberId?.trim() || "";
    if ((userId && memberId) || (!userId && !memberId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select exactly one source: user or member.",
        path: ["userId"],
      });
    }
  });

const replaceNodeSchema = z
  .object({
    structureLeaderId: z.string().cuid(),
    userId: z.string().cuid().optional().or(z.literal("")),
    memberId: z.string().cuid().optional().or(z.literal("")),
  })
  .superRefine((value, ctx) => {
    const userId = value.userId?.trim() || "";
    const memberId = value.memberId?.trim() || "";
    if ((userId && memberId) || (!userId && !memberId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select exactly one source: user or member.",
        path: ["userId"],
      });
    }
  });

const reparentSchema = z.object({
  structureLeaderId: z.string().cuid(),
  parentLeaderId: z.string().cuid().optional().or(z.literal("")),
});

const deleteNodeSchema = z.object({
  structureLeaderId: z.string().cuid(),
});

function toNullable(value: string | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function forbiddenResult(): ActionResult {
  return { success: false, message: "You are not allowed to manage hierarchy." };
}

type Scope = {
  regionId: string | null;
  zoneId: string | null;
  homecellId: string | null;
};

async function resolveScope(churchId: string, input: Scope) {
  const homecellId = input.homecellId;
  const zoneId = input.zoneId;
  const regionId = input.regionId;

  const count = Number(Boolean(homecellId)) + Number(Boolean(zoneId)) + Number(Boolean(regionId));
  if (count < 1) {
    return { error: "Select at least one structure scope." as const };
  }

  if (homecellId) {
    const homecell = await db.homecell.findFirst({
      where: { id: homecellId, churchId },
      select: { id: true, regionId: true, zoneId: true },
    });
    if (!homecell) return { error: "Selected homecell is invalid." as const };
    return {
      scope: {
        regionId: homecell.regionId,
        zoneId: homecell.zoneId,
        homecellId: homecell.id,
      },
    };
  }

  if (zoneId) {
    const zone = await db.zone.findFirst({
      where: { id: zoneId, churchId },
      select: { id: true, regionId: true },
    });
    if (!zone) return { error: "Selected zone is invalid." as const };
    return {
      scope: {
        regionId: zone.regionId,
        zoneId: zone.id,
        homecellId: null,
      },
    };
  }

  const region = await db.region.findFirst({
    where: { id: regionId ?? "", churchId },
    select: { id: true },
  });
  if (!region) return { error: "Selected region is invalid." as const };
  return {
    scope: {
      regionId: region.id,
      zoneId: null,
      homecellId: null,
    },
  };
}

function scopeMatchesParent(input: {
  child: Scope;
  parent: Scope;
}) {
  const { child, parent } = input;

  if (child.homecellId) {
    if (parent.homecellId === child.homecellId) return true;
    if (child.zoneId && parent.zoneId === child.zoneId && !parent.homecellId) return true;
    if (child.regionId && parent.regionId === child.regionId && !parent.zoneId && !parent.homecellId) return true;
    return false;
  }

  if (child.zoneId) {
    if (parent.zoneId === child.zoneId && !parent.homecellId) return true;
    if (child.regionId && parent.regionId === child.regionId && !parent.zoneId && !parent.homecellId) return true;
    return false;
  }

  if (child.regionId) {
    return parent.regionId === child.regionId && !parent.zoneId && !parent.homecellId;
  }

  return false;
}

async function resolveAssigneeUser(params: {
  churchId: string;
  role: StructureRole;
  userId: string | null;
  memberId: string | null;
}) {
  const { churchId, role, userId, memberId } = params;

  if (userId) {
    const user = await db.user.findFirst({
      where: { id: userId, churchId, isActive: true },
      select: { id: true, role: true },
    });
    if (!user) return { error: "Selected user is invalid." as const };

    if (user.role !== role) {
      await db.user.update({
        where: { id: user.id },
        data: { role },
      });
    }
    return { userId: user.id };
  }

  const member = await db.member.findFirst({
    where: { id: memberId ?? "", churchId, isDeleted: false },
    select: { id: true, firstName: true, lastName: true, email: true },
  });
  if (!member) return { error: "Selected member is invalid." as const };

  const generatedEmail = `member.${member.id.slice(-10)}@churchflow.local`;
  const memberEmail = (member.email?.trim().toLowerCase() || generatedEmail).toLowerCase();

  const existingUser = await db.user.findUnique({
    where: { email: memberEmail },
    select: { id: true, churchId: true },
  });

  if (existingUser && existingUser.churchId && existingUser.churchId !== churchId) {
    return { error: "Member email is linked to another church user." as const };
  }

  if (existingUser) {
    await db.user.update({
      where: { id: existingUser.id },
      data: { churchId, role, isActive: true },
    });
    return { userId: existingUser.id };
  }

  const passwordHash = await bcrypt.hash("Password123!", 12);
  const createdUser = await db.user.create({
    data: {
      name: `${member.firstName} ${member.lastName}`.trim(),
      email: memberEmail,
      passwordHash,
      role,
      churchId,
      isActive: true,
    },
    select: { id: true },
  });

  return {
    userId: createdUser.id,
    createdFromMember: true,
    createdEmail: memberEmail,
  };
}

async function validateParent(params: {
  churchId: string;
  role: StructureRole;
  scope: Scope;
  parentLeaderId: string | null;
}) {
  const { churchId, role, scope, parentLeaderId } = params;
  if (!parentLeaderId) {
    if (role !== Role.OVERSEER) {
      return { error: "Parent leader is required for non-overseer roles." as const };
    }
    return { parent: null };
  }

  const parent = await db.structureLeader.findFirst({
    where: { id: parentLeaderId, churchId },
    select: {
      id: true,
      role: true,
      regionId: true,
      zoneId: true,
      homecellId: true,
    },
  });
  if (!parent) return { error: "Parent leader not found." as const };

  const childRank = STRUCTURE_ROLE_ORDER.get(role);
  const parentRank = STRUCTURE_ROLE_ORDER.get(parent.role);
  if (!childRank || !parentRank || childRank <= parentRank) {
    return { error: "Parent role must be above child role." as const };
  }

  const sameBranch = scopeMatchesParent({
    child: scope,
    parent: {
      regionId: parent.regionId,
      zoneId: parent.zoneId,
      homecellId: parent.homecellId,
    },
  });
  if (!sameBranch) {
    return { error: "Parent leader must be in the same structure branch." as const };
  }

  return { parent };
}

export async function addHierarchyNodeAction(formData: FormData): Promise<ActionResult> {
  const context = await requireChurchContext();
  if (!hasPermission(context.role, "members:manage")) {
    return forbiddenResult();
  }
  const churchId = assertChurch(context.churchId);

  const parsed = addNodeSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { success: false, message: "Invalid hierarchy payload." };
  }

  const role = parsed.data.role as StructureRole;
  const inputScope: Scope = {
    regionId: toNullable(parsed.data.regionId ?? ""),
    zoneId: toNullable(parsed.data.zoneId ?? ""),
    homecellId: toNullable(parsed.data.homecellId ?? ""),
  };

  if (role === Role.HOMECELL_LEADER && !inputScope.homecellId) {
    return { success: false, message: "Homecell leader must be assigned to a homecell." };
  }
  if (role !== Role.HOMECELL_LEADER) {
    inputScope.homecellId = null;
  }

  const scopeResult = await resolveScope(churchId, inputScope);
  if ("error" in scopeResult) {
    return { success: false, message: scopeResult.error ?? "Invalid structure scope." };
  }

  const parentLeaderId = toNullable(parsed.data.parentLeaderId ?? "");
  const parentResult = await validateParent({
    churchId,
    role,
    scope: scopeResult.scope,
    parentLeaderId,
  });
  if ("error" in parentResult) {
    return { success: false, message: parentResult.error ?? "Invalid parent selection." };
  }

  const assigneeResult = await resolveAssigneeUser({
    churchId,
    role,
    userId: toNullable(parsed.data.userId ?? ""),
    memberId: toNullable(parsed.data.memberId ?? ""),
  });
  if ("error" in assigneeResult) {
    return { success: false, message: assigneeResult.error ?? "Invalid assignee." };
  }

  const duplicate = await db.structureLeader.findFirst({
    where: {
      churchId,
      userId: assigneeResult.userId,
      role,
      regionId: scopeResult.scope.regionId,
      zoneId: scopeResult.scope.zoneId,
      homecellId: scopeResult.scope.homecellId,
    },
    select: { id: true },
  });
  if (duplicate) {
    return { success: false, message: "This leader is already assigned in this structure scope." };
  }

  try {
    const created = await db.structureLeader.create({
      data: {
        churchId,
        userId: assigneeResult.userId,
        role,
        regionId: scopeResult.scope.regionId,
        zoneId: scopeResult.scope.zoneId,
        homecellId: scopeResult.scope.homecellId,
        parentLeaderId,
      },
      select: { id: true },
    });

    await logAudit({
      churchId,
      actorUserId: context.userId,
      actorRole: context.role,
      action: AuditAction.CREATE,
      entity: "HierarchyNode",
      entityId: created.id,
      payload: {
        role,
        regionId: scopeResult.scope.regionId,
        zoneId: scopeResult.scope.zoneId,
        homecellId: scopeResult.scope.homecellId,
        parentLeaderId,
      },
    });

    revalidatePath("/dashboard/hierarchy");
    revalidatePath("/dashboard/admin/churches");

    if (assigneeResult.createdFromMember) {
      return {
        success: true,
        message: `Node added. Member promoted with login ${assigneeResult.createdEmail} (Password123!).`,
      };
    }
    return { success: true, message: "Hierarchy node added." };
  } catch {
    return { success: false, message: "Could not add hierarchy node." };
  }
}

export async function replaceHierarchyLeaderAction(formData: FormData): Promise<ActionResult> {
  const context = await requireChurchContext();
  if (!hasPermission(context.role, "members:manage")) {
    return forbiddenResult();
  }
  const churchId = assertChurch(context.churchId);

  const parsed = replaceNodeSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { success: false, message: "Invalid replacement payload." };
  }

  const node = await db.structureLeader.findFirst({
    where: { id: parsed.data.structureLeaderId, churchId },
    select: {
      id: true,
      role: true,
      regionId: true,
      zoneId: true,
      homecellId: true,
      userId: true,
    },
  });
  if (!node) {
    return { success: false, message: "Node not found." };
  }

  const assigneeResult = await resolveAssigneeUser({
    churchId,
    role: node.role as StructureRole,
    userId: toNullable(parsed.data.userId ?? ""),
    memberId: toNullable(parsed.data.memberId ?? ""),
  });
  if ("error" in assigneeResult) {
    return { success: false, message: assigneeResult.error ?? "Invalid assignee." };
  }

  const duplicate = await db.structureLeader.findFirst({
    where: {
      churchId,
      userId: assigneeResult.userId,
      role: node.role,
      regionId: node.regionId,
      zoneId: node.zoneId,
      homecellId: node.homecellId,
      NOT: { id: node.id },
    },
    select: { id: true },
  });
  if (duplicate) {
    return { success: false, message: "That leader already exists in this structure scope." };
  }

  await db.structureLeader.update({
    where: { id: node.id },
    data: { userId: assigneeResult.userId },
  });

  await logAudit({
    churchId,
    actorUserId: context.userId,
    actorRole: context.role,
    action: AuditAction.UPDATE,
    entity: "HierarchyNode",
    entityId: node.id,
    payload: {
      fromUserId: node.userId,
      toUserId: assigneeResult.userId,
    },
  });

  revalidatePath("/dashboard/hierarchy");
  revalidatePath("/dashboard/admin/churches");

  if (assigneeResult.createdFromMember) {
    return {
      success: true,
      message: `Leader replaced. Member promoted with login ${assigneeResult.createdEmail} (Password123!).`,
    };
  }
  return { success: true, message: "Leader replaced successfully." };
}

export async function reparentHierarchyNodeAction(formData: FormData): Promise<ActionResult> {
  const context = await requireChurchContext();
  if (!hasPermission(context.role, "members:manage")) {
    return forbiddenResult();
  }
  const churchId = assertChurch(context.churchId);

  const parsed = reparentSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { success: false, message: "Invalid re-parent payload." };
  }

  const node = await db.structureLeader.findFirst({
    where: { id: parsed.data.structureLeaderId, churchId },
    select: {
      id: true,
      role: true,
      parentLeaderId: true,
      regionId: true,
      zoneId: true,
      homecellId: true,
    },
  });
  if (!node) return { success: false, message: "Node not found." };

  const nextParentId = toNullable(parsed.data.parentLeaderId ?? "");
  if (node.role === Role.OVERSEER && nextParentId) {
    return { success: false, message: "Overseer nodes cannot have a parent." };
  }
  if (node.role !== Role.OVERSEER && !nextParentId) {
    return { success: false, message: "Parent is required for this node." };
  }

  if (nextParentId) {
    let cursor: string | null = nextParentId;
    while (cursor) {
      if (cursor === node.id) {
        return { success: false, message: "Invalid re-parent: cycle detected." };
      }
      const currentParent: { parentLeaderId: string | null } | null = await db.structureLeader.findFirst({
        where: { id: cursor, churchId },
        select: { parentLeaderId: true },
      });
      cursor = currentParent?.parentLeaderId ?? null;
    }
  }

  const parentValidation = await validateParent({
    churchId,
    role: node.role as StructureRole,
    scope: {
      regionId: node.regionId,
      zoneId: node.zoneId,
      homecellId: node.homecellId,
    },
    parentLeaderId: nextParentId,
  });
  if ("error" in parentValidation) {
    return { success: false, message: parentValidation.error ?? "Invalid parent selection." };
  }

  await db.structureLeader.update({
    where: { id: node.id },
    data: {
      parentLeaderId: nextParentId,
    },
  });

  await logAudit({
    churchId,
    actorUserId: context.userId,
    actorRole: context.role,
    action: AuditAction.UPDATE,
    entity: "HierarchyNode",
    entityId: node.id,
    payload: {
      fromParentLeaderId: node.parentLeaderId,
      toParentLeaderId: nextParentId,
    },
  });

  revalidatePath("/dashboard/hierarchy");
  revalidatePath("/dashboard/admin/churches");
  return { success: true, message: "Hierarchy node updated." };
}

export async function deleteHierarchyNodeAction(formData: FormData): Promise<ActionResult> {
  const context = await requireChurchContext();
  if (!hasPermission(context.role, "members:manage")) {
    return forbiddenResult();
  }
  const churchId = assertChurch(context.churchId);

  const parsed = deleteNodeSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { success: false, message: "Invalid delete payload." };
  }

  const node = await db.structureLeader.findFirst({
    where: { id: parsed.data.structureLeaderId, churchId },
    select: { id: true, parentLeaderId: true },
  });
  if (!node) {
    return { success: false, message: "Node not found." };
  }

  await db.$transaction([
    db.structureLeader.updateMany({
      where: { churchId, parentLeaderId: node.id },
      data: { parentLeaderId: node.parentLeaderId },
    }),
    db.structureLeader.delete({
      where: { id: node.id },
    }),
  ]);

  await logAudit({
    churchId,
    actorUserId: context.userId,
    actorRole: context.role,
    action: AuditAction.DELETE,
    entity: "HierarchyNode",
    entityId: node.id,
    payload: { parentLeaderId: node.parentLeaderId },
  });

  revalidatePath("/dashboard/hierarchy");
  revalidatePath("/dashboard/admin/churches");
  return { success: true, message: "Hierarchy node deleted." };
}
