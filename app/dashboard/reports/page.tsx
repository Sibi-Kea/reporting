import { Prisma } from "@prisma/client";
import { startOfMonth, subWeeks } from "date-fns";

import { ReportsCharts } from "@/components/reports/reports-charts";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";
import { resolveAttendanceScope } from "@/lib/attendance-scope";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/rbac";
import { assertChurch, requireChurchContext } from "@/lib/tenant";
import { formatPercent } from "@/lib/utils";

type ParsedVisitorsAttendanceItem = {
  homecellPresent: boolean | null;
  churchPresent: boolean;
};

type ParsedSalvationItem = {
  source: "MEMBER" | "VISITOR" | "FTV";
  location: "HOMECELL" | "CHURCH";
};

function parseVisitorsAttendanceItems(value: Prisma.JsonValue | null | undefined): ParsedVisitorsAttendanceItem[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const source = item as Record<string, unknown>;

    const homecellPresent =
      typeof source.homecellPresent === "boolean"
        ? source.homecellPresent
        : source.homecellPresent === null
          ? null
          : null;
    const legacyPresent = typeof source.present === "boolean" ? source.present : false;
    const churchMorningPresent = typeof source.churchMorningPresent === "boolean" ? source.churchMorningPresent : false;
    const churchEveningPresent = typeof source.churchEveningPresent === "boolean" ? source.churchEveningPresent : false;
    const churchPresent =
      typeof source.churchPresent === "boolean"
        ? source.churchPresent
        : churchMorningPresent || churchEveningPresent || legacyPresent;

    return [{ homecellPresent, churchPresent }];
  });
}

function parseSalvationItems(value: Prisma.JsonValue | null | undefined): ParsedSalvationItem[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const source = item as Record<string, unknown>;

    const normalizedSource =
      source.source === "MEMBER" || source.source === "VISITOR" || source.source === "FTV" ? source.source : null;
    const normalizedLocation =
      source.location === "HOMECELL" || source.location === "CHURCH" ? source.location : null;
    if (!normalizedSource || !normalizedLocation) return [];

    return [{ source: normalizedSource, location: normalizedLocation }];
  });
}

