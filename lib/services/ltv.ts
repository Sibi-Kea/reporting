import { FinanceType } from "@prisma/client";
import { endOfMonth, startOfMonth, subMonths } from "date-fns";

import { db } from "@/lib/db";

type LtvConfig = {
  titheCountThreshold: number;
  titheWindowMonths: number;
  volunteerAttendanceThreshold: number;
};

const defaultConfig: LtvConfig = {
  titheCountThreshold: 3,
  titheWindowMonths: 3,
  volunteerAttendanceThreshold: 70,
};

export async function recalculateMonthlyLtv(churchId: string, config: Partial<LtvConfig> = {}) {
  const settings = { ...defaultConfig, ...config };
  const currentMonthStart = startOfMonth(new Date());
  const currentMonthEnd = endOfMonth(new Date());
  const titheWindowStart = startOfMonth(subMonths(new Date(), settings.titheWindowMonths - 1));

  const members = await db.member.findMany({
    where: { churchId, isDeleted: false },
    include: {
      department: true,
      attendanceEntries: {
        where: {
          attendance: {
            service: {
              eventDate: {
                gte: currentMonthStart,
                lte: currentMonthEnd,
              },
            },
          },
        },
      },
      financeTransactions: {
        where: {
          financeType: FinanceType.TITHE,
          transactionDate: {
            gte: titheWindowStart,
            lte: currentMonthEnd,
          },
        },
      },
    },
  });

  await db.$transaction(
    members.map((member) => {
      const attendanceEntries = member.attendanceEntries;
      const presentCount = attendanceEntries.filter((entry) => entry.status === "PRESENT" || entry.status === "ONLINE").length;
      const attendanceRate = attendanceEntries.length
        ? (presentCount / attendanceEntries.length) * 100
        : 0;
      const isLeader = Boolean(member.homecellId || member.zoneId || member.regionId);
      const isTither = member.financeTransactions.length >= settings.titheCountThreshold;
      const isVolunteer = Boolean(member.departmentId) && attendanceRate >= settings.volunteerAttendanceThreshold;
      const badgeCount = [isLeader, isTither, isVolunteer].filter(Boolean).length;

      return db.memberLtvStatus.upsert({
        where: {
          churchId_memberId_monthStartDate: {
            churchId,
            memberId: member.id,
            monthStartDate: currentMonthStart,
          },
        },
        update: {
          isLeader,
          isTither,
          isVolunteer,
          attendanceRate,
          badgeCount,
        },
        create: {
          churchId,
          memberId: member.id,
          monthStartDate: currentMonthStart,
          isLeader,
          isTither,
          isVolunteer,
          attendanceRate,
          badgeCount,
        },
      });
    }),
  );

  return { updatedCount: members.length, monthStartDate: currentMonthStart };
}
