"use server";

import { AuditAction } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { logAudit } from "@/lib/audit";
import {
  canCreateAttendanceService,
  canMarkMemberAttendance,
  canSubmitSelfAttendance,
  resolveAttendanceScope,
} from "@/lib/attendance-scope";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/rbac";
import { assertChurch, requireChurchContext } from "@/lib/tenant";
import {
  attendanceSubmissionSchema,
  churchAttendanceMatrixSchema,
  selfAttendanceReportSchema,
  serviceSchema,
} from "@/lib/validations/attendance";

const serviceCreateMetaSchema = serviceSchema.pick({
  serviceType: true,
  eventDate: true,
});

function utcDateWindow(value: Date) {
  const start = new Date(value);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

function utcDayKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function sundaysInMonthUtc(anchor: Date) {
  const start = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1));
  const end = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 1));
  const results: Date[] = [];
  for (let cursor = new Date(start); cursor < end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    if (cursor.getUTCDay() === 0) {
      results.push(new Date(cursor));
    }
  }
  return results;
}

export async function createServiceAction(formData: FormData) {
  const context = await requireChurchContext();
  if (
    !hasPermission(context.role, "attendance:manage") ||
    !canCreateAttendanceService(context.role)
  ) {
    return { success: false, message: "You cannot create services." };
  }

  const churchId = assertChurch(context.churchId);
  const parsedMeta = serviceCreateMetaSchema.safeParse({
    serviceType: String(formData.get("serviceType") ?? ""),
    eventDate: String(formData.get("eventDate") ?? ""),
  });
  if (!parsedMeta.success) {
    return { success: false, message: "Invalid service details." };
  }

  const presetTitles = formData
    .getAll("titles")
    .map((value) => String(value).trim())
    .filter(Boolean);
  const customTitle = String(formData.get("title") ?? "").trim();
  const dedupedTitles = Array.from(
    new Set([...presetTitles, ...(customTitle ? [customTitle] : [])]),
  );

  if (dedupedTitles.length === 0) {
    return { success: false, message: "Select at least one service label or enter a custom title." };
  }

  const invalidTitle = dedupedTitles.find((title) => title.length < 2 || title.length > 120);
  if (invalidTitle) {
    return { success: false, message: "Each service title must be between 2 and 120 characters." };
  }

  const eventDate = new Date(parsedMeta.data.eventDate);
  if (Number.isNaN(eventDate.getTime())) {
    return { success: false, message: "Service date is invalid." };
  }
  const weekday = eventDate.getUTCDay();
  if (parsedMeta.data.serviceType === "MIDWEEK" && (weekday === 0 || weekday === 6)) {
    return { success: false, message: "Homecell/Midweek services can only be created from Monday to Friday." };
  }

  const targetDates =
    parsedMeta.data.serviceType === "SUNDAY" ? sundaysInMonthUtc(eventDate) : [eventDate];
  if (targetDates.length === 0) {
    return { success: false, message: "No Sundays found in the selected month." };
  }

  const dateWindows = targetDates.map((date) => ({
    date,
    ...utcDateWindow(date),
  }));
  const existingServices = await db.service.findMany({
    where: {
      churchId,
      title: { in: dedupedTitles },
      OR: dateWindows.map((window) => ({
        eventDate: {
          gte: window.start,
          lt: window.end,
        },
      })),
    },
    select: { title: true, eventDate: true },
  });
  const existingKeySet = new Set(
    existingServices.map((service) => `${service.title}|${utcDayKey(service.eventDate)}`),
  );

  const rowsToCreate = targetDates.flatMap((date) =>
    dedupedTitles
      .filter((title) => !existingKeySet.has(`${title}|${utcDayKey(date)}`))
      .map((title) => ({
        title,
        eventDate: new Date(date),
      })),
  );

  if (rowsToCreate.length === 0) {
    return { success: false, message: "Selected service labels already exist for this date." };
  }

  const createdServices = await db.$transaction(
    rowsToCreate.map((row) =>
      db.service.create({
        data: {
          churchId,
          title: row.title,
          serviceType: parsedMeta.data.serviceType,
          eventDate: row.eventDate,
          createdById: context.userId,
        },
      }),
    ),
  );

  await Promise.all(
    createdServices.map((service) =>
      logAudit({
        churchId,
        actorUserId: context.userId,
        actorRole: context.role,
        action: AuditAction.CREATE,
        entity: "Service",
        entityId: service.id,
      }),
    ),
  );

  revalidatePath("/dashboard/attendance");
  const expectedCount = dedupedTitles.length * targetDates.length;
  const skippedCount = expectedCount - createdServices.length;
  const summaryMessage = skippedCount
    ? `${createdServices.length} service(s) created, ${skippedCount} already existed.`
    : `${createdServices.length} service(s) created.`;
  return { success: true, message: summaryMessage, serviceId: createdServices[0]?.id };
}

