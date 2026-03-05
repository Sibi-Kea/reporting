import { Role } from "@prisma/client";

import { db } from "@/lib/db";

export type AttendanceScope = {
  isFullAccess: boolean;
  homecellIds: string[];
  zoneIds: string[];
  regionIds: string[];
};

const FULL_SCOPE_ROLES = new Set<Role>([Role.SUPER_ADMIN, Role.PASTOR, Role.CHURCH_ADMIN]);
const MEMBER_ATTENDANCE_MARK_ROLES = new Set<Role>([
  Role.SUPER_ADMIN,
  Role.PASTOR,
  Role.CHURCH_ADMIN,
  Role.HOMECELL_LEADER,
]);
const SELF_ATTENDANCE_REPORT_ROLES = new Set<Role>([
  Role.OVERSEER,
  Role.SUPERVISOR,
  Role.COORDINATOR,
]);
const SERVICE_CREATION_ROLES = new Set<Role>([Role.SUPER_ADMIN, Role.PASTOR, Role.CHURCH_ADMIN]);

function sortedUnique(values: Iterable<string>) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

export function canCreateAttendanceService(role: Role) {
  return SERVICE_CREATION_ROLES.has(role);
}

export function canMarkMemberAttendance(role: Role) {
  return MEMBER_ATTENDANCE_MARK_ROLES.has(role);
}

export function canSubmitSelfAttendance(role: Role) {
  return SELF_ATTENDANCE_REPORT_ROLES.has(role);
}

export async function resolveAttendanceScope(input: {
  churchId: string;
  userId: string;
  role: Role;
}): Promise<AttendanceScope> {
  const { churchId, userId, role } = input;
  if (FULL_SCOPE_ROLES.has(role)) {
    return {
      isFullAccess: true,
      homecellIds: [],
      zoneIds: [],
      regionIds: [],
    };
  }

  const [structureLeaders, directlyLedHomecells, directlyLedZones, directlyLedRegions] =
    await Promise.all([
      db.structureLeader.findMany({
        where: { churchId },
        select: {
          id: true,
          userId: true,
          role: true,
          parentLeaderId: true,
          regionId: true,
          zoneId: true,
          homecellId: true,
        },
      }),
      db.homecell.findMany({
        where: { churchId, leaderId: userId },
        select: { id: true, zoneId: true, regionId: true },
      }),
      db.zone.findMany({
        where: { churchId, leaderId: userId },
        select: { id: true, regionId: true },
      }),
      db.region.findMany({
        where: { churchId, leaderId: userId },
        select: { id: true },
      }),
    ]);

  const assignmentSeeds = structureLeaders.filter((node) => {
    if (node.userId !== userId) return false;
    if (role === Role.HOMECELL_LEADER) return node.role === Role.HOMECELL_LEADER;
    return node.role === role;
  });

  const childrenByParent = new Map<string, Array<(typeof structureLeaders)[number]>>();
  for (const node of structureLeaders) {
    if (!node.parentLeaderId) continue;
    const current = childrenByParent.get(node.parentLeaderId) ?? [];
    current.push(node);
    childrenByParent.set(node.parentLeaderId, current);
  }

  const visited = new Set<string>();
  const stack = assignmentSeeds.map((seed) => seed.id);
  while (stack.length > 0) {
    const currentId = stack.pop();
    if (!currentId || visited.has(currentId)) continue;
    visited.add(currentId);
    for (const child of childrenByParent.get(currentId) ?? []) {
      stack.push(child.id);
    }
  }

  const homecellSet = new Set<string>();
  const zoneSet = new Set<string>();
  const regionSet = new Set<string>();

  for (const node of structureLeaders) {
    if (!visited.has(node.id)) continue;
    if (node.homecellId) homecellSet.add(node.homecellId);
    if (node.zoneId) zoneSet.add(node.zoneId);
    if (node.regionId) regionSet.add(node.regionId);
  }

  for (const homecell of directlyLedHomecells) {
    homecellSet.add(homecell.id);
    if (homecell.zoneId) zoneSet.add(homecell.zoneId);
    if (homecell.regionId) regionSet.add(homecell.regionId);
  }
  for (const zone of directlyLedZones) {
    zoneSet.add(zone.id);
    if (zone.regionId) regionSet.add(zone.regionId);
  }
  for (const region of directlyLedRegions) {
    regionSet.add(region.id);
  }

  if (homecellSet.size === 0 && (zoneSet.size > 0 || regionSet.size > 0)) {
    const homecells = await db.homecell.findMany({
      where: {
        churchId,
        OR: [
          ...(zoneSet.size > 0 ? [{ zoneId: { in: Array.from(zoneSet) } }] : []),
          ...(regionSet.size > 0 ? [{ regionId: { in: Array.from(regionSet) } }] : []),
        ],
      },
      select: { id: true, zoneId: true, regionId: true },
    });

    for (const homecell of homecells) {
      homecellSet.add(homecell.id);
      if (homecell.zoneId) zoneSet.add(homecell.zoneId);
      if (homecell.regionId) regionSet.add(homecell.regionId);
    }
  }

  return {
    isFullAccess: false,
    homecellIds: sortedUnique(homecellSet),
    zoneIds: sortedUnique(zoneSet),
    regionIds: sortedUnique(regionSet),
  };
}
