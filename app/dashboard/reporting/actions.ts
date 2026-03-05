"use server";

import { AuditAction, Prisma, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/rbac";
import { assertChurch, requireChurchContext } from "@/lib/tenant";
import { homecellReportMemberSchema } from "@/lib/validations/homecell-report";

const reportingBaseSchema = z.object({
  homecellId: z.string().cuid(),
  weekStartDate: z.string(),
  weekEndDate: z.string(),
});

const reportingMembersSchema = reportingBaseSchema.extend({
  members: z.array(homecellReportMemberSchema).min(1),
});

const reportingVisitorsItemSchema = z.object({
  id: z.string().trim().max(120).optional(),
  name: z.string().trim().min(2).max(120),
  present: z.coerce.boolean().optional(),
  homecellPresent: z.boolean().nullable().optional(),
  churchPresent: z.coerce.boolean().optional(),
  churchMorningPresent: z.coerce.boolean().optional(),
  churchMorningAttendedLabel: z.string().trim().max(120).optional().or(z.literal("")),
  churchEveningPresent: z.coerce.boolean().optional(),
  churchEveningAttendedLabel: z.string().trim().max(120).optional().or(z.literal("")),
});

const reportingVisitorsSchema = reportingBaseSchema.extend({
  items: z.array(reportingVisitorsItemSchema).max(500),
});

const reportingFirstVisitorsSchema = reportingBaseSchema.extend({
  items: z.array(reportingVisitorsItemSchema).max(500),
});

const reportingSalvationItemSchema = z.object({
  id: z.string().trim().min(1).max(120),
  name: z.string().trim().min(2).max(120),
  source: z.enum(["MEMBER", "VISITOR", "FTV"]),
  location: z.enum(["HOMECELL", "CHURCH"]),
});

const reportingSalvationsSchema = reportingBaseSchema.extend({
  items: z.array(reportingSalvationItemSchema).max(500),
});

type ReportingMember = z.infer<typeof homecellReportMemberSchema>;
type ReportingVisitorsItem = z.infer<typeof reportingVisitorsItemSchema>;
type ReportingSalvationItem = z.infer<typeof reportingSalvationItemSchema>;
type ReportingSalvationSource = ReportingSalvationItem["source"];

type ParsedVisitorsAttendanceItem = {
  id: string;
  name: string;
  present: boolean;
  homecellPresent: boolean | null;
  churchPresent: boolean;
  churchMorningPresent: boolean;
  churchEveningPresent: boolean;
};

type SalvationEligibility = {
  id: string;
  source: ReportingSalvationSource;
  name: string;
  eligible: boolean;
};

function resolvedHomecellPresent(member: z.infer<typeof homecellReportMemberSchema>) {
  return member.homecellPresent ?? member.present ?? true;
}

function toNullableText(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function withStableId(id?: string | null) {
  const resolved = toNullableText(id);
  return resolved ?? crypto.randomUUID();
}

function normalizeVisitorsItems(items: ReportingVisitorsItem[]) {
  return items.map((item) => {
    const legacyPresent = item.present ?? true;
    const homecellPresent =
      typeof item.homecellPresent === "boolean"
        ? item.homecellPresent
        : item.homecellPresent === null
          ? null
          : legacyPresent;
    const churchMorningPresent = item.churchMorningPresent ?? item.churchPresent ?? legacyPresent;
    const churchEveningPresent = item.churchEveningPresent ?? item.churchPresent ?? legacyPresent;
    const churchMorningAttendedLabel = churchMorningPresent ? toNullableText(item.churchMorningAttendedLabel) : null;
    const churchEveningAttendedLabel = churchEveningPresent ? toNullableText(item.churchEveningAttendedLabel) : null;
    const churchPresent = churchMorningPresent || churchEveningPresent;
    const present = homecellPresent === true || churchPresent;

    return {
      id: withStableId(item.id),
      name: item.name.trim(),
      present,
      homecellPresent,
      churchPresent,
      churchMorningPresent,
      churchMorningAttendedLabel,
      churchEveningPresent,
      churchEveningAttendedLabel,
    };
  });
}

function normalizeSalvationItems(items: ReportingSalvationItem[]) {
  return items.map((item) => ({
    id: item.id.trim(),
    name: item.name.trim(),
    source: item.source,
    location: item.location,
  }));
}

function parseVisitorsAttendanceItems(value: Prisma.JsonValue | null | undefined): ParsedVisitorsAttendanceItem[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];

    const source = item as Record<string, unknown>;
    const id = typeof source.id === "string" ? source.id.trim() : "";
    const name = typeof source.name === "string" ? source.name.trim() : "";
    const legacyPresent = typeof source.present === "boolean" ? source.present : true;
    const homecellPresent =
      typeof source.homecellPresent === "boolean"
        ? source.homecellPresent
        : source.homecellPresent === null
          ? null
          : legacyPresent;
    const churchMorningPresent =
      typeof source.churchMorningPresent === "boolean"
        ? source.churchMorningPresent
        : typeof source.churchPresent === "boolean"
          ? source.churchPresent
          : legacyPresent;
    const churchEveningPresent =
      typeof source.churchEveningPresent === "boolean"
        ? source.churchEveningPresent
        : typeof source.churchPresent === "boolean"
          ? source.churchPresent
          : legacyPresent;
    const churchPresent =
      typeof source.churchPresent === "boolean" ? source.churchPresent : churchMorningPresent || churchEveningPresent;
    const present = homecellPresent === true || churchPresent;
    if (!id || !name) return [];

    return [{ id, name, present, homecellPresent, churchPresent, churchMorningPresent, churchEveningPresent }];
  });
}

