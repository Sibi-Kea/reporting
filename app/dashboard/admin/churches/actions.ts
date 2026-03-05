"use server";

import { AuditAction, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { canCreateAttendanceService } from "@/lib/attendance-scope";
import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/rbac";
import { assertChurch, requireChurchContext } from "@/lib/tenant";
import { churchSchema, churchServiceGroupsSchema, churchServiceLabelsSchema } from "@/lib/validations/church";

const regionSchema = z.object({
  name: z.string().trim().min(2).max(120),
  leaderId: z.string().cuid().optional().or(z.literal("")),
});

const zoneSchema = z.object({
  name: z.string().trim().min(2).max(120),
  regionId: z.string().cuid().optional().or(z.literal("")),
  leaderId: z.string().cuid().optional().or(z.literal("")),
});

const homecellSchema = z.object({
  name: z.string().trim().min(2).max(120),
  regionId: z.string().cuid().optional().or(z.literal("")),
  zoneId: z.string().cuid().optional().or(z.literal("")),
  leaderId: z.string().cuid().optional().or(z.literal("")),
  meetingDay: z.string().trim().max(30).optional().or(z.literal("")),
  meetingTime: z.string().trim().max(30).optional().or(z.literal("")),
});

const memberStructureSchema = z.object({
  memberId: z.string().cuid(),
  regionId: z.string().cuid().optional().or(z.literal("")),
  zoneId: z.string().cuid().optional().or(z.literal("")),
  homecellId: z.string().cuid().optional().or(z.literal("")),
});

const STRUCTURE_ASSIGNABLE_ROLES = [
  Role.OVERSEER,
  Role.SUPERVISOR,
  Role.COORDINATOR,
  Role.HOMECELL_LEADER,
] as const;

const structureLeaderSchema = z.object({
  userId: z.string().cuid(),
  role: z
    .nativeEnum(Role)
    .refine(
      (role) => STRUCTURE_ASSIGNABLE_ROLES.includes(role as (typeof STRUCTURE_ASSIGNABLE_ROLES)[number]),
      { message: "Invalid structure role." },
    ),
  regionId: z.string().cuid().optional().or(z.literal("")),
  zoneId: z.string().cuid().optional().or(z.literal("")),
  homecellId: z.string().cuid().optional().or(z.literal("")),
  parentLeaderId: z.string().cuid().optional().or(z.literal("")),
});

type ActionResult = {
  success: boolean;
  message: string;
};

function toNullable(value: string | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function forbiddenResult() {
  return {
    success: false,
    message: "You are not allowed to manage structures.",
  };
}

function parseServiceLabelsText(raw: string) {
  const labels = raw
    .split(/\r?\n|,/)
    .map((value) => value.trim())
    .filter(Boolean);
  return Array.from(new Set(labels));
}

export async function createChurchAction(formData: FormData): Promise<ActionResult> {
  const context = await requireChurchContext();
  if (!hasPermission(context.role, "church:create")) {
    return { success: false, message: "You are not allowed to create churches." };
  }

  const parsed = churchSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    slug: String(formData.get("slug") ?? ""),
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    address: String(formData.get("address") ?? ""),
    pastorUserId: "",
  });
  if (!parsed.success) {
    return { success: false, message: "Church details are invalid." };
  }

  try {
    const church = await db.church.create({
      data: {
        name: parsed.data.name,
        slug: parsed.data.slug,
        email: toNullable(parsed.data.email),
        phone: toNullable(parsed.data.phone),
        address: toNullable(parsed.data.address),
        createdById: context.userId,
      },
    });

    await logAudit({
      churchId: church.id,
      actorUserId: context.userId,
      actorRole: context.role,
      action: AuditAction.CREATE,
      entity: "Church",
      entityId: church.id,
    });

    revalidatePath("/dashboard/admin/churches");
    revalidatePath("/dashboard/settings");
    return { success: true, message: "Church created." };
  } catch {
    return { success: false, message: "Church name or slug already exists." };
  }
}

