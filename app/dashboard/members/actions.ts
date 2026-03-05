"use server";

import { AuditAction } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { hasPermission } from "@/lib/rbac";
import { assertChurch, requireChurchContext } from "@/lib/tenant";
import { memberNoteSchema, memberSchema } from "@/lib/validations/member";
import { logAudit } from "@/lib/audit";
import { resolveMemberScope } from "@/lib/member-scope";

function nullableValue(value?: string) {
  if (!value || value.trim().length === 0) return null;
  return value;
}

function scopedHomecellIds(input: { isFullAccess: boolean; homecellIds: string[] }) {
  return input.isFullAccess ? [] : input.homecellIds.length > 0 ? input.homecellIds : ["__no_scope__"];
}

type MemberActionResult = { success: boolean; message: string; memberId?: string };

export async function createMemberAction(formData: FormData): Promise<MemberActionResult> {
  const context = await requireChurchContext();
  if (!hasPermission(context.role, "members:manage")) {
    return { success: false, message: "You are not allowed to create members." };
  }

  const churchId = assertChurch(context.churchId);
  const scope = await resolveMemberScope({
    churchId,
    userId: context.userId,
    role: context.role,
  });
  const parsed = memberSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { success: false, message: "Please correct the member form fields." };
  }

  const data = parsed.data;
  const targetHomecellId = nullableValue(data.homecellId);

  if (!scope.isFullAccess) {
    if (!targetHomecellId || !scope.homecellIds.includes(targetHomecellId)) {
      return { success: false, message: "Select a homecell inside your assigned structure scope." };
    }
  }

  const member = await db.member.create({
    data: {
      churchId,
      firstName: data.firstName,
      lastName: data.lastName,
      gender: data.gender,
      dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
      phone: nullableValue(data.phone),
      email: nullableValue(data.email),
      address: nullableValue(data.address),
      maritalStatus: data.maritalStatus ? data.maritalStatus : null,
      occupation: nullableValue(data.occupation),
      dateJoined: new Date(data.dateJoined),
      salvationStatus: data.salvationStatus,
      baptismStatus: data.baptismStatus,
      holySpiritBaptismStatus: data.holySpiritBaptismStatus,
      jimJohn316Status: data.jimJohn316Status,
      jimSgtStatus: data.jimSgtStatus,
      jimDiscStatus: data.jimDiscStatus,
      jimNltStatus: data.jimNltStatus,
      involvementNotes: nullableValue(data.involvementNotes),
      membershipStatus: data.membershipStatus,
      departmentId: nullableValue(data.departmentId),
      homecellId: targetHomecellId,
      emergencyContactName: nullableValue(data.emergencyContactName),
      emergencyContactPhone: nullableValue(data.emergencyContactPhone),
      profilePhotoUrl: nullableValue(data.profilePhotoUrl),
    },
  });

  await logAudit({
    churchId,
    actorUserId: context.userId,
    actorRole: context.role,
    action: AuditAction.CREATE,
    entity: "Member",
    entityId: member.id,
  });

  revalidatePath("/dashboard/members");
  return { success: true, message: "Member created successfully.", memberId: member.id };
}