function salvationEligibilityKey(source: ReportingSalvationSource, id: string) {
  return `${source}:${id}`;
}

async function getSalvationEligibilitySet({
  churchId,
  homecellId,
  weekStartDate,
}: {
  churchId: string;
  homecellId: string;
  weekStartDate: Date;
}) {
  const [members, report] = await Promise.all([
    db.member.findMany({
      where: {
        churchId,
        homecellId,
        isDeleted: false,
        membershipStatus: "ACTIVE",
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
      },
    }),
    db.homecellReport.findUnique({
      where: {
        churchId_homecellId_weekStartDate: {
          churchId,
          homecellId,
          weekStartDate,
        },
      },
      select: {
        memberItems: {
          select: {
            memberId: true,
            homecellPresent: true,
            churchPresent: true,
            churchMorningPresent: true,
            churchEveningPresent: true,
          },
        },
        visitorItems: true,
        firstTimeVisitorItems: true,
      },
    }),
  ]);

  const memberPresenceById = new Map(
    (report?.memberItems ?? [])
      .filter((item) => item.memberId)
      .map((item) => {
        const churchPresent = item.churchPresent || item.churchMorningPresent || item.churchEveningPresent;
        return [item.memberId as string, item.homecellPresent || churchPresent];
      }),
  );

  const eligibility = new Map<string, SalvationEligibility>();
  for (const member of members) {
    const name = `${member.firstName} ${member.lastName}`.trim();
    eligibility.set(salvationEligibilityKey("MEMBER", member.id), {
      id: member.id,
      source: "MEMBER",
      name,
      eligible: memberPresenceById.get(member.id) ?? false,
    });
  }

  for (const visitor of parseVisitorsAttendanceItems(report?.visitorItems)) {
    const eligible = visitor.homecellPresent || visitor.churchPresent;
    eligibility.set(salvationEligibilityKey("VISITOR", visitor.id), {
      id: visitor.id,
      source: "VISITOR",
      name: visitor.name,
      eligible,
    });
  }

  for (const firstVisitor of parseVisitorsAttendanceItems(report?.firstTimeVisitorItems)) {
    const eligible = firstVisitor.homecellPresent || firstVisitor.churchPresent;
    eligibility.set(salvationEligibilityKey("FTV", firstVisitor.id), {
      id: firstVisitor.id,
      source: "FTV",
      name: firstVisitor.name,
      eligible,
    });
  }

  return eligibility;
}