export async function submitAttendanceAction(payload: unknown) {
  const context = await requireChurchContext();
  if (
    !hasPermission(context.role, "attendance:manage") ||
    !canMarkMemberAttendance(context.role)
  ) {
    return { success: false, message: "You cannot mark attendance." };
  }

  const churchId = assertChurch(context.churchId);
  const parsed = attendanceSubmissionSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, message: "Attendance payload is invalid." };
  }

  const hasInvalidAbsence = parsed.data.entries.some(
    (entry) => entry.status === "ABSENT" && !entry.absentReason,
  );
  if (hasInvalidAbsence) {
    return { success: false, message: "Absent members require an absence reason." };
  }

  const payloadMemberIds = parsed.data.entries.map((entry) => entry.memberId);
  const uniqueMemberIds = Array.from(new Set(payloadMemberIds));
  if (uniqueMemberIds.length !== payloadMemberIds.length) {
    return { success: false, message: "Duplicate member rows found in attendance payload." };
  }

  const service = await db.service.findFirst({
    where: { id: parsed.data.serviceId, churchId },
    select: { id: true },
  });
  if (!service) {
    return { success: false, message: "Selected service is invalid." };
  }

  const scope = await resolveAttendanceScope({
    churchId,
    userId: context.userId,
    role: context.role,
  });
  if (!scope.isFullAccess && scope.homecellIds.length === 0) {
    return { success: false, message: "You do not have attendance scope assigned yet." };
  }

  const scopedMembers = await db.member.findMany({
    where: {
      churchId,
      isDeleted: false,
      id: { in: uniqueMemberIds },
      ...(scope.isFullAccess ? {} : { homecellId: { in: scope.homecellIds } }),
    },
    select: { id: true },
  });
  if (scopedMembers.length !== uniqueMemberIds.length) {
    return { success: false, message: "Attendance includes members outside your structure scope." };
  }

  const attendanceRecord = await db.attendanceRecord.upsert({
    where: {
      churchId_serviceId: {
        churchId,
        serviceId: parsed.data.serviceId,
      },
    },
    update: {
      markedById: context.userId,
      updatedAt: new Date(),
    },
    create: {
      churchId,
      serviceId: parsed.data.serviceId,
      markedById: context.userId,
    },
  });

  await db.$transaction([
    db.attendanceEntry.deleteMany({
      where: {
        attendanceId: attendanceRecord.id,
        memberId: { in: uniqueMemberIds },
      },
    }),
    db.attendanceEntry.createMany({
      data: parsed.data.entries.map((entry) => ({
        churchId,
        attendanceId: attendanceRecord.id,
        memberId: entry.memberId,
        status: entry.status,
        absentReason: entry.status === "ABSENT" ? entry.absentReason || null : null,
        absentNote: entry.status === "ABSENT" ? entry.absentNote || null : null,
      })),
    }),
  ]);

  await logAudit({
    churchId,
    actorUserId: context.userId,
    actorRole: context.role,
    action: AuditAction.UPDATE,
    entity: "AttendanceRecord",
    entityId: attendanceRecord.id,
  });

  revalidatePath("/dashboard/attendance");
  return { success: true, message: "Attendance saved." };
}

export async function submitSelfAttendanceReportAction(payload: unknown) {
  const context = await requireChurchContext();
  if (
    !hasPermission(context.role, "attendance:self_report") ||
    !canSubmitSelfAttendance(context.role)
  ) {
    return { success: false, message: "You cannot submit a self attendance report." };
  }

  const churchId = assertChurch(context.churchId);
  const parsed = selfAttendanceReportSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, message: "Self report payload is invalid." };
  }

  const service = await db.service.findFirst({
    where: { id: parsed.data.serviceId, churchId },
    select: { id: true },
  });
  if (!service) {
    return { success: false, message: "Selected service is invalid." };
  }

  const report = await db.leaderAttendanceSelfReport.upsert({
    where: {
      churchId_serviceId_reporterUserId: {
        churchId,
        serviceId: parsed.data.serviceId,
        reporterUserId: context.userId,
      },
    },
    create: {
      churchId,
      serviceId: parsed.data.serviceId,
      reporterUserId: context.userId,
      reporterRole: context.role,
      status: parsed.data.status,
      note: parsed.data.note || null,
    },
    update: {
      status: parsed.data.status,
      note: parsed.data.note || null,
      reporterRole: context.role,
      updatedAt: new Date(),
    },
  });

  await logAudit({
    churchId,
    actorUserId: context.userId,
    actorRole: context.role,
    action: AuditAction.UPDATE,
    entity: "LeaderAttendanceSelfReport",
    entityId: report.id,
  });

  revalidatePath("/dashboard/attendance");
  return { success: true, message: "Self attendance report submitted." };
}

