"use server";

import { AuditAction, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/rbac";
import { assertChurch, requireChurchContext } from "@/lib/tenant";
import { homecellReportSchema, unlockReportSchema } from "@/lib/validations/homecell-report";

function toNullableText(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function submitHomecellReportAction(payload: unknown) {
  const context = await requireChurchContext();
  if (!hasPermission(context.role, "homecell_reports:submit")) {
    return { success: false, message: "You cannot submit homecell reports." };
  }

  const churchId = assertChurch(context.churchId);
  const parsed = homecellReportSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, message: "Invalid report payload." };
  }

  const data = parsed.data;
  const presentCount = data.members.filter((member) => (member.homecellPresent ?? member.present ?? true)).length;
  const absentCount = data.members.length - presentCount;

  try {
    const report = await db.homecellReport.create({
      data: {
        churchId,
        homecellId: data.homecellId,
        submittedById: context.userId,
        weekStartDate: new Date(data.weekStartDate),
        weekEndDate: new Date(data.weekEndDate),
        totalMembers: data.members.length,
        membersPresent: presentCount,
        membersAbsent: absentCount,
        visitors: data.visitors,
        firstTimeVisitors: data.firstTimeVisitors,
        prayerRequests: data.prayerRequests || null,
        offeringCollected: data.offeringCollected ? new Prisma.Decimal(data.offeringCollected) : null,
        memberItems: {
          create: data.members.map((member) => {
            const homecellPresent = member.homecellPresent ?? member.present ?? true;
            const churchMorningPresent =
              member.churchMorningPresent ??
              member.churchPresent ??
              member.homecellPresent ??
              member.present ??
              true;
            const churchEveningPresent =
              member.churchEveningPresent ??
              member.churchPresent ??
              member.homecellPresent ??
              member.present ??
              true;
            const churchMorningAttendedLabel =
              churchMorningPresent
                ? toNullableText(member.churchMorningAttendedLabel) ??
                  member.churchAttendedLabels?.[0] ??
                  null
                : null;
            const churchEveningAttendedLabel =
              churchEveningPresent
                ? toNullableText(member.churchEveningAttendedLabel) ??
                  member.churchAttendedLabels?.[1] ??
                  null
                : null;
            const churchMorningAbsenceReason = churchMorningPresent
              ? null
              : toNullableText(member.churchMorningAbsenceReason) ??
                toNullableText(member.churchAbsenceReason) ??
                toNullableText(member.absenceReason);
            const churchMorningAbsenceNote = churchMorningPresent
              ? null
              : toNullableText(member.churchMorningAbsenceNote) ??
                toNullableText(member.churchAbsenceNote) ??
                toNullableText(member.absenceNote);
            const churchEveningAbsenceReason = churchEveningPresent
              ? null
              : toNullableText(member.churchEveningAbsenceReason) ??
                toNullableText(member.churchAbsenceReason) ??
                toNullableText(member.absenceReason);
            const churchEveningAbsenceNote = churchEveningPresent
              ? null
              : toNullableText(member.churchEveningAbsenceNote) ??
                toNullableText(member.churchAbsenceNote) ??
                toNullableText(member.absenceNote);
            const churchAttendedLabels = [churchMorningAttendedLabel, churchEveningAttendedLabel].filter(
              (value): value is string => Boolean(value),
            );
            const churchPresent = churchAttendedLabels.length > 0;
            const churchAbsenceReason = churchPresent
              ? null
              : churchMorningAbsenceReason ?? churchEveningAbsenceReason;
            const churchAbsenceNote = churchPresent ? null : churchMorningAbsenceNote ?? churchEveningAbsenceNote;

            return {
              homecellPresent,
              homecellAbsenceReason: homecellPresent
                ? null
                : toNullableText(member.homecellAbsenceReason) ?? toNullableText(member.absenceReason),
              homecellAbsenceNote: homecellPresent
                ? null
                : toNullableText(member.homecellAbsenceNote) ?? toNullableText(member.absenceNote),
              churchMorningPresent,
              churchMorningAttendedLabel,
              churchMorningAbsenceReason,
              churchMorningAbsenceNote,
              churchEveningPresent,
              churchEveningAttendedLabel,
              churchEveningAbsenceReason,
              churchEveningAbsenceNote,
              churchPresent,
              churchAttendedLabels,
              churchAbsenceReason,
              churchAbsenceNote,
              churchId,
              memberId: member.memberId ?? null,
              memberName: member.memberName,
              present: homecellPresent,
              absenceReason: homecellPresent
                ? null
                : toNullableText(member.homecellAbsenceReason) ?? toNullableText(member.absenceReason),
              absenceNote: homecellPresent
                ? null
                : toNullableText(member.homecellAbsenceNote) ?? toNullableText(member.absenceNote),
            };
          }),
        },
      },
    });

    await logAudit({
      churchId,
      actorUserId: context.userId,
      actorRole: context.role,
      action: AuditAction.CREATE,
      entity: "HomecellReport",
      entityId: report.id,
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { success: false, message: "Report already submitted for this week." };
    }
    throw error;
  }

  revalidatePath("/dashboard/homecells/reports");
  return { success: true, message: "Weekly report submitted." };
}

export async function unlockHomecellReportAction(payload: unknown) {
  const context = await requireChurchContext();
  if (!hasPermission(context.role, "homecell_reports:unlock")) {
    return { success: false, message: "You cannot unlock reports." };
  }

  const churchId = assertChurch(context.churchId);
  const parsed = unlockReportSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, message: "Invalid request." };
  }

  await db.homecellReport.update({
    where: {
      id: parsed.data.reportId,
      churchId,
    },
    data: { isLocked: false },
  });

  await logAudit({
    churchId,
    actorUserId: context.userId,
    actorRole: context.role,
    action: AuditAction.UPDATE,
    entity: "HomecellReport",
    entityId: parsed.data.reportId,
    payload: { isLocked: false },
  });

  revalidatePath("/dashboard/homecells/reports");
  return { success: true, message: "Report unlocked for edits." };
}
