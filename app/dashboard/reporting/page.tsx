import { Prisma } from "@prisma/client";
import { addDays, format } from "date-fns";

import { HomecellMembersReportForm } from "@/components/reporting/homecell-members-report-form";
import { SalvationsReportForm } from "@/components/reporting/salvations-report-form";
import { VisitorsAttendanceReportForm } from "@/components/reporting/visitors-attendance-report-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { resolveAttendanceScope } from "@/lib/attendance-scope";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/rbac";
import { assertChurch, requireChurchContext } from "@/lib/tenant";
import { toStartCase } from "@/lib/utils";

type SearchParams = {
  date?: string;
  homecellId?: string;
  tab?: string;
};

type ReportingTab = "members" | "visitors" | "first-visitors" | "salvations";

type VisitorsAttendanceItem = {
  id?: string;
  name: string;
  present: boolean;
  homecellPresent: boolean | null;
  churchPresent: boolean;
  churchMorningPresent: boolean;
  churchMorningAttendedLabel?: string | null;
  churchEveningPresent: boolean;
  churchEveningAttendedLabel?: string | null;
};

type SalvationItem = {
  id?: string;
  name: string;
  source: "MEMBER" | "VISITOR" | "FTV";
  location: "HOMECELL" | "CHURCH";
};

type SalvationCandidate = {
  id: string;
  name: string;
  source: "MEMBER" | "VISITOR" | "FTV";
  eligible: boolean;
  presentAt: "NONE" | "HOMECELL" | "CHURCH" | "BOTH";
};

function toDateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function mondayUtcForDate(value: Date) {
  const date = new Date(value);
  date.setUTCHours(0, 0, 0, 0);
  const day = date.getUTCDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + diffToMonday);
  return date;
}

function parseDateParam(value: string | undefined) {
  const today = new Date();
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return todayUtc;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return todayUtc;
  return parsed;
}

function parseTab(value: string | undefined): ReportingTab {
  if (!value) return "members";
  if (value === "members" || value === "visitors" || value === "first-visitors" || value === "salvations") {
    return value;
  }
  return "members";
}

function parseVisitorsAttendanceItems(value: Prisma.JsonValue | null | undefined): VisitorsAttendanceItem[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];

    const source = item as Record<string, unknown>;
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
    const churchMorningAttendedLabel =
      typeof source.churchMorningAttendedLabel === "string" && source.churchMorningAttendedLabel.trim().length > 0
        ? source.churchMorningAttendedLabel.trim()
        : null;
    const churchEveningAttendedLabel =
      typeof source.churchEveningAttendedLabel === "string" && source.churchEveningAttendedLabel.trim().length > 0
        ? source.churchEveningAttendedLabel.trim()
        : null;
    const id = typeof source.id === "string" && source.id.trim().length > 0 ? source.id.trim() : undefined;
    if (name.length < 2) return [];

    return [
      {
        id,
        name,
        present,
        homecellPresent,
        churchPresent,
        churchMorningPresent,
        churchMorningAttendedLabel,
        churchEveningPresent,
        churchEveningAttendedLabel,
      },
    ];
  });
}

function parseSalvationItems(value: Prisma.JsonValue | null | undefined): SalvationItem[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];

    const source = item as Record<string, unknown>;
    const name = typeof source.name === "string" ? source.name.trim() : "";
    const id = typeof source.id === "string" && source.id.trim().length > 0 ? source.id.trim() : undefined;
    const rawSource = source.source;
    const normalizedSource =
      rawSource === "MEMBER" || rawSource === "VISITOR" || rawSource === "FTV" ? rawSource : "MEMBER";
    const location = source.location === "HOMECELL" || source.location === "CHURCH" ? source.location : null;
    if (name.length < 2 || !location) return [];

    return [{ id, name, source: normalizedSource, location }];
  });
}

function toCandidateKey(source: SalvationCandidate["source"], id: string) {
  return `${source}:${id}`;
}