export async function updateChurchServiceLabelsAction(formData: FormData): Promise<ActionResult> {
  const context = await requireChurchContext();
  const canManageServiceLabels =
    hasPermission(context.role, "attendance:manage") && canCreateAttendanceService(context.role);
  if (!canManageServiceLabels) {
    return { success: false, message: "You are not allowed to manage church services." };
  }

  const fallbackChurchId = assertChurch(context.churchId);
  const requestedChurchId = String(formData.get("churchId") ?? fallbackChurchId);
  const targetChurchId = hasPermission(context.role, "church:create")
    ? requestedChurchId
    : fallbackChurchId;
  const morningRaw = String(formData.get("morningLabelsText") ?? "");
  const eveningRaw = String(formData.get("eveningLabelsText") ?? "");
  const onlineRaw = String(formData.get("onlineLabelsText") ?? "");
  const hasGroupedPayload = Boolean(morningRaw || eveningRaw || onlineRaw);
  const labelsRaw = String(formData.get("labelsText") ?? "");

  if (hasGroupedPayload) {
    const parsed = churchServiceGroupsSchema.safeParse({
      churchId: targetChurchId,
      morningLabels: parseServiceLabelsText(morningRaw),
      eveningLabels: parseServiceLabelsText(eveningRaw),
      onlineLabels: parseServiceLabelsText(onlineRaw),
    });
    if (!parsed.success) {
      return {
        success: false,
        message: "Provide at least one morning/evening/online label (2-120 chars), max 20 per group.",
      };
    }

    const targetChurch = await db.church.findUnique({
      where: { id: parsed.data.churchId },
      select: { id: true },
    });
    if (!targetChurch) {
      return { success: false, message: "Selected church is invalid." };
    }

    await db.church.update({
      where: { id: targetChurchId },
      data: {
        attendanceMorningServiceLabels: parsed.data.morningLabels,
        attendanceEveningServiceLabels: parsed.data.eveningLabels,
        attendanceOnlineServiceLabels: parsed.data.onlineLabels,
        attendanceServiceLabels: Array.from(
          new Set([
            ...parsed.data.morningLabels,
            ...parsed.data.eveningLabels,
            ...parsed.data.onlineLabels,
          ]),
        ),
      },
    });

    await logAudit({
      churchId: targetChurchId,
      actorUserId: context.userId,
      actorRole: context.role,
      action: AuditAction.UPDATE,
      entity: "ChurchAttendanceServiceLabels",
      entityId: targetChurchId,
      payload: {
        morningLabels: parsed.data.morningLabels,
        eveningLabels: parsed.data.eveningLabels,
        onlineLabels: parsed.data.onlineLabels,
      },
    });
  } else {
    const parsed = churchServiceLabelsSchema.safeParse({
      churchId: targetChurchId,
      labels: parseServiceLabelsText(labelsRaw),
    });
    if (!parsed.success) {
      return {
        success: false,
        message: "Provide at least one service label (2-120 chars), maximum 20.",
      };
    }

    const targetChurch = await db.church.findUnique({
      where: { id: parsed.data.churchId },
      select: { id: true },
    });
    if (!targetChurch) {
      return { success: false, message: "Selected church is invalid." };
    }

    await db.church.update({
      where: { id: targetChurchId },
      data: {
        attendanceServiceLabels: parsed.data.labels,
      },
    });

    await logAudit({
      churchId: targetChurchId,
      actorUserId: context.userId,
      actorRole: context.role,
      action: AuditAction.UPDATE,
      entity: "ChurchAttendanceServiceLabels",
      entityId: targetChurchId,
      payload: { labels: parsed.data.labels },
    });
  }

  revalidatePath("/dashboard/admin/churches");
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/attendance");
  return { success: true, message: "Church attendance services updated." };
}

function scopeMatchesParent(input: {
  regionId: string | null;
  zoneId: string | null;
  homecellId: string | null;
  parentRegionId: string | null;
  parentZoneId: string | null;
  parentHomecellId: string | null;
}) {
  const {
    regionId,
    zoneId,
    homecellId,
    parentRegionId,
    parentZoneId,
    parentHomecellId,
  } = input;

  if (homecellId) {
    if (parentHomecellId === homecellId) return true;
    if (zoneId && parentZoneId === zoneId && !parentHomecellId) return true;
    if (regionId && parentRegionId === regionId && !parentZoneId && !parentHomecellId) return true;
    return false;
  }

  if (zoneId) {
    if (parentZoneId === zoneId && !parentHomecellId) return true;
    if (regionId && parentRegionId === regionId && !parentZoneId && !parentHomecellId) return true;
    return false;
  }

  if (regionId) {
    return parentRegionId === regionId && !parentZoneId && !parentHomecellId;
  }

  return false;
}

