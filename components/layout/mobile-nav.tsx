"use client";

import type { Role } from "@prisma/client";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { getNavItemsForRole } from "@/lib/navigation";
import { cn } from "@/lib/utils";

type MobileNavProps = {
  role: Role;
};

export function MobileNav({ role }: MobileNavProps) {
  const pathname = usePathname();
  const items = getNavItemsForRole(role);
  const mobileItems = items.slice(0, 5);
  const gridColsClass =
    mobileItems.length >= 5
      ? "grid-cols-5"
      : mobileItems.length === 4
        ? "grid-cols-4"
        : mobileItems.length === 3
          ? "grid-cols-3"
          : mobileItems.length === 2
            ? "grid-cols-2"
            : "grid-cols-1";

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200/90 bg-white/95 px-2 pt-2 pb-[calc(env(safe-area-inset-bottom)+0.55rem)] backdrop-blur lg:hidden">
      <ul className={cn("grid gap-1", gridColsClass)}>
        {mobileItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1 text-[11px] font-medium",
                  active
                    ? "bg-slate-900 text-white"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-900",
                )}
              >
                <item.icon className="h-4 w-4" />
                <span className="max-w-full truncate">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
