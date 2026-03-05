"use client";

import type { Role } from "@prisma/client";
import { Bell, CalendarDays } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { SignOutButton } from "@/components/layout/sign-out-button";
import { Badge } from "@/components/ui/badge";
import { getNavItemsForRole } from "@/lib/navigation";
import { toStartCase } from "@/lib/utils";

type TopbarProps = {
  role: Role;
  name?: string | null;
  churchName?: string;
  unreadNotifications: number;
};

export function Topbar({ role, name, churchName, unreadNotifications }: TopbarProps) {
  const pathname = usePathname();
  const items = getNavItemsForRole(role);
  const activeItem =
    [...items]
      .sort((first, second) => second.href.length - first.href.length)
      .find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`)) ?? null;
  const pageLabel = activeItem?.label ?? "Dashboard";
  const dateLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date());

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/85 px-3 py-3 backdrop-blur md:px-5 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-[0.14em] text-slate-500 uppercase">Operations Console</p>
          <div className="mt-1 flex items-center gap-2">
            <h1 className="truncate text-lg font-semibold text-slate-900">{pageLabel}</h1>
            <Badge className="hidden sm:inline-flex">{toStartCase(role)}</Badge>
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
            <span className="truncate">{churchName ?? "Multi-tenant workspace"}</span>
            <span className="text-slate-300">|</span>
            <span className="truncate">Signed in as {name ?? "Church Leader"}</span>
            <span className="text-slate-300">|</span>
            <span className="inline-flex items-center gap-1 whitespace-nowrap">
              <CalendarDays className="h-3.5 w-3.5" />
              {dateLabel}
            </span>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/dashboard/notifications"
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
          >
            <Bell className="h-4 w-4" />
            {unreadNotifications > 0 ? (
              <span className="absolute -top-1 -right-1 min-w-5 rounded-full bg-red-600 px-1 text-center text-[10px] font-semibold text-white">
                {unreadNotifications > 99 ? "99+" : unreadNotifications}
              </span>
            ) : null}
          </Link>
          <SignOutButton />
        </div>
      </div>

      <div className="mt-3 hidden gap-2 overflow-x-auto pb-0.5 md:flex">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={
                active
                  ? "inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-medium text-white"
                  : "inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-300 hover:text-slate-900"
              }
            >
              <item.icon className="h-3.5 w-3.5" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </header>
  );
}
