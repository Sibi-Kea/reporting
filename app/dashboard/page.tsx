import Link from "next/link";
import { Activity, Building2, DollarSign, Users, UserRoundPlus, Bell } from "lucide-react";
import { Role } from "@prisma/client";
import { format } from "date-fns";

import { OverviewCharts } from "@/components/dashboard/overview-charts";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { db } from "@/lib/db";
import { getAttendanceTrend, getDashboardMetrics, getGrowthTrend } from "@/lib/services/dashboard";
import { assertChurch, requireChurchContext } from "@/lib/tenant";

type SearchParams = {
  statsMonth?: string;
};

function parseStatsMonth(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  }
  const [yearRaw, monthRaw] = value.split("-");
  const year = Number(yearRaw);
  const monthIndex = Number(monthRaw) - 1;
  if (!Number.isInteger(year) || !Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  }
  return new Date(Date.UTC(year, monthIndex, 1));
}

function monthWindow(monthStartUtc: Date) {
  const start = new Date(Date.UTC(monthStartUtc.getUTCFullYear(), monthStartUtc.getUTCMonth(), 1));
  const end = new Date(Date.UTC(monthStartUtc.getUTCFullYear(), monthStartUtc.getUTCMonth() + 1, 1));
  return { start, end };
}

function buildCalendarDays(monthStartUtc: Date) {
  const monthEnd = new Date(Date.UTC(monthStartUtc.getUTCFullYear(), monthStartUtc.getUTCMonth() + 1, 0));
  const gridStart = new Date(monthStartUtc);
  gridStart.setUTCDate(gridStart.getUTCDate() - gridStart.getUTCDay());
  const gridEnd = new Date(monthEnd);
  gridEnd.setUTCDate(gridEnd.getUTCDate() + (6 - gridEnd.getUTCDay()));

  const days: Date[] = [];
  for (let cursor = new Date(gridStart); cursor <= gridEnd; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    days.push(new Date(cursor));
  }
  return days;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const context = await requireChurchContext();
  const params = await searchParams;
  const selectedMonthDate = parseStatsMonth(params.statsMonth);
  const selectedMonthWindow = monthWindow(selectedMonthDate);
  const selectedMonth = format(selectedMonthDate, "yyyy-MM");
  const selectedMonthLabel = format(selectedMonthDate, "MMMM yyyy");

  if (context.role === Role.SUPER_ADMIN && !context.churchId) {
    const [churches, users, members] = await Promise.all([
      db.church.count(),
      db.user.count(),
      db.member.count({ where: { isDeleted: false } }),
    ]);

    const latestChurches = await db.church.findMany({
      take: 8,
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, slug: true, createdAt: true },
    });

    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard label="Total Churches" value={churches} icon={Building2} />
          <StatCard label="Total Staff Users" value={users} icon={Users} />
          <StatCard label="Total Members" value={members} icon={Activity} />
        </div>
        <Card>
          <CardTitle>Recent Church Onboarding</CardTitle>
          <CardDescription className="mt-1">
            Super admin visibility across all tenants.
          </CardDescription>
          <div className="mt-4 space-y-2">
            {latestChurches.map((church) => (
              <div
                key={church.id}
                className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm"
              >
                <span className="font-medium text-slate-700">{church.name}</span>
                <span className="text-slate-500">{church.slug}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    );
  }

  const churchId = assertChurch(context.churchId);
  const [metrics, attendanceTrend, growthTrend, genderBreakdown, monthAttendanceRecords] = await Promise.all([
    getDashboardMetrics(churchId, selectedMonthDate),
    getAttendanceTrend(churchId, selectedMonthDate),
    getGrowthTrend(churchId, selectedMonthDate),
    db.member.groupBy({
      by: ["gender"],
      _count: {
        gender: true,
      },
      where: {
        churchId,
        isDeleted: false,
      },
    }),
    db.attendanceRecord.findMany({
      where: {
        churchId,
        service: {
          eventDate: {
            gte: selectedMonthWindow.start,
            lt: selectedMonthWindow.end,
          },
        },
      },
      select: {
        service: {
          select: {
            eventDate: true,
          },
        },
        entries: {
          select: {
            status: true,
          },
        },
      },
    }),
  ]);

  const genderDistribution = genderBreakdown.map((item) => ({
    name: item.gender,
    value: item._count.gender,
  }));
  const activeRate = metrics.totalMembers
    ? (metrics.activeMembers / metrics.totalMembers) * 100
    : 0;
  const averageAttendanceRate = attendanceTrend.length
    ? attendanceTrend.reduce((acc, item) => acc + item.attendanceRate, 0) /
      attendanceTrend.length
    : 0;
  const dailyStatsMap = new Map<string, { services: number; attended: number; total: number }>();
  for (const record of monthAttendanceRecords) {
    const key = record.service.eventDate.toISOString().slice(0, 10);
    const current = dailyStatsMap.get(key) ?? { services: 0, attended: 0, total: 0 };
    current.services += 1;
    current.total += record.entries.length;
    current.attended += record.entries.filter((entry) => entry.status === "PRESENT" || entry.status === "ONLINE").length;
    dailyStatsMap.set(key, current);
  }
  const calendarDays = buildCalendarDays(selectedMonthWindow.start).map((date) => {
    const key = date.toISOString().slice(0, 10);
    const stats = dailyStatsMap.get(key) ?? { services: 0, attended: 0, total: 0 };
    const inSelectedMonth =
      date.getUTCFullYear() === selectedMonthWindow.start.getUTCFullYear() &&
      date.getUTCMonth() === selectedMonthWindow.start.getUTCMonth();
    return {
      key,
      date,
      stats,
      inSelectedMonth,
      attendanceRate: stats.total ? (stats.attended / stats.total) * 100 : 0,
    };
  });
  const calendarLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

  return (
    <div className="space-y-6">
      <Card>
        <CardTitle>Dashboard Calendar</CardTitle>
        <CardDescription className="mt-1">
          Browse stats by month and review historical performance.
        </CardDescription>
        <form method="get" className="mt-4 flex flex-wrap items-end gap-3">
          <div>
            <p className="mb-1 text-xs text-slate-500">Stats month</p>
            <input
              type="month"
              name="statsMonth"
              defaultValue={selectedMonth}
              className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
            />
          </div>
          <button
            type="submit"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-sky-600 px-4 text-sm font-medium text-white hover:bg-sky-700"
          >
            Load
          </button>
          <p className="text-sm text-slate-600">
            Viewing: <span className="font-medium">{selectedMonthLabel}</span>
          </p>
        </form>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Total Members" value={metrics.totalMembers} subtitle="Across all departments" icon={Users} />
        <StatCard
          label="Active Members"
          value={metrics.activeMembers}
          subtitle={`Active rate ${formatPercent(activeRate)}`}
          icon={Activity}
        />
        <StatCard label="Inactive Members" value={metrics.inactiveMembers} subtitle="Needs follow-up" icon={Bell} />
        <StatCard
          label="Visitors In Month"
          value={metrics.visitorsThisMonth}
          subtitle={selectedMonthLabel}
          icon={UserRoundPlus}
        />
        <StatCard
          label="Giving In Month"
          value={formatCurrency(metrics.financeThisMonth)}
          subtitle={selectedMonthLabel}
          icon={DollarSign}
        />
        <StatCard
          label="Average Attendance"
          value={formatPercent(averageAttendanceRate)}
          subtitle={`${metrics.unreadNotifications} unread notifications`}
          icon={Bell}
        />
      </div>

      <Card>
        <CardTitle>Daily Stats Calendar</CardTitle>
        <CardDescription className="mt-1">
          Review church stats by date. Select a day to open Attendance for that date.
        </CardDescription>
        <div className="mt-4 grid grid-cols-7 gap-2 text-xs font-medium text-slate-500">
          {calendarLabels.map((label) => (
            <p key={label} className="rounded-md bg-slate-50 py-1 text-center">
              {label}
            </p>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-7">
          {calendarDays.map((day) =>
            day.inSelectedMonth ? (
              <Link
                key={day.key}
                href={`/dashboard/attendance?servicesMonth=${selectedMonth}&serviceDate=${day.key}`}
                className="rounded-xl border border-slate-200 bg-white p-2 hover:border-sky-300 hover:bg-sky-50/40"
              >
                <p className="text-xs font-semibold text-slate-800">{day.date.getUTCDate()}</p>
                <p className="mt-2 text-[11px] text-slate-600">
                  Services: <span className="font-medium">{day.stats.services}</span>
                </p>
                <p className="text-[11px] text-slate-600">
                  Rate: <span className="font-medium">{formatPercent(day.attendanceRate)}</span>
                </p>
              </Link>
            ) : (
              <div
                key={day.key}
                className="rounded-xl border border-slate-100 bg-slate-50/60 p-2"
              >
                <p className="text-xs font-semibold text-slate-400">{day.date.getUTCDate()}</p>
                <p className="mt-2 text-[11px] text-slate-400">Outside month</p>
              </div>
            ),
          )}
        </div>
      </Card>

      <OverviewCharts
        attendanceTrend={attendanceTrend.map((item) => ({
          date: item.date.slice(5),
          attendanceRate: Number(item.attendanceRate.toFixed(1)),
        }))}
        growthTrend={growthTrend}
        genderDistribution={genderDistribution}
      />
    </div>
  );
}
