import { db } from "@/lib/db";
import { toCsv } from "@/lib/csv";

import { csvResponse, requireExportAccess } from "@/app/api/exports/_helpers";

export async function GET() {
  const access = await requireExportAccess();
  if ("response" in access) return access.response;
  const churchId = access.churchId;

  const visitors = await db.visitor.findMany({
    where: { churchId },
    orderBy: { createdAt: "desc" },
  });

  return csvResponse(
    toCsv(
      visitors.map((visitor) => ({
        firstName: visitor.firstName,
        lastName: visitor.lastName ?? "",
        phone: visitor.phone,
        invitedBy: visitor.invitedBy ?? "",
        firstTime: visitor.firstTime,
        followUpStatus: visitor.followUpStatus,
        convertedToMember: visitor.convertedToMember,
        firstVisitDate: visitor.firstVisitDate.toISOString().slice(0, 10),
      })),
    ),
    `visitors-${new Date().toISOString().slice(0, 10)}.csv`,
  );
}