function buildSalvationCandidates({
  members,
  reportMemberItems,
  visitors,
  firstVisitors,
}: {
  members: Array<{ id: string; firstName: string; lastName: string }>;
  reportMemberItems: Array<{
    memberId: string | null;
    homecellPresent: boolean;
    churchPresent: boolean;
    churchMorningPresent: boolean;
    churchEveningPresent: boolean;
  }>;
  visitors: VisitorsAttendanceItem[];
  firstVisitors: VisitorsAttendanceItem[];
}) {
  const memberAttendance = new Map(
    reportMemberItems
      .filter((item) => item.memberId)
      .map((item) => {
        const atChurch = item.churchPresent || item.churchMorningPresent || item.churchEveningPresent;
        let presentAt: SalvationCandidate["presentAt"] = "NONE";
        if (item.homecellPresent && atChurch) presentAt = "BOTH";
        else if (item.homecellPresent) presentAt = "HOMECELL";
        else if (atChurch) presentAt = "CHURCH";

        return [item.memberId as string, presentAt];
      }),
  );

  const candidates: SalvationCandidate[] = members.map((member) => {
    const presentAt = memberAttendance.get(member.id) ?? "NONE";
    return {
      id: member.id,
      name: `${member.firstName} ${member.lastName}`.trim(),
      source: "MEMBER",
      eligible: presentAt !== "NONE",
      presentAt,
    };
  });

  for (const visitor of visitors) {
    if (!visitor.id) continue;
    let presentAt: SalvationCandidate["presentAt"] = "NONE";
    if (visitor.homecellPresent && visitor.churchPresent) presentAt = "BOTH";
    else if (visitor.homecellPresent) presentAt = "HOMECELL";
    else if (visitor.churchPresent) presentAt = "CHURCH";
    candidates.push({
      id: visitor.id,
      name: visitor.name,
      source: "VISITOR",
      eligible: presentAt !== "NONE",
      presentAt,
    });
  }

  for (const firstVisitor of firstVisitors) {
    if (!firstVisitor.id) continue;
    let presentAt: SalvationCandidate["presentAt"] = "NONE";
    if (firstVisitor.homecellPresent && firstVisitor.churchPresent) presentAt = "BOTH";
    else if (firstVisitor.homecellPresent) presentAt = "HOMECELL";
    else if (firstVisitor.churchPresent) presentAt = "CHURCH";
    candidates.push({
      id: firstVisitor.id,
      name: firstVisitor.name,
      source: "FTV",
      eligible: presentAt !== "NONE",
      presentAt,
    });
  }

  const unique = new Map<string, SalvationCandidate>();
  for (const candidate of candidates) {
    unique.set(toCandidateKey(candidate.source, candidate.id), candidate);
  }

  return Array.from(unique.values()).sort((a, b) => {
    const sourceRank: Record<SalvationCandidate["source"], number> = {
      MEMBER: 1,
      VISITOR: 2,
      FTV: 3,
    };
    return (sourceRank[a.source] ?? 99) - (sourceRank[b.source] ?? 99) || a.name.localeCompare(b.name);
  });
}

