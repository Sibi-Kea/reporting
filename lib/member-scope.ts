import { Role } from "@prisma/client";

import { resolveAttendanceScope } from "@/lib/attendance-scope";

type MemberScope = {
  isFullAccess: boolean;
  homecellIds: string[];
};

const FULL_MEMBER_SCOPE_ROLES = new Set<Role>([
  Role.SUPER_ADMIN,
  Role.PASTOR,
  Role.CHURCH_ADMIN,
  Role.FINANCE_ADMIN,
]);

const STRUCTURE_MEMBER_SCOPE_ROLES = new Set<Role>([
  Role.OVERSEER,
  Role.SUPERVISOR,
  Role.COORDINATOR,
  Role.HOMECELL_LEADER,
]);

export async function resolveMemberScope(input: {
  churchId: string;
  userId: string;
  role: Role;
}): Promise<MemberScope> {
  if (FULL_MEMBER_SCOPE_ROLES.has(input.role)) {
    return {
      isFullAccess: true,
      homecellIds: [],
    };
  }

  if (!STRUCTURE_MEMBER_SCOPE_ROLES.has(input.role)) {
    return {
      isFullAccess: true,
      homecellIds: [],
    };
  }

  const scope = await resolveAttendanceScope(input);
  return {
    isFullAccess: false,
    homecellIds: scope.homecellIds,
  };
}