function resolveChurchFields(member: ReportingMember) {
  const legacyLabels = (member.churchAttendedLabels ?? [])
    .map((label) => label.trim())
    .filter((label) => label.length > 0);
  const legacyChurchPresent = member.churchPresent;

  const churchMorningPresent =
    typeof member.churchMorningPresent === "boolean"
      ? member.churchMorningPresent
      : typeof legacyChurchPresent === "boolean"
        ? legacyChurchPresent
        : true;
  const churchEveningPresent =
    typeof member.churchEveningPresent === "boolean"
      ? member.churchEveningPresent
      : typeof legacyChurchPresent === "boolean"
        ? legacyChurchPresent
        : true;

  const morningLabelCandidate = toNullableText(member.churchMorningAttendedLabel) ?? legacyLabels[0] ?? null;
  const eveningLabelCandidate = toNullableText(member.churchEveningAttendedLabel) ?? legacyLabels[1] ?? null;

  const churchMorningAttendedLabel = churchMorningPresent ? morningLabelCandidate : null;
  const churchEveningAttendedLabel = churchEveningPresent ? eveningLabelCandidate : null;
  const churchMorningAbsenceReason = churchMorningPresent
    ? null
    : toNullableText(member.churchMorningAbsenceReason) ?? toNullableText(member.churchAbsenceReason);
  const churchMorningAbsenceNote = churchMorningPresent
    ? null
    : toNullableText(member.churchMorningAbsenceNote) ?? toNullableText(member.churchAbsenceNote);
  const churchEveningAbsenceReason = churchEveningPresent
    ? null
    : toNullableText(member.churchEveningAbsenceReason) ?? toNullableText(member.churchAbsenceReason);
  const churchEveningAbsenceNote = churchEveningPresent
    ? null
    : toNullableText(member.churchEveningAbsenceNote) ?? toNullableText(member.churchAbsenceNote);

  const churchAttendedLabels = [
    churchMorningPresent ? churchMorningAttendedLabel : null,
    churchEveningPresent ? churchEveningAttendedLabel : null,
  ].filter((value): value is string => Boolean(value));
  const churchPresent = churchAttendedLabels.length > 0;
  const churchAbsenceReason = churchPresent ? null : churchMorningAbsenceReason ?? churchEveningAbsenceReason;
  const churchAbsenceNote = churchPresent ? null : churchMorningAbsenceNote ?? churchEveningAbsenceNote;

  return {
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
  };
}

type ReportingWriteContextResult =
  | {
      success: true;
      churchId: string;
      userId: string;
      role: Role;
      weekStartDate: Date;
      weekEndDate: Date;
      existingReport: { id: string; isLocked: boolean } | null;
    }
  | {
      success: false;
      message: string;
    };

async function resolveReportingWriteContext(
  data: z.infer<typeof reportingBaseSchema>,
): Promise<ReportingWriteContextResult> {
  const context = await requireChurchContext();
  if (!hasPermission(context.role, "homecell_reports:submit")) {
    return { success: false, message: "You cannot submit homecell member reporting." };
  }

  const churchId = assertChurch(context.churchId);
  const weekStartDate = new Date(data.weekStartDate);
  const weekEndDate = new Date(data.weekEndDate);
  if (Number.isNaN(weekStartDate.getTime()) || Number.isNaN(weekEndDate.getTime())) {
    return { success: false, message: "Invalid report week dates." };
  }

  const homecell = await db.homecell.findFirst({
    where: {
      id: data.homecellId,
      churchId,
    },
    select: {
      id: true,
      leaderId: true,
    },
  });
  if (!homecell) {
    return { success: false, message: "Selected homecell is invalid." };
  }

  if (context.role === Role.HOMECELL_LEADER && homecell.leaderId !== context.userId) {
    return { success: false, message: "You can only submit reports for your assigned homecell." };
  }

  const existingReport = await db.homecellReport.findUnique({
    where: {
      churchId_homecellId_weekStartDate: {
        churchId,
        homecellId: data.homecellId,
        weekStartDate,
      },
    },
    select: {
      id: true,
      isLocked: true,
    },
  });

  if (existingReport?.isLocked) {
    return { success: false, message: "This week report is locked. Ask a supervisor/overseer to unlock it first." };
  }

  return {
    success: true,
    churchId,
    userId: context.userId,
    role: context.role,
    weekStartDate,
    weekEndDate,
    existingReport,
  };
}

