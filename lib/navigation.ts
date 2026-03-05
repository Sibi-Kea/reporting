import type { Role } from "@prisma/client";
import {
  BarChart3,
  LayoutDashboard,
  Settings,
  Users,
  WavesLadder,
} from "lucide-react";

import { hasPermission } from "@/lib/rbac";

export const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, permission: "notifications:view" as const },
  { href: "/dashboard/reporting", label: "Reporting", icon: BarChart3, permission: "attendance:view" as const },
  { href: "/dashboard/summary", label: "Summary", icon: WavesLadder, permission: "homecell_reports:view" as const },
  { href: "/dashboard/membership", label: "Membership", icon: Users, permission: "members:view" as const },
  {
    href: "/dashboard/settings",
    label: "Settings",
    icon: Settings,
    permission: "church:create" as const,
  },
];

export function getNavItemsForRole(role: Role) {
  return navItems.filter((item) => hasPermission(role, item.permission));
}