export async function updateMemberAction(
  memberId: string,
  formData: FormData,
): Promise<MemberActionResult> {
  const context = await requireChurchContext();
  if (!hasPermission(context.role, "members:manage")) {
    return { success: false, message: "You are not allowed to edit members." };
  }

  const churchId = assertChurch(context.churchId);
  const scope = await resolveMemberScope({
    churchId,
    userId: context.userId,
    role: context.role,
  });
  const scopeHomecellIds = scopedHomecellIds(scope);
  const scopedMember = await db.member.findFirst({
    where: {
      id: memberId,
      churchId,
      isDeleted: false,
      ...(scope.isFullAccess ? {} : { homecellId: { in: scopeHomecellIds } }),
    },
    select: { id: true },
  });
  if (!scopedMember) {
    return { success: false, message: "Member not found in your structure scope." };
  }

  const parsed = memberSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { success: false, message: "Please correct the member form fields." };
  }

  const data = parsed.data;
  const targetHomecellId = nullableValue(data.homecellId);
  if (!scope.isFullAccess) {
    if (!targetHomecellId || !scope.homecellIds.includes(targetHomecellId)) {
      return { success: false, message: "Select a homecell inside your assigned structure scope." };
    }
  }

  await db.member.update({
    where: { id: memberId, churchId },
    data: {
      firstName: data.firstName,
      lastName: data.lastName,
      gender: data.gender,
      dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
      phone: nullableValue(data.phone),
      email: nullableValue(data.email),
      address: nullableValue(data.address),
      maritalStatus: data.maritalStatus ? data.maritalStatus : null,
      occupation: nullableValue(data.occupation),
      dateJoined: new Date(data.dateJoined),
      salvationStatus: data.salvationStatus,
      baptismStatus: data.baptismStatus,
      holySpiritBaptismStatus: data.holySpiritBaptismStatus,
      jimJohn316Status: data.jimJohn316Status,
      jimSgtStatus: data.jimSgtStatus,
      jimDiscStatus: data.jimDiscStatus,
      jimNltStatus: data.jimNltStatus,
      involvementNotes: nullableValue(data.involvementNotes),
      membershipStatus: data.membershipStatus,
      departmentId: nullableValue(data.departmentId),
      homecellId: targetHomecellId,
      emergencyContactName: nullableValue(data.emergencyContactName),
      emergencyContactPhone: nullableValue(data.emergencyContactPhone),
      profilePhotoUrl: nullableValue(data.profilePhotoUrl),
    },
  });

  await logAudit({
    churchId,
    actorUserId: context.userId,
    actorRole: context.role,
    action: AuditAction.UPDATE,
    entity: "Member",
    entityId: memberId,
  });

  revalidatePath("/dashboard/members");
  revalidatePath(`/dashboard/members/${memberId}`);
  return { success: true, message: "Member updated successfully." };
}

export async function softDeleteMemberAction(memberId: string): Promise<MemberActionResult> {
  const context = await requireChurchContext();
  if (!hasPermission(context.role, "members:manage")) {
    return { success: false, message: "You are not allowed to archive members." };
  }

  const churchId = assertChurch(context.churchId);
  const scope = await resolveMemberScope({
    churchId,
    userId: context.userId,
    role: context.role,
  });
  const scopeHomecellIds = scopedHomecellIds(scope);
  const scopedMember = await db.member.findFirst({
    where: {
      id: memberId,
      churchId,
      isDeleted: false,
      ...(scope.isFullAccess ? {} : { homecellId: { in: scopeHomecellIds } }),
    },
    select: { id: true },
  });
  if (!scopedMember) {
    return { success: false, message: "Member not found in your structure scope." };
  }

  await db.member.update({
    where: { id: memberId, churchId },
    data: {
      isDeleted: true,
      deletedAt: new Date(),
      membershipStatus: "INACTIVE",
    },
  });

  await logAudit({
    churchId,
    actorUserId: context.userId,
    actorRole: context.role,
    action: AuditAction.DELETE,
    entity: "Member",
    entityId: memberId,
  });

  revalidatePath("/dashboard/members");
  return { success: true, message: "Member archived." };
}

export async function addMemberNoteAction(formData: FormData): Promise<MemberActionResult> {
  const context = await requireChurchContext();
  if (!hasPermission(context.role, "members:notes")) {
    return { success: false, message: "Only authorized roles can add pastoral notes." };
  }

  const churchId = assertChurch(context.churchId);
  const scope = await resolveMemberScope({
    churchId,
    userId: context.userId,
    role: context.role,
  });
  const scopeHomecellIds = scopedHomecellIds(scope);
  const parsed = memberNoteSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { success: false, message: "Invalid note content." };
  }

  const scopedMember = await db.member.findFirst({
    where: {
      id: parsed.data.memberId,
      churchId,
      isDeleted: false,
      ...(scope.isFullAccess ? {} : { homecellId: { in: scopeHomecellIds } }),
    },
    select: { id: true },
  });
  if (!scopedMember) {
    return { success: false, message: "Member not found in your structure scope." };
  }

  await db.memberNote.create({
    data: {
      churchId,
      memberId: parsed.data.memberId,
      authorId: context.userId,
      content: parsed.data.content,
    },
  });

  revalidatePath(`/dashboard/members/${parsed.data.memberId}`);
  return { success: true, message: "Pastoral note saved." };
}
