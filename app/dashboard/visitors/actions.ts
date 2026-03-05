"use server";

import { AuditAction } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/rbac";
import { assertChurch, requireChurchContext } from "@/lib/tenant";
import { visitorSchema } from "@/lib/validations/visitor";

export async function createVisitorAction(formData: FormData) {
  const context = await requireChurchContext();
  if (!hasPermission(context.role, "visitors:manage")) {
    return { success: false, message: "You cannot manage visitors." };
  }

  const churchId = assertChurch(context.churchId);
  const parsed = visitorSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { success: false, message: "Invalid visitor details." };
  }

  const visitor = await db.visitor.create({
    data: {
      churchId,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName || null,
      phone: parsed.data.phone,
      invitedBy: parsed.data.invitedBy || null,
      firstTime: parsed.data.firstTime,
      firstVisitDate: new Date(parsed.data.firstVisitDate),
      followUpStatus: parsed.data.followUpStatus,
      convertedToMember: parsed.data.convertedToMember,
      notes: parsed.data.notes || null,
    },
  });

  await logAudit({
    churchId,
    actorUserId: context.userId,
    actorRole: context.role,
    action: AuditAction.CREATE,
    entity: "Visitor",
    entityId: visitor.id,
  });

  revalidatePath("/dashboard/visitors");
  return { success: true, message: "Visitor added." };
}

export async function updateVisitorFollowUpAction(
  visitorId: string,
  followUpStatus: "PENDING" | "CONTACTED" | "SCHEDULED" | "COMPLETED",
) {
  const context = await requireChurchContext();
  if (!hasPermission(context.role, "visitors:manage")) {
    return { success: false, message: "You cannot update visitors." };
  }

  const churchId = assertChurch(context.churchId);
  await db.visitor.update({
    where: { id: visitorId, churchId },
    data: { followUpStatus },
  });

  await logAudit({
    churchId,
    actorUserId: context.userId,
    actorRole: context.role,
    action: AuditAction.UPDATE,
    entity: "Visitor",
    entityId: visitorId,
    payload: { followUpStatus },
  });

  revalidatePath("/dashboard/visitors");
  return { success: true, message: "Follow-up status updated." };
}