export async function createRegionAction(formData: FormData): Promise<ActionResult> {
  const context = await requireChurchContext();
  if (!hasPermission(context.role, "members:manage")) {
    return forbiddenResult();
  }
  const churchId = assertChurch(context.churchId);

  const parsed = regionSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { success: false, message: "Region details are invalid." };
  }

  try {
    const region = await db.region.create({
      data: {
        churchId,
        name: parsed.data.name,
        leaderId: toNullable(parsed.data.leaderId ?? ""),
      },
    });

    await logAudit({
      churchId,
      actorUserId: context.userId,
      actorRole: context.role,
      action: AuditAction.CREATE,
      entity: "Region",
      entityId: region.id,
    });

    revalidatePath("/dashboard/admin/churches");
    revalidatePath("/dashboard/hierarchy");
    return { success: true, message: "Region created." };
  } catch {
    return { success: false, message: "Region already exists or leader is already assigned." };
  }
}

export async function createZoneAction(formData: FormData): Promise<ActionResult> {
  const context = await requireChurchContext();
  if (!hasPermission(context.role, "members:manage")) {
    return forbiddenResult();
  }
  const churchId = assertChurch(context.churchId);

  const parsed = zoneSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { success: false, message: "Zone details are invalid." };
  }

  const regionId = toNullable(parsed.data.regionId ?? "");
  if (regionId) {
    const region = await db.region.findFirst({
      where: { id: regionId, churchId },
      select: { id: true },
    });
    if (!region) {
      return { success: false, message: "Selected region is invalid." };
    }
  }

  try {
    const zone = await db.zone.create({
      data: {
        churchId,
        name: parsed.data.name,
        regionId,
        leaderId: toNullable(parsed.data.leaderId ?? ""),
      },
    });

    await logAudit({
      churchId,
      actorUserId: context.userId,
      actorRole: context.role,
      action: AuditAction.CREATE,
      entity: "Zone",
      entityId: zone.id,
    });

    revalidatePath("/dashboard/admin/churches");
    revalidatePath("/dashboard/hierarchy");
    return { success: true, message: "Zone created." };
  } catch {
    return { success: false, message: "Zone already exists or leader is already assigned." };
  }
}

export async function createHomecellAction(formData: FormData): Promise<ActionResult> {
  const context = await requireChurchContext();
  if (!hasPermission(context.role, "members:manage")) {
    return forbiddenResult();
  }
  const churchId = assertChurch(context.churchId);

  const parsed = homecellSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { success: false, message: "Homecell details are invalid." };
  }

  const zoneId = toNullable(parsed.data.zoneId ?? "");
  const regionIdInput = toNullable(parsed.data.regionId ?? "");
  const zone = zoneId
    ? await db.zone.findFirst({
        where: { id: zoneId, churchId },
        select: { id: true, regionId: true },
      })
    : null;

  if (zoneId && !zone) {
    return { success: false, message: "Selected zone is invalid." };
  }

  const regionId = zone?.regionId ?? regionIdInput;
  if (regionId) {
    const region = await db.region.findFirst({
      where: { id: regionId, churchId },
      select: { id: true },
    });
    if (!region) {
      return { success: false, message: "Selected region is invalid." };
    }
  }

  try {
    const homecell = await db.homecell.create({
      data: {
        churchId,
        name: parsed.data.name,
        regionId,
        zoneId: zone?.id ?? zoneId,
        leaderId: toNullable(parsed.data.leaderId ?? ""),
        meetingDay: toNullable(parsed.data.meetingDay ?? ""),
        meetingTime: toNullable(parsed.data.meetingTime ?? ""),
      },
    });

    await logAudit({
      churchId,
      actorUserId: context.userId,
      actorRole: context.role,
      action: AuditAction.CREATE,
      entity: "Homecell",
      entityId: homecell.id,
    });

    revalidatePath("/dashboard/admin/churches");
    revalidatePath("/dashboard/hierarchy");
    revalidatePath("/dashboard/members");
    return { success: true, message: "Homecell created." };
  } catch {
    return { success: false, message: "Homecell already exists or leader is already assigned." };
  }
}

