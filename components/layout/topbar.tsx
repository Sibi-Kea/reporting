"use client";

import type { Role } from "@prisma/client";
import { CalendarDays } from "lucide-react";
import Image from "next/image";
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
};

export function Topbar({ role, name, churchName }: TopbarProps) {
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
    <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 px-3 py-2.5 backdrop-blur md:px-5 md:py-3 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-2 sm:items-center sm:gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="relative h-6 w-6 overflow-hidden rounded-md border border-slate-300 bg-white">
              <Image src="/brand/crc-logo.svg" alt="CRC logo" fill sizes="24px" className="object-cover" priority />
            </span>
            <p className="truncate text-[11px] font-semibold tracking-[0.14em] text-slate-500 uppercase">
              CRC Reporting
            </p>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <h1 className="truncate text-lg font-semibold text-slate-900">{pageLabel}</h1>
            <Badge className="hidden sm:inline-flex">{toStartCase(role)}</Badge>
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
            <span className="truncate">{churchName ?? "Multi-tenant workspace"}</span>
            <span className="hidden text-slate-300 sm:inline">|</span>
            <span className="hidden truncate sm:inline">Signed in as {name ?? "Church Leader"}</span>
            <span className="text-slate-300">|</span>
            <span className="inline-flex items-center gap-1 whitespace-nowrap font-medium text-slate-600">
              <CalendarDays className="h-3.5 w-3.5" />
              {dateLabel}
            </span>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
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