export async function submitReportingMembersAction(payload: unknown) {
  const parsed = reportingMembersSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, message: "Invalid reporting payload." };
  }

  const resolvedContext = await resolveReportingWriteContext(parsed.data);
  if (!resolvedContext.success) {
    return resolvedContext;
  }

  const { churchId, userId, role, weekStartDate, weekEndDate, existingReport } = resolvedContext;

  const resolvedMembers = parsed.data.members.map((member) => {
    const homecellPresent = resolvedHomecellPresent(member);
    return {
      member,
      homecellPresent,
      homecellAbsenceReason: homecellPresent
        ? null
        : toNullableText(member.homecellAbsenceReason) ?? toNullableText(member.absenceReason),
      homecellAbsenceNote: homecellPresent
        ? null
        : toNullableText(member.homecellAbsenceNote) ?? toNullableText(member.absenceNote),
      ...resolveChurchFields(member),
    };
  });

  const hasMissingHomecellReason = resolvedMembers.some(
    (resolved) => !resolved.homecellPresent && !resolved.homecellAbsenceReason,
  );
  if (hasMissingHomecellReason) {
    return { success: false, message: "Each homecell absence needs its own reason." };
  }

  const hasMissingMorningReason = resolvedMembers.some(
    (resolved) => !resolved.churchMorningPresent && !resolved.churchMorningAbsenceReason,
  );
  if (hasMissingMorningReason) {
    return { success: false, message: "Each morning absence needs its own reason." };
  }

  const hasMissingEveningReason = resolvedMembers.some(
    (resolved) => !resolved.churchEveningPresent && !resolved.churchEveningAbsenceReason,
  );
  if (hasMissingEveningReason) {
    return { success: false, message: "Each evening absence needs its own reason." };
  }

  const hasMissingMorningSelection = resolvedMembers.some(
    (resolved) => resolved.churchMorningPresent && !resolved.churchMorningAttendedLabel,
  );
  if (hasMissingMorningSelection) {
    return { success: false, message: "Each member must have one morning service or online option selected." };
  }

  const hasMissingEveningSelection = resolvedMembers.some(
    (resolved) => resolved.churchEveningPresent && !resolved.churchEveningAttendedLabel,
  );
  if (hasMissingEveningSelection) {
    return { success: false, message: "Each member must have one evening service or online option selected." };
  }

  const presentCount = resolvedMembers.filter((resolved) => resolved.homecellPresent).length;
  const absentCount = resolvedMembers.length - presentCount;

  if (!existingReport) {
    const report = await db.homecellReport.create({
      data: {
        churchId,
        homecellId: parsed.data.homecellId,
        submittedById: userId,
        weekStartDate,
        weekEndDate,
        totalMembers: parsed.data.members.length,
        membersPresent: presentCount,
        membersAbsent: absentCount,
        visitors: 0,
        firstTimeVisitors: 0,
        prayerRequests: null,
        offeringCollected: null,
        memberItems: {
          create: resolvedMembers.map((resolved) => {
            const { member } = resolved;
            return {
              churchId,
              memberId: member.memberId ?? null,
              memberName: member.memberName,
              present: resolved.homecellPresent,
              absenceReason: resolved.homecellAbsenceReason,
              absenceNote: resolved.homecellAbsenceNote,
              homecellPresent: resolved.homecellPresent,
              homecellAbsenceReason: resolved.homecellAbsenceReason,
              homecellAbsenceNote: resolved.homecellAbsenceNote,
              churchPresent: resolved.churchPresent,
              churchAttendedLabels: resolved.churchAttendedLabels,
              churchAbsenceReason: resolved.churchAbsenceReason,
              churchAbsenceNote: resolved.churchAbsenceNote,
              churchMorningPresent: resolved.churchMorningPresent,
              churchMorningAttendedLabel: resolved.churchMorningAttendedLabel,
              churchMorningAbsenceReason: resolved.churchMorningAbsenceReason,
              churchMorningAbsenceNote: resolved.churchMorningAbsenceNote,
              churchEveningPresent: resolved.churchEveningPresent,
              churchEveningAttendedLabel: resolved.churchEveningAttendedLabel,
              churchEveningAbsenceReason: resolved.churchEveningAbsenceReason,
              churchEveningAbsenceNote: resolved.churchEveningAbsenceNote,
            };
          }),
        },
      },
    });

    await logAudit({
      churchId,
      actorUserId: userId,
      actorRole: role,
      action: AuditAction.CREATE,
      entity: "HomecellReport",
      entityId: report.id,
    });
  } else {
    await db.$transaction(async (tx) => {
      await tx.homecellReport.update({
        where: { id: existingReport.id, churchId },
        data: {
          submittedById: userId,
          weekEndDate,
          totalMembers: parsed.data.members.length,
          membersPresent: presentCount,
          membersAbsent: absentCount,
        },
      });

      await tx.homecellReportItem.deleteMany({
        where: {
          churchId,
          reportId: existingReport.id,
        },
      });

      await tx.homecellReportItem.createMany({
        data: resolvedMembers.map((resolved) => {
          const { member } = resolved;
          return {
            churchId,
            reportId: existingReport.id,
            memberId: member.memberId ?? null,
            memberName: member.memberName,
            present: resolved.homecellPresent,
            absenceReason: resolved.homecellAbsenceReason,
            absenceNote: resolved.homecellAbsenceNote,
            homecellPresent: resolved.homecellPresent,
            homecellAbsenceReason: resolved.homecellAbsenceReason,
            homecellAbsenceNote: resolved.homecellAbsenceNote,
            churchPresent: resolved.churchPresent,
            churchAttendedLabels: resolved.churchAttendedLabels,
            churchAbsenceReason: resolved.churchAbsenceReason,
            churchAbsenceNote: resolved.churchAbsenceNote,
            churchMorningPresent: resolved.churchMorningPresent,
            churchMorningAttendedLabel: resolved.churchMorningAttendedLabel,
            churchMorningAbsenceReason: resolved.churchMorningAbsenceReason,
            churchMorningAbsenceNote: resolved.churchMorningAbsenceNote,
            churchEveningPresent: resolved.churchEveningPresent,
            churchEveningAttendedLabel: resolved.churchEveningAttendedLabel,
            churchEveningAbsenceReason: resolved.churchEveningAbsenceReason,
            churchEveningAbsenceNote: resolved.churchEveningAbsenceNote,
          };
        }),
      });
    });

    await logAudit({
      churchId,
      actorUserId: userId,
      actorRole: role,
      action: AuditAction.UPDATE,
      entity: "HomecellReport",
      entityId: existingReport.id,
    });
  }

  revalidatePath("/dashboard/reporting");
  revalidatePath("/dashboard/homecells/reports");
  return { success: true, message: existingReport ? "Weekly report updated." : "Weekly report submitted." };
}