export async function assignMemberStructureAction(formData: FormData): Promise<ActionResult> {
  const context = await requireChurchContext();
  if (!hasPermission(context.role, "members:manage")) {
    return forbiddenResult();
  }
  const churchId = assertChurch(context.churchId);

  const parsed = memberStructureSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { success: false, message: "Invalid assignment payload." };
  }

  const member = await db.member.findFirst({
    where: { id: parsed.data.memberId, churchId, isDeleted: false },
    select: { id: true },
  });
  if (!member) {
    return { success: false, message: "Member not found." };
  }

  const zoneIdInput = toNullable(parsed.data.zoneId ?? "");
  const homecellIdInput = toNullable(parsed.data.homecellId ?? "");
  const regionIdInput = toNullable(parsed.data.regionId ?? "");

  const zone = zoneIdInput
    ? await db.zone.findFirst({
        where: { id: zoneIdInput, churchId },
        select: { id: true, regionId: true },
      })
    : null;
  if (zoneIdInput && !zone) {
    return { success: false, message: "Selected zone is invalid." };
  }

  const homecell = homecellIdInput
    ? await db.homecell.findFirst({
        where: { id: homecellIdInput, churchId },
        select: { id: true, zoneId: true, regionId: true },
      })
    : null;
  if (homecellIdInput && !homecell) {
    return { success: false, message: "Selected homecell is invalid." };
  }

  const resolvedZoneId = homecell?.zoneId ?? zone?.id ?? zoneIdInput;
  const resolvedRegionId = homecell?.regionId ?? zone?.regionId ?? regionIdInput;

  await db.member.update({
    where: { id: parsed.data.memberId, churchId },
    data: {
      regionId: resolvedRegionId,
      zoneId: resolvedZoneId,
      homecellId: homecell?.id ?? homecellIdInput,
    },
  });

  await logAudit({
    churchId,
    actorUserId: context.userId,
    actorRole: context.role,
    action: AuditAction.UPDATE,
    entity: "MemberStructure",
    entityId: parsed.data.memberId,
    payload: {
      regionId: resolvedRegionId,
      zoneId: resolvedZoneId,
      homecellId: homecell?.id ?? homecellIdInput,
    },
  });

  revalidatePath("/dashboard/admin/churches");
  revalidatePath("/dashboard/members");
  revalidatePath("/dashboard/hierarchy");
  return { success: true, message: "Member assigned to structure." };
}

