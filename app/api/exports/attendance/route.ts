import { db } from "@/lib/db";
import { toCsv } from "@/lib/csv";

import { csvResponse, requireExportAccess } from "@/app/api/exports/_helpers";

export async function GET() {
  const access = await requireExportAccess();
  if ("response" in access) return access.response;
  const churchId = access.churchId;

  const entries = await db.attendanceEntry.findMany({
    where: { churchId },
    include: {
      attendance: {
        include: {
          service: { select: { title: true, eventDate: true } },
        },
      },
      member: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const rows = entries.map((entry) => ({
    serviceTitle: entry.attendance.service.title,
    serviceDate: entry.attendance.service.eventDate.toISOString().slice(0, 10),
    member: `${entry.member.firstName} ${entry.member.lastName}`,
    status: entry.status,
    absentReason: entry.absentReason ?? "",
    absentNote: entry.absentNote ?? "",
  }));

  return csvResponse(toCsv(rows), `attendance-${new Date().toISOString().slice(0, 10)}.csv`);
}