export async function submitChurchAttendanceMatrixAction(payload: unknown) {
  const context = await requireChurchContext();
  if (
    !hasPermission(context.role, "attendance:manage") ||
    !canMarkMemberAttendance(context.role)
  ) {
    return { success: false, message: "You cannot mark attendance." };
  }

  const churchId = assertChurch(context.churchId);
  const parsed = churchAttendanceMatrixSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, message: "Church attendance payload is invalid." };
  }

  const payloadServiceIds = parsed.data.serviceIds;
  const uniqueServiceIds = Array.from(new Set(payloadServiceIds));
  if (uniqueServiceIds.length !== payloadServiceIds.length) {
    return { success: false, message: "Duplicate services found in payload." };
  }

  const payloadMemberIds = parsed.data.entries.map((entry) => entry.memberId);
  const uniqueMemberIds = Array.from(new Set(payloadMemberIds));
  if (uniqueMemberIds.length !== payloadMemberIds.length) {
    return { success: false, message: "Duplicate member rows found in payload." };
  }

  const services = await db.service.findMany({
    where: {
      churchId,
      id: { in: uniqueServiceIds },
    },
    select: {
      id: true,
      eventDate: true,
    },
  });
  if (services.length !== uniqueServiceIds.length) {
    return { success: false, message: "Selected service set is invalid." };
  }

  const eventDateKeys = new Set(services.map((service) => service.eventDate.toISOString().slice(0, 10)));
  if (eventDateKeys.size > 1) {
    return { success: false, message: "Church attendance services must belong to the same date." };
  }

  const scope = await resolveAttendanceScope({
    churchId,
    userId: context.userId,
    role: context.role,
  });
  if (!scope.isFullAccess && scope.homecellIds.length === 0) {
    return { success: false, message: "You do not have attendance scope assigned yet." };
  }

  const scopedMembers = await db.member.findMany({
    where: {
      churchId,
      isDeleted: false,
      id: { in: uniqueMemberIds },
      ...(scope.isFullAccess ? {} : { homecellId: { in: scope.homecellIds } }),
    },
    select: { id: true },
  });
  if (scopedMembers.length !== uniqueMemberIds.length) {
    return { success: false, message: "Attendance includes members outside your structure scope." };
  }

  const serviceIdSet = new Set(uniqueServiceIds);
  const memberAttendanceMap = new Map<string, Set<string>>();
  const memberOnlineMap = new Map<string, Set<string>>();
  for (const row of parsed.data.entries) {
    const attendedServices = new Set(
      row.attendedServiceIds.filter((serviceId) => serviceIdSet.has(serviceId)),
    );
    const onlineServices = new Set(
      (row.onlineServiceIds ?? []).filter((serviceId) => serviceIdSet.has(serviceId)),
    );
    for (const serviceId of onlineServices) {
      attendedServices.add(serviceId);
    }
    memberAttendanceMap.set(row.memberId, attendedServices);
    memberOnlineMap.set(row.memberId, onlineServices);
  }

  await db.$transaction(async (tx) => {
    for (const service of services) {
      const attendanceRecord = await tx.attendanceRecord.upsert({
        where: {
          churchId_serviceId: {
            churchId,
            serviceId: service.id,
          },
        },
        update: {
          markedById: context.userId,
          updatedAt: new Date(),
        },
        create: {
          churchId,
          serviceId: service.id,
          markedById: context.userId,
        },
      });

      await tx.attendanceEntry.deleteMany({
        where: {
          attendanceId: attendanceRecord.id,
          memberId: { in: uniqueMemberIds },
        },
      });

      await tx.attendanceEntry.createMany({
        data: uniqueMemberIds.map((memberId) => {
          const attendedServices = memberAttendanceMap.get(memberId) ?? new Set<string>();
          const onlineServices = memberOnlineMap.get(memberId) ?? new Set<string>();
          const isAttended = attendedServices.has(service.id);
          const isOnline = onlineServices.has(service.id);
          return {
            churchId,
            attendanceId: attendanceRecord.id,
            memberId,
            status: isOnline ? "ONLINE" : isAttended ? "PRESENT" : "ABSENT",
            absentReason: isAttended ? null : "Not attended this service",
            absentNote: null,
          };
        }),
      });
    }
  });

  await logAudit({
    churchId,
    actorUserId: context.userId,
    actorRole: context.role,
    action: AuditAction.UPDATE,
    entity: "ChurchAttendanceMatrix",
    entityId: services[0]?.id,
    payload: {
      serviceIds: uniqueServiceIds,
      memberCount: uniqueMemberIds.length,
    },
  });

  revalidatePath("/dashboard/attendance");
  return { success: true, message: "Church attendance saved." };
}