export async function assignStructureLeaderAction(formData: FormData): Promise<ActionResult> {
  const context = await requireChurchContext();
  if (!hasPermission(context.role, "members:manage")) {
    return forbiddenResult();
  }
  const churchId = assertChurch(context.churchId);

  const parsed = structureLeaderSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { success: false, message: "Invalid structure leadership payload." };
  }

  const roleOrder = new Map<Role, number>([
    [Role.OVERSEER, 1],
    [Role.SUPERVISOR, 2],
    [Role.COORDINATOR, 3],
    [Role.HOMECELL_LEADER, 4],
  ]);

  const homecellIdInput = toNullable(parsed.data.homecellId ?? "");
  const zoneIdInput = toNullable(parsed.data.zoneId ?? "");
  const regionIdInput = toNullable(parsed.data.regionId ?? "");
  const parentLeaderId = toNullable(parsed.data.parentLeaderId ?? "");

  const selectedScopeCount = Number(Boolean(homecellIdInput)) + Number(Boolean(zoneIdInput)) + Number(Boolean(regionIdInput));
  if (selectedScopeCount !== 1) {
    return { success: false, message: "Select exactly one structure scope: region, zone, or homecell." };
  }

  const leaderUser = await db.user.findFirst({
    where: { id: parsed.data.userId, churchId, isActive: true },
    select: { id: true, role: true, name: true },
  });
  if (!leaderUser) {
    return { success: false, message: "Selected leader is invalid." };
  }
  if (leaderUser.role !== parsed.data.role) {
    return {
      success: false,
      message: `Selected user is ${leaderUser.role}, expected ${parsed.data.role}.`,
    };
  }

  let regionId: string | null = null;
  let zoneId: string | null = null;
  let homecellId: string | null = null;

  if (homecellIdInput) {
    const homecell = await db.homecell.findFirst({
      where: { id: homecellIdInput, churchId },
      select: { id: true, zoneId: true, regionId: true },
    });
    if (!homecell) {
      return { success: false, message: "Selected homecell is invalid." };
    }
    homecellId = homecell.id;
    zoneId = homecell.zoneId;
    regionId = homecell.regionId;
  } else if (zoneIdInput) {
    const zone = await db.zone.findFirst({
      where: { id: zoneIdInput, churchId },
      select: { id: true, regionId: true },
    });
    if (!zone) {
      return { success: false, message: "Selected zone is invalid." };
    }
    zoneId = zone.id;
    regionId = zone.regionId;
  } else if (regionIdInput) {
    const region = await db.region.findFirst({
      where: { id: regionIdInput, churchId },
      select: { id: true },
    });
    if (!region) {
      return { success: false, message: "Selected region is invalid." };
    }
    regionId = region.id;
  }

  const duplicate = await db.structureLeader.findFirst({
    where: {
      churchId,
      userId: parsed.data.userId,
      role: parsed.data.role,
      regionId,
      zoneId,
      homecellId,
    },
    select: { id: true },
  });
  if (duplicate) {
    return { success: false, message: "This leader is already assigned at this scope." };
  }

  let parentLeader:
    | {
        id: string;
        role: Role;
        userId: string;
        regionId: string | null;
        zoneId: string | null;
        homecellId: string | null;
      }
    | null = null;

  if (parentLeaderId) {
    parentLeader = await db.structureLeader.findFirst({
      where: { id: parentLeaderId, churchId },
      select: {
        id: true,
        role: true,
        userId: true,
        regionId: true,
        zoneId: true,
        homecellId: true,
      },
    });

    if (!parentLeader) {
      return { success: false, message: "Parent leader not found." };
    }
    if (parentLeader.userId === parsed.data.userId) {
      return { success: false, message: "A leader cannot report to themselves." };
    }
    if (
      !scopeMatchesParent({
        regionId,
        zoneId,
        homecellId,
        parentRegionId: parentLeader.regionId,
        parentZoneId: parentLeader.zoneId,
        parentHomecellId: parentLeader.homecellId,
      })
    ) {
      return { success: false, message: "Parent leader must be in the same structure branch." };
    }
  }

  if (parsed.data.role === Role.OVERSEER && parentLeaderId) {
    return { success: false, message: "Overseer must be the root for a structure branch." };
  }

  if (parsed.data.role !== Role.OVERSEER && !parentLeaderId) {
    return { success: false, message: "Select a parent leader for this assignment." };
  }

  if (parentLeader) {
    const childRank = roleOrder.get(parsed.data.role);
    const parentRank = roleOrder.get(parentLeader.role);
    if (!childRank || !parentRank || childRank <= parentRank) {
      return { success: false, message: "Parent role must be above child role in the hierarchy." };
    }
  }

  try {
    const assignment = await db.structureLeader.create({
      data: {
        churchId,
        userId: parsed.data.userId,
        role: parsed.data.role,
        regionId,
        zoneId,
        homecellId,
        parentLeaderId,
      },
    });

    await logAudit({
      churchId,
      actorUserId: context.userId,
      actorRole: context.role,
      action: AuditAction.CREATE,
      entity: "StructureLeader",
      entityId: assignment.id,
      payload: {
        userId: parsed.data.userId,
        role: parsed.data.role,
        regionId,
        zoneId,
        homecellId,
        parentLeaderId,
      },
    });

    revalidatePath("/dashboard/admin/churches");
    revalidatePath("/dashboard/hierarchy");
    return { success: true, message: "Structure leader assigned." };
  } catch {
    return { success: false, message: "Unable to assign structure leader." };
  }
}
