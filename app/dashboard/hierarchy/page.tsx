import { Role } from "@prisma/client";
import { startOfMonth, subDays } from "date-fns";

import { HierarchyVisual } from "@/components/hierarchy/hierarchy-visual";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/rbac";
import { assertChurch, requireChurchContext } from "@/lib/tenant";

function uniqueNames(names: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      names
        .filter((name): name is string => Boolean(name))
        .map((name) => name.trim())
        .filter((name) => name.length > 0),
    ),
  );
}

const structureRoles = new Set<Role>([
  Role.OVERSEER,
  Role.SUPERVISOR,
  Role.COORDINATOR,
  Role.HOMECELL_LEADER,
]);

export default async function HierarchyPage() {
  const context = await requireChurchContext();
  const churchId = assertChurch(context.churchId);

  const [church, attendanceEntries, growthMembers, structureLeaders, leaderCandidates, memberCandidates] = await Promise.all([
    db.church.findUnique({
      where: { id: churchId },
      select: {
        name: true,
        pastor: { select: { name: true } },
        users: {
          where: {
            churchId,
            isActive: true,
            role: { in: [Role.OVERSEER, Role.SUPERVISOR, Role.COORDINATOR, Role.HOMECELL_LEADER] },
          },
          select: {
            name: true,
            role: true,
          },
        },
        regions: {
          include: {
            zones: {
              include: {
                homecells: {
                  include: {
                    leader: { select: { name: true } },
                    _count: { select: { members: true } },
                  },
                  orderBy: { name: "asc" },
                },
              },
              orderBy: { name: "asc" },
            },
          },
          orderBy: { name: "asc" },
        },
      },
    }),
    db.attendanceEntry.findMany({
      where: {
        churchId,
        attendance: {
          service: {
            eventDate: { gte: subDays(new Date(), 30) },
          },
        },
      },
      select: {
        status: true,
        member: { select: { homecellId: true } },
      },
    }),
    db.member.findMany({
      where: {
        churchId,
        isDeleted: false,
        dateJoined: { gte: startOfMonth(new Date()) },
      },
      select: { homecellId: true },
    }),
    db.structureLeader.findMany({
      where: { churchId },
      select: {
        id: true,
        role: true,
        parentLeaderId: true,
        regionId: true,
        zoneId: true,
        homecellId: true,
        user: { select: { name: true } },
        homecell: { select: { id: true, zoneId: true, regionId: true } },
      },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    }),
    db.user.findMany({
      where: {
        churchId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        role: true,
      },
      orderBy: { name: "asc" },
      take: 400,
    }),
    db.member.findMany({
      where: {
        churchId,
        isDeleted: false,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      take: 500,
    }),
  ]);

  if (!church) {
    return null;
  }

  const attendanceMap = new Map<string, { total: number; present: number }>();
  for (const entry of attendanceEntries) {
    const homecellId = entry.member.homecellId;
    if (!homecellId) continue;
    const current = attendanceMap.get(homecellId) ?? { total: 0, present: 0 };
    current.total += 1;
    if (entry.status === "PRESENT" || entry.status === "ONLINE") current.present += 1;
    attendanceMap.set(homecellId, current);
  }

  const growthMap = new Map<string, number>();
  for (const member of growthMembers) {
    if (!member.homecellId) continue;
    growthMap.set(member.homecellId, (growthMap.get(member.homecellId) ?? 0) + 1);
  }

  const namesFromStructure = (role: Role) =>
    structureLeaders
      .filter((leader) => leader.role === role)
      .map((leader) => leader.user.name);

  const namesFromUsers = (role: Role) =>
    church.users.filter((user) => user.role === role).map((user) => user.name);

  const summary = {
    pastors: uniqueNames([church.pastor?.name]),
    overseers: uniqueNames([...namesFromStructure(Role.OVERSEER), ...namesFromUsers(Role.OVERSEER)]),
    supervisors: uniqueNames([
      ...namesFromStructure(Role.SUPERVISOR),
      ...namesFromUsers(Role.SUPERVISOR),
    ]),
    coordinators: uniqueNames([
      ...namesFromStructure(Role.COORDINATOR),
      ...namesFromUsers(Role.COORDINATOR),
    ]),
    homecellLeaders: uniqueNames([
      ...namesFromStructure(Role.HOMECELL_LEADER),
      ...namesFromUsers(Role.HOMECELL_LEADER),
    ]),
  };

  const zones = church.regions.flatMap((region) =>
    region.zones.map((zone) => {
      const zoneAssignments = structureLeaders.filter((leader) => {
        if (leader.homecellId) return leader.homecell?.zoneId === zone.id;
        return leader.zoneId === zone.id;
      });

      return {
        id: zone.id,
        name: zone.name,
        regionId: region.id,
        regionName: region.name,
        nodes: zoneAssignments
          .filter((assignment) => structureRoles.has(assignment.role))
          .map((assignment) => ({
            id: assignment.id,
            name: assignment.user.name,
            role: assignment.role as "OVERSEER" | "SUPERVISOR" | "COORDINATOR" | "HOMECELL_LEADER",
            parentLeaderId: assignment.parentLeaderId,
            regionId: assignment.regionId,
            zoneId: assignment.zoneId,
            homecellId: assignment.homecellId,
          })),
        homecells: zone.homecells.map((homecell) => {
          const attendance = attendanceMap.get(homecell.id) ?? { total: 0, present: 0 };
          const attendanceRate = attendance.total ? (attendance.present / attendance.total) * 100 : 0;
          const growth = growthMap.get(homecell.id) ?? 0;
          const leaderNames = uniqueNames([
            ...zoneAssignments
              .filter(
                (assignment) =>
                  assignment.role === Role.HOMECELL_LEADER &&
                  assignment.homecellId === homecell.id,
              )
              .map((assignment) => assignment.user.name),
            homecell.leader?.name,
          ]);

          return {
            id: homecell.id,
            name: homecell.name,
            leaderNames,
            membersCount: homecell._count.members,
            attendanceRate,
            growth,
          };
        }),
      };
    }),
  );

  return (
    <HierarchyVisual
      churchName={church.name}
      pastorName={church.pastor?.name ?? "Unassigned Pastor"}
      summary={summary}
      zones={zones}
      canManage={hasPermission(context.role, "members:manage")}
      leaderCandidates={leaderCandidates.map((leader) => ({
        id: leader.id,
        name: leader.name,
        role: leader.role,
      }))}
      memberCandidates={memberCandidates.map((member) => ({
        id: member.id,
        name: `${member.firstName} ${member.lastName}`,
        email: member.email,
      }))}
    />
  );
}
