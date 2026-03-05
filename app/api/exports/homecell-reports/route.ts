import { db } from "@/lib/db";
import { toCsv } from "@/lib/csv";

import { csvResponse, requireExportAccess } from "@/app/api/exports/_helpers";

export async function GET() {
  const access = await requireExportAccess();
  if ("response" in access) return access.response;
  const churchId = access.churchId;

  const reports = await db.homecellReport.findMany({
    where: { churchId },
    include: {
      homecell: { select: { name: true } },
      submittedBy: { select: { name: true } },
    },
    orderBy: { weekStartDate: "desc" },
  });

  return csvResponse(
    toCsv(
      reports.map((report) => ({
        weekStart: report.weekStartDate.toISOString().slice(0, 10),
        weekEnd: report.weekEndDate.toISOString().slice(0, 10),
        homecell: report.homecell.name,
        submittedBy: report.submittedBy.name,
        totalMembers: report.totalMembers,
        membersPresent: report.membersPresent,
        membersAbsent: report.membersAbsent,
        visitors: report.visitors,
        firstTimeVisitors: report.firstTimeVisitors,
        offeringCollected: Number(report.offeringCollected ?? 0),
      })),
    ),
    `homecell-reports-${new Date().toISOString().slice(0, 10)}.csv`,
  );
}
