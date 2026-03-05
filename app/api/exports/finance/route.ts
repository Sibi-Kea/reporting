import { db } from "@/lib/db";
import { toCsv } from "@/lib/csv";

import { csvResponse, requireExportAccess } from "@/app/api/exports/_helpers";

export async function GET() {
  const access = await requireExportAccess();
  if ("response" in access) return access.response;
  const churchId = access.churchId;

  const rows = await db.financeTransaction.findMany({
    where: { churchId },
    include: {
      member: { select: { firstName: true, lastName: true } },
      service: { select: { title: true } },
      capturedBy: { select: { name: true } },
    },
    orderBy: { transactionDate: "desc" },
  });

  return csvResponse(
    toCsv(
      rows.map((row) => ({
        date: row.transactionDate.toISOString().slice(0, 10),
        type: row.financeType,
        amount: Number(row.amount),
        paymentMethod: row.paymentMethod,
        member: row.member ? `${row.member.firstName} ${row.member.lastName}` : "",
        service: row.service?.title ?? "",
        capturedBy: row.capturedBy.name,
        note: row.note ?? "",
      })),
    ),
    `finance-${new Date().toISOString().slice(0, 10)}.csv`,
  );
}