function shortServiceLabel(value: string, maxLength = 18) {
  const cleaned = value.trim();
  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, maxLength - 3)}...`;
}

export default async function ReportsPage() {
  const context = await requireChurchContext();
  const churchId = assertChurch(context.churchId);

  if (!hasPermission(context.role, "homecell_reports:view")) {
    return (
      <Card>
        <CardTitle>Summary Access Restricted</CardTitle>
        <CardDescription className="mt-1">Your role does not include summary access.</CardDescription>
      </Card>
    );
  }

  const scope = await resolveAttendanceScope({
    churchId,
    userId: context.userId,
    role: context.role,
  });
  const scopedHomecellIds = scope.isFullAccess
    ? []
    : scope.homecellIds.length > 0
      ? scope.homecellIds
      : ["__no_scope__"];

  const monthStart = startOfMonth(new Date());
  const reportWindowStart = subWeeks(new Date(), 8);

  const [homecellsTotal, homecellReports, attendanceRecords, activeMembers] = await Promise.all([
    db.homecell.count({
      where: {
        churchId,
        ...(scope.isFullAccess ? {} : { id: { in: scopedHomecellIds } }),
      },
    }),
    db.homecellReport.findMany({
      where: {
        churchId,
        weekStartDate: { gte: reportWindowStart },
        ...(scope.isFullAccess ? {} : { homecellId: { in: scopedHomecellIds } }),
      },
      include: {
        homecell: { select: { name: true } },
      },
      orderBy: { weekStartDate: "desc" },
    }),
    db.attendanceRecord.findMany({
      where: {
        churchId,
        service: {
          eventDate: { gte: reportWindowStart },
        },
        ...(scope.isFullAccess
          ? {}
          : {
              entries: {
                some: {
                  member: {
                    homecellId: { in: scopedHomecellIds },
                  },
                },
              },
            }),
      },
      include: {
        entries: {
          where: scope.isFullAccess
            ? undefined
            : {
                member: {
                  homecellId: { in: scopedHomecellIds },
                },
              },
          select: {
            memberId: true,
            status: true,
          },
        },
        service: {
          select: {
            title: true,
            eventDate: true,
          },
        },
      },
      orderBy: {
        service: {
          eventDate: "asc",
        },
      },
    }),
    db.member.count({
      where: {
        churchId,
        isDeleted: false,
        membershipStatus: "ACTIVE",
        ...(scope.isFullAccess ? {} : { homecellId: { in: scopedHomecellIds } }),
      },
    }),
  ]);

  const monthReports = homecellReports.filter((report) => report.weekStartDate >= monthStart);
  const submittedHomecellsThisMonth = new Set(monthReports.map((report) => report.homecellId)).size;
  const pendingHomecellReports = Math.max(homecellsTotal - submittedHomecellsThisMonth, 0);
  const homecellCoverageRate = homecellsTotal ? (submittedHomecellsThisMonth / homecellsTotal) * 100 : 0;

  let membersReportedTotal = 0;
  let membersReportedPresent = 0;
  let membersReportedAbsent = 0;
  let visitorsReportedTotal = 0;
  let firstVisitorsReportedTotal = 0;
  let salvationsReportedTotal = 0;

  let monthVisitorsReported = 0;
  let monthFirstVisitorsReported = 0;
  let monthSalvationsReported = 0;

  let visitorsTracked = 0;
  let visitorsHomecellPresent = 0;
  let visitorsChurchPresent = 0;
  let firstVisitorsTracked = 0;
  let firstVisitorsHomecellPresent = 0;
  let firstVisitorsChurchPresent = 0;

  const salvationsBySource = {
    MEMBER: 0,
    VISITOR: 0,
    FTV: 0,
  };
  const salvationsByLocation = {
    HOMECELL: 0,
    CHURCH: 0,
  };

  const weeklyFlowMap = new Map<
    string,
    {
      date: string;
      membersPresent: number;
      visitors: number;
      firstTimeVisitors: number;
      salvations: number;
    }
  >();
  const reportSalvationTotals = new Map<string, number>();

  for (const report of homecellReports) {
    const weekKey = report.weekStartDate.toISOString().slice(0, 10);
    const reportVisitorsItems = parseVisitorsAttendanceItems(report.visitorItems);
    const reportFirstVisitorsItems = parseVisitorsAttendanceItems(report.firstTimeVisitorItems);
    const reportSalvations = parseSalvationItems(report.salvationItems);
    reportSalvationTotals.set(report.id, reportSalvations.length);

    membersReportedTotal += report.totalMembers;
    membersReportedPresent += report.membersPresent;
    membersReportedAbsent += report.membersAbsent;
    visitorsReportedTotal += report.visitors;
    firstVisitorsReportedTotal += report.firstTimeVisitors;
    salvationsReportedTotal += reportSalvations.length;

    if (report.weekStartDate >= monthStart) {
      monthVisitorsReported += report.visitors;
      monthFirstVisitorsReported += report.firstTimeVisitors;
      monthSalvationsReported += reportSalvations.length;
    }

    visitorsTracked += reportVisitorsItems.length;
    visitorsHomecellPresent += reportVisitorsItems.filter((item) => item.homecellPresent === true).length;
    visitorsChurchPresent += reportVisitorsItems.filter((item) => item.churchPresent).length;

    firstVisitorsTracked += reportFirstVisitorsItems.length;
    firstVisitorsHomecellPresent += reportFirstVisitorsItems.filter((item) => item.homecellPresent === true).length;
    firstVisitorsChurchPresent += reportFirstVisitorsItems.filter((item) => item.churchPresent).length;

    for (const salvation of reportSalvations) {
      salvationsBySource[salvation.source] += 1;
      salvationsByLocation[salvation.location] += 1;
    }

    const weekly = weeklyFlowMap.get(weekKey) ?? {
      date: weekKey,
      membersPresent: 0,
      visitors: 0,
      firstTimeVisitors: 0,
      salvations: 0,
    };
    weekly.membersPresent += report.membersPresent;
    weekly.visitors += report.visitors;
    weekly.firstTimeVisitors += report.firstTimeVisitors;
    weekly.salvations += reportSalvations.length;
    weeklyFlowMap.set(weekKey, weekly);
  }

  const serviceAttendanceMap = new Map<
    string,
    {
      total: number;
      present: number;
      online: number;
      absent: number;
    }
  >();

  for (const record of attendanceRecords) {
    const serviceTitle = record.service.title.trim().length > 0 ? record.service.title.trim() : "Untitled Service";
    const current = serviceAttendanceMap.get(serviceTitle) ?? {
      total: 0,
      present: 0,
      online: 0,
      absent: 0,
    };

    for (const entry of record.entries) {
      current.total += 1;
      if (entry.status === "ONLINE") {
        current.present += 1;
        current.online += 1;
      } else if (entry.status === "PRESENT") {
        current.present += 1;
      } else {
        current.absent += 1;
      }
    }

    serviceAttendanceMap.set(serviceTitle, current);
  }

  const churchAttendanceTotal = Array.from(serviceAttendanceMap.values()).reduce((acc, item) => acc + item.total, 0);
  const churchAttendancePresent = Array.from(serviceAttendanceMap.values()).reduce((acc, item) => acc + item.present, 0);
  const churchAttendanceOnline = Array.from(serviceAttendanceMap.values()).reduce((acc, item) => acc + item.online, 0);
  const churchAttendanceAbsent = Array.from(serviceAttendanceMap.values()).reduce((acc, item) => acc + item.absent, 0);
  const churchAttendanceRate = churchAttendanceTotal ? (churchAttendancePresent / churchAttendanceTotal) * 100 : 0;

  const serviceAttendanceRows = Array.from(serviceAttendanceMap.entries())
    .map(([service, totals]) => {
      const attendanceRate = totals.total ? (totals.present / totals.total) * 100 : 0;
      const shareOfChurch = churchAttendanceTotal ? (totals.total / churchAttendanceTotal) * 100 : 0;
      return {
        service,
        total: totals.total,
        present: totals.present,
        online: totals.online,
        absent: totals.absent,
        attendanceRate,
        shareOfChurch,
      };
    })
    .sort((a, b) => b.total - a.total || a.service.localeCompare(b.service));

  const homecellAttendanceRate = membersReportedTotal ? (membersReportedPresent / membersReportedTotal) * 100 : 0;
  const monthHomecellPresent = monthReports.reduce((acc, report) => acc + report.membersPresent, 0);
  const monthHomecellTotal = monthReports.reduce((acc, report) => acc + report.totalMembers, 0);
  const monthHomecellRate = monthHomecellTotal ? (monthHomecellPresent / monthHomecellTotal) * 100 : 0;

  const firstVisitorRate = visitorsReportedTotal ? (firstVisitorsReportedTotal / visitorsReportedTotal) * 100 : 0;
  const salvationFromFtvRate = firstVisitorsReportedTotal
    ? (salvationsReportedTotal / firstVisitorsReportedTotal) * 100
    : 0;

  const visitorsHomecellPresenceRate = visitorsTracked ? (visitorsHomecellPresent / visitorsTracked) * 100 : 0;
  const visitorsChurchPresenceRate = visitorsTracked ? (visitorsChurchPresent / visitorsTracked) * 100 : 0;
  const firstVisitorsHomecellPresenceRate = firstVisitorsTracked
    ? (firstVisitorsHomecellPresent / firstVisitorsTracked) * 100
    : 0;
  const firstVisitorsChurchPresenceRate = firstVisitorsTracked
    ? (firstVisitorsChurchPresent / firstVisitorsTracked) * 100
    : 0;

  const attendanceMix = [
    { name: "Homecell Members Present", value: membersReportedPresent },
    { name: "Church Present + Online", value: churchAttendancePresent },
    { name: "Visitors Church Present", value: visitorsChurchPresent },
    { name: "FTV Church Present", value: firstVisitorsChurchPresent },
  ];

  const ministryFlowRaw = [
    { stage: "CRC Members", total: activeMembers },
    { stage: "Reported Members", total: membersReportedTotal },
    { stage: "Visitors", total: visitorsReportedTotal },
    { stage: "First-time Visitors", total: firstVisitorsReportedTotal },
    { stage: "Salvations", total: salvationsReportedTotal },
  ];
  const ministryFlowRows = ministryFlowRaw.map((row, index) => ({
    ...row,
    percentOfMembers: activeMembers ? (row.total / activeMembers) * 100 : 0,
    percentFromPrevious:
      index === 0 ? 100 : ministryFlowRaw[index - 1].total ? (row.total / ministryFlowRaw[index - 1].total) * 100 : 0,
  }));

  const weeklyMinistry = Array.from(weeklyFlowMap.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((item) => ({
      label: item.date.slice(5),
      membersPresent: item.membersPresent,
      visitors: item.visitors,
      firstTimeVisitors: item.firstTimeVisitors,
      salvations: item.salvations,
    }));

  const serviceAttendanceChartData = serviceAttendanceRows.slice(0, 8).map((row) => ({
    service: shortServiceLabel(row.service),
    total: row.total,
    present: row.present,
  }));

  return (
    <div className="space-y-6">
      <Card>
        <CardTitle>Summary Center</CardTitle>
        <CardDescription className="mt-1">
          End-to-end summary for homecell attendance, church attendance by service, and ministry flow from CRC Members
          to Salvations.
        </CardDescription>
        <p className="mt-2 text-sm text-slate-600">
          Scope:{" "}
          <span className="font-medium">
            {scope.isFullAccess ? "Full church view" : `${scope.homecellIds.length} homecell(s) under your structure`}
          </span>
        </p>
        <p className="mt-1 text-sm text-slate-600">
          Data window: <span className="font-medium">last 8 weeks</span>.
        </p>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card>
          <p className="text-sm text-slate-500">CRC Members (Active)</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{activeMembers}</p>
          <p className="mt-1 text-xs text-slate-500">Current active members in your scope</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Homecell Attendance</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-700">{formatPercent(homecellAttendanceRate)}</p>
          <p className="mt-1 text-xs text-slate-500">
            {membersReportedPresent}/{membersReportedTotal} present ({membersReportedAbsent} absent) across submitted reports
          </p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Church Attendance</p>
          <p className="mt-1 text-2xl font-semibold text-sky-700">{formatPercent(churchAttendanceRate)}</p>
          <p className="mt-1 text-xs text-slate-500">
            {churchAttendancePresent}/{churchAttendanceTotal} present or online across all services
          </p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Visitors (Window)</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{visitorsReportedTotal}</p>
          <p className="mt-1 text-xs text-slate-500">
            {monthVisitorsReported} in current month
          </p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">First-Time Visitors</p>
          <p className="mt-1 text-2xl font-semibold text-purple-700">{firstVisitorsReportedTotal}</p>
          <p className="mt-1 text-xs text-slate-500">
            {formatPercent(firstVisitorRate)} of visitors
          </p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Salvations</p>
          <p className="mt-1 text-2xl font-semibold text-rose-700">{salvationsReportedTotal}</p>
          <p className="mt-1 text-xs text-slate-500">
            {formatPercent(salvationFromFtvRate)} of first-time visitors
          </p>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card>
          <p className="text-sm text-slate-500">Homecell Submission Coverage (Month)</p>
          <p className="mt-1 text-2xl font-semibold text-indigo-700">{formatPercent(homecellCoverageRate)}</p>
          <p className="mt-1 text-xs text-slate-500">
            {submittedHomecellsThisMonth}/{homecellsTotal} submitted | {pendingHomecellReports} pending
          </p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Month Homecell Attendance</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-700">{formatPercent(monthHomecellRate)}</p>
          <p className="mt-1 text-xs text-slate-500">
            {monthHomecellPresent}/{monthHomecellTotal} present this month
          </p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Visitors Homecell Attendance</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-700">{formatPercent(visitorsHomecellPresenceRate)}</p>
          <p className="mt-1 text-xs text-slate-500">
            {visitorsHomecellPresent}/{visitorsTracked} tracked visitors marked present in homecell
          </p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Visitors Church Attendance</p>
          <p className="mt-1 text-2xl font-semibold text-sky-700">{formatPercent(visitorsChurchPresenceRate)}</p>
          <p className="mt-1 text-xs text-slate-500">
            {visitorsChurchPresent}/{visitorsTracked} tracked visitors marked present in church
          </p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">FTV Homecell Attendance</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-700">{formatPercent(firstVisitorsHomecellPresenceRate)}</p>
          <p className="mt-1 text-xs text-slate-500">
            {firstVisitorsHomecellPresent}/{firstVisitorsTracked} tracked first-time visitors marked present in homecell
          </p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">FTV Church Attendance</p>
          <p className="mt-1 text-2xl font-semibold text-amber-700">{formatPercent(firstVisitorsChurchPresenceRate)}</p>
          <p className="mt-1 text-xs text-slate-500">
            {firstVisitorsChurchPresent}/{firstVisitorsTracked} tracked first-time visitors marked present in church
          </p>
        </Card>
      </div>

      <ReportsCharts
        serviceAttendance={serviceAttendanceChartData}
        weeklyMinistry={weeklyMinistry}
        attendanceMix={attendanceMix}
        ministryFlow={ministryFlowRows.map((row) => ({ stage: row.stage, total: row.total }))}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardTitle>Salvations By Source</CardTitle>
          <div className="mt-3 space-y-2 text-sm text-slate-700">
            <p>
              Members: <span className="font-semibold">{salvationsBySource.MEMBER}</span>
            </p>
            <p>
              Visitors: <span className="font-semibold">{salvationsBySource.VISITOR}</span>
            </p>
            <p>
              First-time Visitors: <span className="font-semibold">{salvationsBySource.FTV}</span>
            </p>
            <p className="pt-1 text-xs text-slate-500">Current month: {monthSalvationsReported}</p>
          </div>
        </Card>
        <Card>
          <CardTitle>Salvations By Location</CardTitle>
          <div className="mt-3 space-y-2 text-sm text-slate-700">
            <p>
              Homecell: <span className="font-semibold">{salvationsByLocation.HOMECELL}</span>
            </p>
            <p>
              Church: <span className="font-semibold">{salvationsByLocation.CHURCH}</span>
            </p>
            <p className="pt-1 text-xs text-slate-500">
              Month visitors: {monthVisitorsReported} | Month FTV: {monthFirstVisitorsReported}
            </p>
          </div>
        </Card>
      </div>

      <Card>
        <CardTitle>Church Attendance Per Service</CardTitle>
        <CardDescription className="mt-1">
          Totals are across the last 8 weeks, including online attendance.
        </CardDescription>
        <div className="mt-4 overflow-x-auto">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Service</TableHeaderCell>
                <TableHeaderCell className="text-right">Present</TableHeaderCell>
                <TableHeaderCell className="text-right">Online</TableHeaderCell>
                <TableHeaderCell className="text-right">Absent</TableHeaderCell>
                <TableHeaderCell className="text-right">Total</TableHeaderCell>
                <TableHeaderCell className="text-right">Attendance %</TableHeaderCell>
                <TableHeaderCell className="text-right">Share %</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {serviceAttendanceRows.map((row) => (
                <TableRow key={row.service}>
                  <TableCell>{row.service}</TableCell>
                  <TableCell className="text-right">{row.present}</TableCell>
                  <TableCell className="text-right">{row.online}</TableCell>
                  <TableCell className="text-right">{row.absent}</TableCell>
                  <TableCell className="text-right">{row.total}</TableCell>
                  <TableCell className="text-right">{formatPercent(row.attendanceRate)}</TableCell>
                  <TableCell className="text-right">{formatPercent(row.shareOfChurch)}</TableCell>
                </TableRow>
              ))}
              {serviceAttendanceRows.length > 0 ? (
                <TableRow>
                  <TableCell className="font-semibold text-slate-900">TOTAL</TableCell>
                  <TableCell className="text-right font-semibold text-slate-900">{churchAttendancePresent}</TableCell>
                  <TableCell className="text-right font-semibold text-slate-900">{churchAttendanceOnline}</TableCell>
                  <TableCell className="text-right font-semibold text-slate-900">{churchAttendanceAbsent}</TableCell>
                  <TableCell className="text-right font-semibold text-slate-900">{churchAttendanceTotal}</TableCell>
                  <TableCell className="text-right font-semibold text-slate-900">
                    {formatPercent(churchAttendanceRate)}
                  </TableCell>
                  <TableCell className="text-right font-semibold text-slate-900">100.0%</TableCell>
                </TableRow>
              ) : null}
              {serviceAttendanceRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-slate-500">
                    No service attendance records found for this period.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Card>
        <CardTitle>CRC Members To Salvations Summary</CardTitle>
        <CardDescription className="mt-1">Pipeline totals with percentages against members and previous stage.</CardDescription>
        <div className="mt-4 overflow-x-auto">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Stage</TableHeaderCell>
                <TableHeaderCell className="text-right">Total</TableHeaderCell>
                <TableHeaderCell className="text-right">% Of CRC Members</TableHeaderCell>
                <TableHeaderCell className="text-right">% From Previous Stage</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {ministryFlowRows.map((row, index) => (
                <TableRow key={row.stage}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span>{row.stage}</span>
                      {index === ministryFlowRows.length - 1 ? <Badge variant="success">Outcome</Badge> : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{row.total}</TableCell>
                  <TableCell className="text-right">{formatPercent(row.percentOfMembers)}</TableCell>
                  <TableCell className="text-right">{formatPercent(row.percentFromPrevious)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Card>
        <CardTitle>Latest Homecell Submissions</CardTitle>
        <CardDescription className="mt-1">Recent reports with members, visitors, first-time visitors, and salvations.</CardDescription>
        <div className="mt-4 overflow-x-auto">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Week</TableHeaderCell>
                <TableHeaderCell>Homecell</TableHeaderCell>
                <TableHeaderCell className="text-right">Members P/T</TableHeaderCell>
                <TableHeaderCell className="text-right">Visitors</TableHeaderCell>
                <TableHeaderCell className="text-right">FTV</TableHeaderCell>
                <TableHeaderCell className="text-right">Salvations</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {homecellReports.slice(0, 12).map((report) => (
                <TableRow key={report.id}>
                  <TableCell>{report.weekStartDate.toISOString().slice(0, 10)}</TableCell>
                  <TableCell>{report.homecell.name}</TableCell>
                  <TableCell className="text-right">
                    {report.membersPresent}/{report.totalMembers}
                  </TableCell>
                  <TableCell className="text-right">{report.visitors}</TableCell>
                  <TableCell className="text-right">{report.firstTimeVisitors}</TableCell>
                  <TableCell className="text-right">{reportSalvationTotals.get(report.id) ?? 0}</TableCell>
                  <TableCell>
                    {report.isLocked ? <Badge>Locked</Badge> : <Badge variant="success">Unlocked</Badge>}
                  </TableCell>
                </TableRow>
              ))}
              {homecellReports.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-slate-500">
                    No homecell reports found in the selected window.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