export async function submitReportingVisitorsAction(payload: unknown) {
  const parsed = reportingVisitorsSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, message: "Invalid visitors reporting payload." };
  }

  const resolvedContext = await resolveReportingWriteContext(parsed.data);
  if (!resolvedContext.success) {
    return resolvedContext;
  }

  const { churchId, userId, role, weekStartDate, weekEndDate, existingReport } = resolvedContext;
  const visitorItems = normalizeVisitorsItems(parsed.data.items);
  const hasMissingMorningSelection = visitorItems.some(
    (item) => item.churchMorningPresent && !item.churchMorningAttendedLabel,
  );
  if (hasMissingMorningSelection) {
    return { success: false, message: "Each visitor needs one morning service or online selection, or mark morning absent." };
  }

  const hasMissingEveningSelection = visitorItems.some(
    (item) => item.churchEveningPresent && !item.churchEveningAttendedLabel,
  );
  if (hasMissingEveningSelection) {
    return { success: false, message: "Each visitor needs one evening service or online selection, or mark evening absent." };
  }

  const visitorsPresentCount = visitorItems.filter((item) => item.homecellPresent || item.churchPresent).length;

  if (!existingReport) {
    const report = await db.homecellReport.create({
      data: {
        churchId,
        homecellId: parsed.data.homecellId,
        submittedById: userId,
        weekStartDate,
        weekEndDate,
        totalMembers: 0,
        membersPresent: 0,
        membersAbsent: 0,
        visitors: visitorsPresentCount,
        firstTimeVisitors: 0,
        visitorItems,
        firstTimeVisitorItems: [],
        salvationItems: [],
      },
    });

    await logAudit({
      churchId,
      actorUserId: userId,
      actorRole: role,
      action: AuditAction.CREATE,
      entity: "HomecellReport",
      entityId: report.id,
      payload: { tab: "visitors" },
    });
  } else {
    await db.homecellReport.update({
      where: { id: existingReport.id, churchId },
      data: {
        submittedById: userId,
        weekEndDate,
        visitors: visitorsPresentCount,
        visitorItems,
      },
    });

    await logAudit({
      churchId,
      actorUserId: userId,
      actorRole: role,
      action: AuditAction.UPDATE,
      entity: "HomecellReport",
      entityId: existingReport.id,
      payload: { tab: "visitors" },
    });
  }

  revalidatePath("/dashboard/reporting");
  revalidatePath("/dashboard/homecells/reports");
  return { success: true, message: existingReport ? "Visitors report updated." : "Visitors report submitted." };
}

