import { Role } from "@prisma/client";
import { redirect } from "next/navigation";

import { ChurchSettingsForm } from "@/components/admin/church-settings-form";
import { StructureForm } from "@/components/admin/structure-form";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";
import { db } from "@/lib/db";
import { requireChurchContext } from "@/lib/tenant";

export default async function AdminChurchesPage() {
  const context = await requireChurchContext();
  if (context.role !== Role.SUPER_ADMIN) {
    redirect("/dashboard");
  }

  if (!context.churchId) {
    const churches = await db.church.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        attendanceServiceLabels: true,
        attendanceMorningServiceLabels: true,
        attendanceEveningServiceLabels: true,
        attendanceOnlineServiceLabels: true,
      },
      orderBy: { name: "asc" },
    });

    return (
      <div className="space-y-6">
        <ChurchSettingsForm churches={churches} currentChurchId={null} />
        <Card>
          <CardTitle>Structure Setup</CardTitle>
          <CardDescription className="mt-1">
            Create at least one church to begin region, zone, and homecell setup.
          </CardDescription>
        </Card>
      </div>
    );
  }

  const [church, churches, leaders, regions, zones, homecells, members, structureLeaders] = await Promise.all([
    db.church.findUnique({
      where: { id: context.churchId },
      select: {
        id: true,
        name: true,
        slug: true,
        attendanceServiceLabels: true,
        attendanceMorningServiceLabels: true,
        attendanceEveningServiceLabels: true,
        attendanceOnlineServiceLabels: true,
      },
    }),
    db.church.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        attendanceServiceLabels: true,
        attendanceMorningServiceLabels: true,
        attendanceEveningServiceLabels: true,
        attendanceOnlineServiceLabels: true,
      },
      orderBy: { name: "asc" },
    }),
    db.user.findMany({
      where: {
        churchId: context.churchId,
        role: {
          in: [
            Role.PASTOR,
            Role.OVERSEER,
            Role.SUPERVISOR,
            Role.COORDINATOR,
            Role.HOMECELL_LEADER,
          ],
        },
      },
      select: {
        id: true,
        name: true,
        role: true,
      },
      orderBy: { name: "asc" },
    }),
    db.region.findMany({
      where: { churchId: context.churchId },
      include: {
        leader: { select: { name: true, role: true } },
        _count: { select: { zones: true, homecells: true, members: true } },
      },
      orderBy: { name: "asc" },
    }),
    db.zone.findMany({
      where: { churchId: context.churchId },
      include: {
        region: { select: { name: true } },
        leader: { select: { name: true, role: true } },
        _count: { select: { homecells: true, members: true } },
      },
      orderBy: { name: "asc" },
    }),
    db.homecell.findMany({
      where: { churchId: context.churchId },
      include: {
        region: { select: { name: true } },
        zone: { select: { name: true } },
        leader: { select: { name: true, role: true } },
        _count: { select: { members: true } },
      },
      orderBy: { name: "asc" },
    }),
    db.member.findMany({
      where: { churchId: context.churchId, isDeleted: false },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        region: { select: { name: true } },
        zone: { select: { name: true } },
        homecell: { select: { name: true } },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      take: 400,
    }),
    db.structureLeader.findMany({
      where: { churchId: context.churchId },
      include: {
        user: { select: { name: true } },
        region: { select: { name: true } },
        zone: { select: { name: true } },
        homecell: { select: { name: true } },
        parentLeader: {
          include: {
            user: { select: { name: true } },
          },
        },
      },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  return (
    <div className="space-y-6">
      <ChurchSettingsForm churches={churches} currentChurchId={church?.id ?? null} />

      <Card>
        <CardTitle>Zones And Structures</CardTitle>
        <CardDescription className="mt-1">
          {church?.name ?? "Church"} ({church?.slug ?? "-"}) structure management by region, zone, and homecell.
        </CardDescription>
        <p className="mt-2 text-sm text-slate-600">
          Attendance service groups:{" "}
          <span className="font-medium">
            Morning [{(church?.attendanceMorningServiceLabels ?? []).join(", ") || "-"}] | Evening [
            {(church?.attendanceEveningServiceLabels ?? []).join(", ") || "-"}] | Online [
            {(church?.attendanceOnlineServiceLabels ?? []).join(", ") || "-"}]
          </span>
        </p>
        <div className="mt-4">
          <StructureForm
            leaders={leaders.map((leader) => ({
              id: leader.id,
              name: leader.name,
              role: leader.role,
            }))}
            regions={regions.map((region) => ({
              id: region.id,
              name: region.name,
            }))}
            zones={zones.map((zone) => ({
              id: zone.id,
              name: zone.name,
            }))}
            homecells={homecells.map((homecell) => ({
              id: homecell.id,
              name: homecell.name,
            }))}
            members={members.map((member) => ({
              id: member.id,
              name: `${member.firstName} ${member.lastName}`,
            }))}
            structureAssignments={structureLeaders.map((assignment) => ({
              id: assignment.id,
              label: `${assignment.user.name} (${assignment.role}) - ${assignment.homecell?.name ?? assignment.zone?.name ?? assignment.region?.name ?? "General"}`,
              role: assignment.role,
              regionId: assignment.regionId,
              zoneId: assignment.zoneId,
              homecellId: assignment.homecellId,
            }))}
          />
        </div>
      </Card>

      <Card>
        <CardTitle>Zones By Region</CardTitle>
        <div className="mt-4 overflow-x-auto">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Zone</TableHeaderCell>
                <TableHeaderCell>Region</TableHeaderCell>
                <TableHeaderCell>Pastor/Leader</TableHeaderCell>
                <TableHeaderCell>Homecells</TableHeaderCell>
                <TableHeaderCell>Members</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {zones.map((zone) => (
                <TableRow key={zone.id}>
                  <TableCell>{zone.name}</TableCell>
                  <TableCell>{zone.region?.name ?? "Unassigned"}</TableCell>
                  <TableCell>{zone.leader?.name ?? "Unassigned"}</TableCell>
                  <TableCell>{zone._count.homecells}</TableCell>
                  <TableCell>{zone._count.members}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Card>
        <CardTitle>Structure Leadership Branches</CardTitle>
        <div className="mt-4 overflow-x-auto">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Leader</TableHeaderCell>
                <TableHeaderCell>Role</TableHeaderCell>
                <TableHeaderCell>Scope</TableHeaderCell>
                <TableHeaderCell>Reports To</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {structureLeaders.map((assignment) => (
                <TableRow key={assignment.id}>
                  <TableCell>{assignment.user.name}</TableCell>
                  <TableCell>{assignment.role.replace("_", " ")}</TableCell>
                  <TableCell>
                    {assignment.homecell?.name ?? assignment.zone?.name ?? assignment.region?.name ?? "-"}
                  </TableCell>
                  <TableCell>{assignment.parentLeader?.user.name ?? "Root"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Card>
        <CardTitle>Members And Structure Mapping</CardTitle>
        <div className="mt-4 overflow-x-auto">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Member</TableHeaderCell>
                <TableHeaderCell>Region</TableHeaderCell>
                <TableHeaderCell>Zone</TableHeaderCell>
                <TableHeaderCell>Homecell</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {members.slice(0, 80).map((member) => (
                <TableRow key={member.id}>
                  <TableCell>{member.firstName} {member.lastName}</TableCell>
                  <TableCell>{member.region?.name ?? "-"}</TableCell>
                  <TableCell>{member.zone?.name ?? "-"}</TableCell>
                  <TableCell>{member.homecell?.name ?? "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
