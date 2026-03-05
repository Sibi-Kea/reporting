import { startOfMonth, subMonths } from "date-fns";

import { AnalyticsCharts } from "@/components/analytics/analytics-charts";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/rbac";
import { assertChurch, requireChurchContext } from "@/lib/tenant";
import { formatPercent } from "@/lib/utils";

function buildAgeGroup(age: number) {
  if (age < 18) return "<18";
  if (age <= 25) return "18-25";
  if (age <= 35) return "26-35";
  if (age <= 50) return "36-50";
  return "50+";
}

export default async function AnalyticsPage() {
  const context = await requireChurchContext();
  const churchId = assertChurch(context.churchId);

  if (!hasPermission(context.role, "analytics:view")) {
    return (
      <Card>
        <CardTitle>Analytics Access Restricted</CardTitle>
        <CardDescription className="mt-1">Your role does not include analytics access.</CardDescription>
      </Card>
    );
  }

  const monthStart = startOfMonth(new Date());
  const previousMonthStart = startOfMonth(subMonths(new Date(), 1));

  const [
    totalMembers,
    activeMembers,
    inactiveMembers,
    membersThisMonth,
    membersPreviousMonth,
    genderRows,
    maritalRows,
    memberBirthdays,
    latestLtvRows,
    homecellReports,
  ] = await Promise.all([
    db.member.count({ where: { churchId, isDeleted: false } }),
    db.member.count({
      where: {
        churchId,
        isDeleted: false,
        membershipStatus: "ACTIVE",
      },
    }),
    db.member.count({
      where: {
        churchId,
        isDeleted: false,
        membershipStatus: "INACTIVE",
      },
    }),
    db.member.count({
      where: {
        churchId,
        isDeleted: false,
        dateJoined: { gte: monthStart },
      },
    }),
    db.member.count({
      where: {
        churchId,
        isDeleted: false,
        dateJoined: { gte: previousMonthStart, lt: monthStart },
      },
    }),
    db.member.groupBy({
      by: ["gender"],
      where: { churchId, isDeleted: false },
      _count: { _all: true },
    }),
    db.member.groupBy({
      by: ["maritalStatus"],
      where: { churchId, isDeleted: false },
      _count: { _all: true },
    }),
    db.member.findMany({
      where: { churchId, isDeleted: false, dateOfBirth: { not: null } },
      select: { dateOfBirth: true },
    }),
    db.memberLtvStatus.findMany({
      where: {
        churchId,
        monthStartDate: monthStart,
      },
      select: { isLeader: true, isTither: true, isVolunteer: true },
    }),
    db.homecellReport.findMany({
      where: { churchId },
      select: {
        homecell: { select: { name: true } },
        membersPresent: true,
        totalMembers: true,
      },
      take: 60,
      orderBy: { weekStartDate: "desc" },
    }),
  ]);

  const growthRate = membersPreviousMonth
    ? ((membersThisMonth - membersPreviousMonth) / membersPreviousMonth) * 100
    : membersThisMonth > 0
      ? 100
      : 0;

  const ageGroupsMap = new Map<string, number>([
    ["<18", 0],
    ["18-25", 0],
    ["26-35", 0],
    ["36-50", 0],
    ["50+", 0],
  ]);
  for (const item of memberBirthdays) {
    if (!item.dateOfBirth) continue;
    const age = Math.floor(
      (monthStart.getTime() - item.dateOfBirth.getTime()) / (1000 * 60 * 60 * 24 * 365.25),
    );
    const bucket = buildAgeGroup(age);
    ageGroupsMap.set(bucket, (ageGroupsMap.get(bucket) ?? 0) + 1);
  }

  const ltvDistribution = [
    {
      name: "Leader",
      value: latestLtvRows.filter((item) => item.isLeader).length,
    },
    {
      name: "Tither",
      value: latestLtvRows.filter((item) => item.isTither).length,
    },
    {
      name: "Volunteer",
      value: latestLtvRows.filter((item) => item.isVolunteer).length,
    },
  ];

  const attendanceMap = new Map<string, { present: number; total: number }>();
  for (const report of homecellReports) {
    const key = report.homecell.name;
    const current = attendanceMap.get(key) ?? { present: 0, total: 0 };
    current.present += report.membersPresent;
    current.total += report.totalMembers;
    attendanceMap.set(key, current);
  }
  const attendanceHomecells = Array.from(attendanceMap.entries())
    .map(([name, value]) => ({
      name,
      attendanceRate: value.total ? Number(((value.present / value.total) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.attendanceRate - a.attendanceRate)
    .slice(0, 10);

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Demographics & Analytics</CardTitle>
            <CardDescription className="mt-1">
              Membership, growth, attendance performance, and LTV distribution.
            </CardDescription>
          </div>
          <form action="/api/ltv/recalculate" method="post">
            <Button type="submit">Recalculate LTV</Button>
          </form>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <p className="text-sm text-slate-500">Total Members</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{totalMembers}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Active vs Inactive</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">
            {activeMembers} / {inactiveMembers}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Growth Rate</p>
          <p className="mt-1 text-2xl font-semibold text-sky-700">{formatPercent(growthRate)}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">LTV Snapshots</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-700">{latestLtvRows.length}</p>
        </Card>
      </div>

      <AnalyticsCharts
        genderDistribution={genderRows.map((row) => ({ name: row.gender, value: row._count._all }))}
        ageGroups={Array.from(ageGroupsMap.entries()).map(([name, value]) => ({ name, value }))}
        maritalStatus={maritalRows.map((row) => ({
          name: row.maritalStatus ?? "Unknown",
          value: row._count._all,
        }))}
        ltvDistribution={ltvDistribution}
        attendanceHomecells={attendanceHomecells}
      />
    </div>
  );
}