export async function submitReportingFirstVisitorsAction(payload: unknown) {
  const parsed = reportingFirstVisitorsSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, message: "Invalid first-time visitors reporting payload." };
  }

  const resolvedContext = await resolveReportingWriteContext(parsed.data);
  if (!resolvedContext.success) {
    return resolvedContext;
  }

  const { churchId, userId, role, weekStartDate, weekEndDate, existingReport } = resolvedContext;
  const firstTimeVisitorItems = normalizeVisitorsItems(parsed.data.items);
  const hasMissingMorningSelection = firstTimeVisitorItems.some(
    (item) => item.churchMorningPresent && !item.churchMorningAttendedLabel,
  );
  if (hasMissingMorningSelection) {
    return {
      success: false,
      message: "Each first-time visitor needs one morning service or online selection, or mark morning absent.",
    };
  }

  const hasMissingEveningSelection = firstTimeVisitorItems.some(
    (item) => item.churchEveningPresent && !item.churchEveningAttendedLabel,
  );
  if (hasMissingEveningSelection) {
    return {
      success: false,
      message: "Each first-time visitor needs one evening service or online selection, or mark evening absent.",
    };
  }

  const firstVisitorsPresentCount = firstTimeVisitorItems.filter(
    (item) => item.homecellPresent || item.churchPresent,
  ).length;

  if (!existingReport) {
    const report = await db.homecellReport.create({
      data: {
        churchId,
        homecellId: parsed.data.homecellId,
        submittedById: userId,
        weekStartDate,
        weekEndDate,
        totalMembers: 0,
        membersPresent: 0,
        membersAbsent: 0,
        visitors: 0,
        firstTimeVisitors: firstVisitorsPresentCount,
        visitorItems: [],
        firstTimeVisitorItems,
        salvationItems: [],
      },
    });

    await logAudit({
      churchId,
      actorUserId: userId,
      actorRole: role,
      action: AuditAction.CREATE,
      entity: "HomecellReport",
      entityId: report.id,
      payload: { tab: "first-visitors" },
    });
  } else {
    await db.homecellReport.update({
      where: { id: existingReport.id, churchId },
      data: {
        submittedById: userId,
        weekEndDate,
        firstTimeVisitors: firstVisitorsPresentCount,
        firstTimeVisitorItems,
      },
    });

    await logAudit({
      churchId,
      actorUserId: userId,
      actorRole: role,
      action: AuditAction.UPDATE,
      entity: "HomecellReport",
      entityId: existingReport.id,
      payload: { tab: "first-visitors" },
    });
  }

  revalidatePath("/dashboard/reporting");
  revalidatePath("/dashboard/homecells/reports");
  return {
    success: true,
    message: existingReport ? "First-time visitors report updated." : "First-time visitors report submitted.",
  };
}

export async function submitReportingSalvationsAction(payload: unknown) {
  const parsed = reportingSalvationsSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, message: "Invalid salvations reporting payload." };
  }

  const resolvedContext = await resolveReportingWriteContext(parsed.data);
  if (!resolvedContext.success) {
    return resolvedContext;
  }

  const { churchId, userId, role, weekStartDate, weekEndDate, existingReport } = resolvedContext;
  const salvationItems = normalizeSalvationItems(parsed.data.items);
  const eligibilitySet = await getSalvationEligibilitySet({
    churchId,
    homecellId: parsed.data.homecellId,
    weekStartDate,
  });

  const ineligibleSelection = salvationItems.find((item) => {
    const eligibility = eligibilitySet.get(salvationEligibilityKey(item.source, item.id));
    return !eligibility?.eligible;
  });
  if (ineligibleSelection) {
    return {
      success: false,
      message: `${ineligibleSelection.name} can only be marked in salvations after being present at homecell or church.`,
    };
  }

  if (!existingReport) {
    const report = await db.homecellReport.create({
      data: {
        churchId,
        homecellId: parsed.data.homecellId,
        submittedById: userId,
        weekStartDate,
        weekEndDate,
        totalMembers: 0,
        membersPresent: 0,
        membersAbsent: 0,
        visitors: 0,
        firstTimeVisitors: 0,
        visitorItems: [],
        firstTimeVisitorItems: [],
        salvationItems,
      },
    });

    await logAudit({
      churchId,
      actorUserId: userId,
      actorRole: role,
      action: AuditAction.CREATE,
      entity: "HomecellReport",
      entityId: report.id,
      payload: { tab: "salvations" },
    });
  } else {
    await db.homecellReport.update({
      where: { id: existingReport.id, churchId },
      data: {
        submittedById: userId,
        weekEndDate,
        salvationItems,
      },
    });

    await logAudit({
      churchId,
      actorUserId: userId,
      actorRole: role,
      action: AuditAction.UPDATE,
      entity: "HomecellReport",
      entityId: existingReport.id,
      payload: { tab: "salvations" },
    });
  }

  revalidatePath("/dashboard/reporting");
  revalidatePath("/dashboard/homecells/reports");
  return { success: true, message: existingReport ? "Salvations report updated." : "Salvations report submitted." };
}
