import { db } from "@/lib/db";
import { toCsv } from "@/lib/csv";

import { csvResponse, requireExportAccess } from "@/app/api/exports/_helpers";

export async function GET() {
  const access = await requireExportAccess();
  if ("response" in access) return access.response;
  const churchId = access.churchId;

  const members = await db.member.findMany({
    where: { churchId, isDeleted: false },
    include: {
      homecell: { select: { name: true } },
      department: { select: { name: true } },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const rows = members.map((member) => ({
    id: member.id,
    firstName: member.firstName,
    lastName: member.lastName,
    gender: member.gender,
    phone: member.phone ?? "",
    email: member.email ?? "",
    address: member.address ?? "",
    maritalStatus: member.maritalStatus ?? "",
    occupation: member.occupation ?? "",
    emergencyContactName: member.emergencyContactName ?? "",
    emergencyContactPhone: member.emergencyContactPhone ?? "",
    membershipStatus: member.membershipStatus,
    salvationStatus: member.salvationStatus ? "YES" : "NO",
    waterBaptismStatus: member.baptismStatus ? "YES" : "NO",
    holySpiritBaptismStatus: member.holySpiritBaptismStatus ? "YES" : "NO",
    jimJohn316Status: member.jimJohn316Status ? "YES" : "NO",
    jimSgtStatus: member.jimSgtStatus ? "YES" : "NO",
    jimDiscStatus: member.jimDiscStatus ? "YES" : "NO",
    jimNltStatus: member.jimNltStatus ? "YES" : "NO",
    involvementNotes: member.involvementNotes ?? "",
    homecell: member.homecell?.name ?? "",
    department: member.department?.name ?? "",
    dateJoined: member.dateJoined.toISOString().slice(0, 10),
  }));

  return csvResponse(toCsv(rows), `members-${new Date().toISOString().slice(0, 10)}.csv`);
}
