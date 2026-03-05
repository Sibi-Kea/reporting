import { Role } from "@prisma/client";

type Permission =
  | "church:create"
  | "church:view_all"
  | "users:manage"
  | "members:view"
  | "members:manage"
  | "members:notes"
  | "attendance:view"
  | "attendance:manage"
  | "attendance:self_report"
  | "homecell_reports:view"
  | "homecell_reports:submit"
  | "homecell_reports:unlock"
  | "visitors:view"
  | "visitors:manage"
  | "finance:view"
  | "finance:manage"
  | "analytics:view"
  | "notifications:view"
  | "notifications:manage"
  | "exports:run";

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  SUPER_ADMIN: [
    "church:create",
    "church:view_all",
    "users:manage",
    "members:view",
    "members:manage",
    "members:notes",
    "attendance:view",
    "attendance:manage",
    "homecell_reports:view",
    "homecell_reports:submit",
    "homecell_reports:unlock",
    "visitors:view",
    "visitors:manage",
    "finance:view",
    "finance:manage",
    "analytics:view",
    "notifications:view",
    "notifications:manage",
    "exports:run",
  ],
  PASTOR: [
    "users:manage",
    "members:view",
    "members:manage",
    "members:notes",
    "attendance:view",
    "attendance:manage",
    "homecell_reports:view",
    "homecell_reports:unlock",
    "visitors:view",
    "visitors:manage",
    "finance:view",
    "analytics:view",
    "notifications:view",
    "notifications:manage",
    "exports:run",
  ],
  OVERSEER: [
    "members:view",
    "members:manage",
    "attendance:view",
    "attendance:self_report",
    "homecell_reports:view",
    "homecell_reports:unlock",
    "visitors:view",
    "analytics:view",
    "notifications:view",
    "exports:run",
  ],
  SUPERVISOR: [
    "members:view",
    "attendance:view",
    "attendance:self_report",
    "homecell_reports:view",
    "homecell_reports:unlock",
    "visitors:view",
    "analytics:view",
    "notifications:view",
    "exports:run",
  ],
  COORDINATOR: [
    "members:view",
    "attendance:view",
    "attendance:self_report",
    "homecell_reports:view",
    "visitors:view",
    "analytics:view",
    "notifications:view",
    "exports:run",
  ],
  HOMECELL_LEADER: [
    "members:view",
    "attendance:view",
    "attendance:manage",
    "homecell_reports:view",
    "homecell_reports:submit",
    "visitors:view",
    "notifications:view",
  ],
  CHURCH_ADMIN: [
    "users:manage",
    "members:view",
    "members:manage",
    "attendance:view",
    "attendance:manage",
    "homecell_reports:view",
    "visitors:view",
    "visitors:manage",
    "analytics:view",
    "notifications:view",
    "notifications:manage",
    "exports:run",
  ],
  FINANCE_ADMIN: [
    "members:view",
    "finance:view",
    "finance:manage",
    "analytics:view",
    "notifications:view",
    "exports:run",
  ],
};

export const ROUTE_PERMISSIONS: Array<{
  pattern: RegExp;
  permission: Permission;
}> = [
  { pattern: /^\/dashboard\/summary/, permission: "homecell_reports:view" },
  { pattern: /^\/dashboard\/reports/, permission: "homecell_reports:view" },
  { pattern: /^\/dashboard\/reporting/, permission: "attendance:view" },
  { pattern: /^\/dashboard\/settings/, permission: "church:create" },
  { pattern: /^\/dashboard\/hierarchy/, permission: "members:view" },
  { pattern: /^\/dashboard\/membership/, permission: "members:view" },
  { pattern: /^\/dashboard\/members/, permission: "members:view" },
  { pattern: /^\/dashboard\/attendance/, permission: "attendance:view" },
  { pattern: /^\/dashboard\/homecells\/reports/, permission: "homecell_reports:view" },
  { pattern: /^\/dashboard\/visitors/, permission: "visitors:view" },
  { pattern: /^\/dashboard\/finance/, permission: "finance:view" },
  { pattern: /^\/dashboard\/analytics/, permission: "analytics:view" },
  { pattern: /^\/dashboard\/notifications/, permission: "notifications:view" },
  { pattern: /^\/dashboard\/exports/, permission: "exports:run" },
  { pattern: /^\/dashboard\/admin\/churches/, permission: "church:create" },
];

export function hasPermission(role: Role, permission: Permission) {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function hasAnyPermission(role: Role, permissions: Permission[]) {
  return permissions.some((permission) => hasPermission(role, permission));
}

export function getPermissions(role: Role) {
  return ROLE_PERMISSIONS[role] ?? [];
}

export type { Permission };
