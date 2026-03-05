import { MembershipStatus } from "@prisma/client";
import { addMonths, startOfMonth, subMonths } from "date-fns";

import { db } from "@/lib/db";

export async function getDashboardMetrics(churchId: string, referenceDate: Date = new Date()) {
  const monthStart = startOfMonth(referenceDate);
  const monthEnd = startOfMonth(addMonths(monthStart, 1));
  const [
    totalMembers,
    activeMembers,
    inactiveMembers,
    visitorsThisMonth,
    financeThisMonth,
    unreadNotifications,
  ] = await Promise.all([
    db.member.count({ where: { churchId, isDeleted: false } }),
    db.member.count({
      where: { churchId, isDeleted: false, membershipStatus: MembershipStatus.ACTIVE },
    }),
    db.member.count({
      where: { churchId, isDeleted: false, membershipStatus: MembershipStatus.INACTIVE },
    }),
    db.visitor.count({
      where: {
        churchId,
        firstVisitDate: {
          gte: monthStart,
          lt: monthEnd,
        },
      },
    }),
    db.financeTransaction.aggregate({
      _sum: { amount: true },
      where: {
        churchId,
        transactionDate: {
          gte: monthStart,
          lt: monthEnd,
        },
      },
    }),
    db.notification.count({ where: { churchId, isRead: false } }),
  ]);

  return {
    totalMembers,
    activeMembers,
    inactiveMembers,
    visitorsThisMonth,
    financeThisMonth: Number(financeThisMonth._sum.amount ?? 0),
    unreadNotifications,
  };
}

export async function getAttendanceTrend(churchId: string, referenceDate: Date = new Date()) {
  const monthStart = startOfMonth(referenceDate);
  const monthEnd = startOfMonth(addMonths(monthStart, 1));
  const sixMonthsAgo = startOfMonth(subMonths(monthStart, 5));
  const records = await db.attendanceRecord.findMany({
    where: {
      churchId,
      service: {
        eventDate: {
          gte: sixMonthsAgo,
          lt: monthEnd,
        },
      },
    },
    include: {
      entries: true,
      service: true,
    },
    orderBy: {
      service: {
        eventDate: "asc",
      },
    },
  });

  return records.map((record) => {
    const present = record.entries.filter((entry) => entry.status === "PRESENT" || entry.status === "ONLINE").length;
    const total = record.entries.length;
    return {
      date: record.service.eventDate.toISOString().slice(0, 10),
      present,
      absent: total - present,
      attendanceRate: total ? (present / total) * 100 : 0,
    };
  });
}

export async function getGrowthTrend(churchId: string, referenceDate: Date = new Date()) {
  const monthStart = startOfMonth(referenceDate);
  const months = Array.from({ length: 6 }).map((_, index) => startOfMonth(subMonths(monthStart, 5 - index)));

  const growthData = await Promise.all(
    months.map(async (monthStart) => {
      const nextMonth = startOfMonth(subMonths(monthStart, -1));
      const count = await db.member.count({
        where: {
          churchId,
          isDeleted: false,
          dateJoined: {
            gte: monthStart,
            lt: nextMonth,
          },
        },
      });
      return {
        month: monthStart.toLocaleString("en-US", { month: "short" }),
        joined: count,
      };
    }),
  );

  return growthData;
}