export default async function ReportingPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const context = await requireChurchContext();
  const churchId = assertChurch(context.churchId);
  const params = await searchParams;

  if (!hasPermission(context.role, "attendance:view")) {
    return (
      <Card>
        <CardTitle>Reporting Access Restricted</CardTitle>
        <CardDescription className="mt-1">Your role does not include weekly attendance reporting.</CardDescription>
      </Card>
    );
  }

  const scope = await resolveAttendanceScope({
    churchId,
    userId: context.userId,
    role: context.role,
  });
  const canSubmitHomecellMembers = hasPermission(context.role, "homecell_reports:submit");
  const scopedHomecellIds = scope.isFullAccess
    ? []
    : scope.homecellIds.length > 0
      ? scope.homecellIds
      : ["__no_scope__"];

  const selectedTab = parseTab(params.tab);
  const selectedDate = parseDateParam(params.date);
  const selectedDateKey = toDateKey(selectedDate);
  const weekStart = mondayUtcForDate(selectedDate);
  const weekEndExclusive = addDays(weekStart, 7);
  const weekEnd = addDays(weekStart, 6);

  const homecells = await db.homecell.findMany({
    where: {
      churchId,
      ...(scope.isFullAccess ? {} : { id: { in: scopedHomecellIds } }),
    },
    select: {
      id: true,
      name: true,
    },
    orderBy: { name: "asc" },
  });

  const selectedHomecellId = homecells.some((homecell) => homecell.id === params.homecellId)
    ? params.homecellId ?? ""
    : (homecells[0]?.id ?? "");

  const [churchSettings, selectedHomecellMembers, selectedHomecellWeekReport, visitorsThisWeek, firstTimeVisitorsThisWeek, salvationsThisWeek] =
    await Promise.all([
      db.church.findUnique({
        where: { id: churchId },
        select: {
          attendanceServiceLabels: true,
          attendanceMorningServiceLabels: true,
          attendanceEveningServiceLabels: true,
          attendanceOnlineServiceLabels: true,
        },
      }),
      selectedHomecellId
        ? db.member.findMany({
            where: {
              churchId,
              homecellId: selectedHomecellId,
              isDeleted: false,
              membershipStatus: "ACTIVE",
            },
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
            orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
          })
        : Promise.resolve([]),
      selectedHomecellId
        ? db.homecellReport.findUnique({
            where: {
              churchId_homecellId_weekStartDate: {
                churchId,
                homecellId: selectedHomecellId,
                weekStartDate: weekStart,
              },
            },
            select: {
              id: true,
              isLocked: true,
              visitors: true,
              firstTimeVisitors: true,
              visitorItems: true,
              firstTimeVisitorItems: true,
              salvationItems: true,
              memberItems: {
                select: {
                  memberId: true,
                  memberName: true,
                  present: true,
                  absenceReason: true,
                  absenceNote: true,
                  homecellPresent: true,
                  homecellAbsenceReason: true,
                  homecellAbsenceNote: true,
                  churchPresent: true,
                  churchAttendedLabels: true,
                  churchAbsenceReason: true,
                  churchAbsenceNote: true,
                  churchMorningPresent: true,
                  churchMorningAttendedLabel: true,
                  churchMorningAbsenceReason: true,
                  churchMorningAbsenceNote: true,
                  churchEveningPresent: true,
                  churchEveningAttendedLabel: true,
                  churchEveningAbsenceReason: true,
                  churchEveningAbsenceNote: true,
                },
              },
            },
          })
        : Promise.resolve(null),
      db.visitor.count({
        where: {
          churchId,
          firstVisitDate: {
            gte: weekStart,
            lt: weekEndExclusive,
          },
        },
      }),
      db.visitor.count({
        where: {
          churchId,
          firstTime: true,
          firstVisitDate: {
            gte: weekStart,
            lt: weekEndExclusive,
          },
        },
      }),
      db.visitor.count({
        where: {
          churchId,
          convertedToMember: true,
          firstVisitDate: {
            gte: weekStart,
            lt: weekEndExclusive,
          },
        },
      }),
    ]);

  const serviceLabels = churchSettings?.attendanceServiceLabels ?? [];
  const serviceGroups = {
    morning: churchSettings?.attendanceMorningServiceLabels ?? [],
    evening: churchSettings?.attendanceEveningServiceLabels ?? [],
    online: churchSettings?.attendanceOnlineServiceLabels ?? [],
  };

  const existingVisitorsItems = parseVisitorsAttendanceItems(selectedHomecellWeekReport?.visitorItems);
  const existingFirstVisitorsItems = parseVisitorsAttendanceItems(selectedHomecellWeekReport?.firstTimeVisitorItems);
  const existingSalvationItems = parseSalvationItems(selectedHomecellWeekReport?.salvationItems);
  const salvationCandidates = buildSalvationCandidates({
    members: selectedHomecellMembers,
    reportMemberItems: selectedHomecellWeekReport?.memberItems ?? [],
    visitors: existingVisitorsItems,
    firstVisitors: existingFirstVisitorsItems,
  });

  const activeHomecellName =
    homecells.find((homecell) => homecell.id === selectedHomecellId)?.name ?? "All scoped homecells";
  const tabContent = [
    {
      key: "members",
      label: "CRC Members",
      content: selectedHomecellId ? (
        <HomecellMembersReportForm
          homecellId={selectedHomecellId}
          weekStartDate={toDateKey(weekStart)}
          weekEndDate={toDateKey(weekEnd)}
          members={selectedHomecellMembers.map((member) => ({
            id: member.id,
            name: `${member.firstName} ${member.lastName}`,
          }))}
          existingItems={selectedHomecellWeekReport?.memberItems ?? []}
          serviceLabels={serviceLabels}
          serviceGroups={serviceGroups}
          canSubmit={canSubmitHomecellMembers}
          isLocked={selectedHomecellWeekReport?.isLocked ?? false}
        />
      ) : (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          No homecell is available in your scope yet. Ask admin to assign one.
        </div>
      ),
    },
    {
      key: "visitors",
      label: "Visitors",
      content: selectedHomecellId ? (
        <div className="space-y-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            System week visitors: <span className="font-semibold text-slate-900">{visitorsThisWeek}</span>
            {" | "}
            Reported visitors for this homecell: <span className="font-semibold text-slate-900">{selectedHomecellWeekReport?.visitors ?? 0}</span>
          </div>
          <VisitorsAttendanceReportForm
            mode="visitors"
            homecellId={selectedHomecellId}
            weekStartDate={toDateKey(weekStart)}
            weekEndDate={toDateKey(weekEnd)}
            existingItems={existingVisitorsItems}
            serviceGroups={serviceGroups}
            canSubmit={canSubmitHomecellMembers}
            isLocked={selectedHomecellWeekReport?.isLocked ?? false}
          />
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          Select a homecell to report visitors.
        </div>
      ),
    },
    {
      key: "first-visitors",
      label: "Ftvs",
      content: selectedHomecellId ? (
        <div className="space-y-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            System week first-time visitors: <span className="font-semibold text-slate-900">{firstTimeVisitorsThisWeek}</span>
            {" | "}
            Reported FTVs for this homecell: <span className="font-semibold text-slate-900">{selectedHomecellWeekReport?.firstTimeVisitors ?? 0}</span>
          </div>
          <VisitorsAttendanceReportForm
            mode="first-visitors"
            homecellId={selectedHomecellId}
            weekStartDate={toDateKey(weekStart)}
            weekEndDate={toDateKey(weekEnd)}
            existingItems={existingFirstVisitorsItems}
            serviceGroups={serviceGroups}
            canSubmit={canSubmitHomecellMembers}
            isLocked={selectedHomecellWeekReport?.isLocked ?? false}
          />
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          Select a homecell to report first-time visitors.
        </div>
      ),
    },
    {
      key: "salvations",
      label: "Salvations",
      content: selectedHomecellId ? (
        <div className="space-y-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            System week salvations metric: <span className="font-semibold text-slate-900">{salvationsThisWeek}</span>
            {" | "}
            Reported salvations entries:{" "}
            <span className="font-semibold text-slate-900">{existingSalvationItems.length}</span>
            {" | "}
            Eligible people:{" "}
            <span className="font-semibold text-slate-900">
              {salvationCandidates.filter((candidate) => candidate.eligible).length}
            </span>
          </div>
          <SalvationsReportForm
            homecellId={selectedHomecellId}
            weekStartDate={toDateKey(weekStart)}
            weekEndDate={toDateKey(weekEnd)}
            candidates={salvationCandidates}
            existingItems={existingSalvationItems}
            canSubmit={canSubmitHomecellMembers}
            isLocked={selectedHomecellWeekReport?.isLocked ?? false}
          />
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          Select a homecell to report salvations.
        </div>
      ),
    },
  ] satisfies Array<{ key: ReportingTab; label: string; content: React.ReactNode }>;

  return (
    <div className="space-y-6">
      <Card className="border-2 border-slate-300">
        <div className="border-b border-slate-300 pb-3">
          <h2 className="text-center text-3xl font-semibold tracking-wide text-slate-900">REPORTING</h2>
        </div>

        <div className="mt-4 flex flex-col gap-4 border-b border-slate-200 pb-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <p className="text-lg font-semibold text-slate-900">
              Date: <span className="font-normal">{format(selectedDate, "yyyy-MM-dd")}</span>
            </p>
            <form method="get" className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="tab" value={selectedTab} />
              <div>
                <p className="mb-1 text-xs text-slate-500">Report date</p>
                <input
                  type="date"
                  name="date"
                  defaultValue={selectedDateKey}
                  className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
                />
              </div>
              <div>
                <p className="mb-1 text-xs text-slate-500">Homecell(s)</p>
                <select
                  name="homecellId"
                  defaultValue={selectedHomecellId}
                  className="h-10 min-w-56 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
                >
                  <option value="">All scoped homecells</option>
                  {homecells.map((homecell) => (
                    <option key={homecell.id} value={homecell.id}>
                      {homecell.name}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                className="inline-flex h-10 items-center justify-center rounded-lg bg-sky-600 px-4 text-sm font-medium text-white hover:bg-sky-700"
              >
                Apply
              </button>
            </form>
          </div>

          <div className="space-y-2 text-right">
            <p className="text-lg font-semibold text-slate-900">
              Role: <span className="font-normal">{toStartCase(context.role)}</span>
            </p>
            <p className="text-sm text-slate-600">
              Week:{" "}
              <span className="font-medium">
                {format(weekStart, "yyyy-MM-dd")} to {format(weekEnd, "yyyy-MM-dd")}
              </span>
            </p>
            <p className="text-sm text-slate-600">
              Homecell: <span className="font-medium">{activeHomecellName}</span>
            </p>
          </div>
        </div>

        <div className="mt-4">
          <Tabs tabs={tabContent} defaultKey={selectedTab} />
        </div>

        {selectedHomecellWeekReport ? (
          <div className="mt-4">
            {selectedHomecellWeekReport.isLocked ? <Badge>Locked</Badge> : <Badge variant="success">Unlocked</Badge>}
          </div>
        ) : null}
      </Card>
    </div>
  );
}
