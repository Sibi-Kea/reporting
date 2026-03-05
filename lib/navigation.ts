import type { Role } from "@prisma/client";
import {
  AreaChart,
  BarChart3,
  Bell,
  CalendarCheck2,
  Download,
  LayoutDashboard,
  Network,
  Settings,
  UserRoundPlus,
  Users,
  Wallet,
  WavesLadder,
} from "lucide-react";

import { hasPermission } from "@/lib/rbac";

export const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, permission: "notifications:view" as const },
  { href: "/dashboard/summary", label: "Summary", icon: WavesLadder, permission: "homecell_reports:view" as const },
  { href: "/dashboard/reporting", label: "Reporting", icon: BarChart3, permission: "attendance:view" as const },
  { href: "/dashboard/attendance", label: "Attendance", icon: CalendarCheck2, permission: "attendance:view" as const },
  { href: "/dashboard/hierarchy", label: "Structure", icon: Network, permission: "members:view" as const },
  { href: "/dashboard/analytics", label: "Analytics", icon: AreaChart, permission: "analytics:view" as const },
  { href: "/dashboard/membership", label: "Membership", icon: Users, permission: "members:view" as const },
  { href: "/dashboard/visitors", label: "Visitors", icon: UserRoundPlus, permission: "visitors:view" as const },
  { href: "/dashboard/finance", label: "Finance", icon: Wallet, permission: "finance:view" as const },
  { href: "/dashboard/notifications", label: "Notifications", icon: Bell, permission: "notifications:view" as const },
  { href: "/dashboard/exports", label: "Exports", icon: Download, permission: "exports:run" as const },
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
