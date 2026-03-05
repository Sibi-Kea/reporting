"use client";

import type { Role } from "@prisma/client";
import { Sparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { getNavItemsForRole } from "@/lib/navigation";
import { cn } from "@/lib/utils";

type SidebarProps = {
  role: Role;
  churchName?: string;
};

export function Sidebar({ role, churchName }: SidebarProps) {
  const pathname = usePathname();
  const items = getNavItemsForRole(role);
  const summaryItem = items.find((item) => item.href === "/dashboard/summary");
  const quickTarget = summaryItem?.href ?? items[0]?.href ?? "/dashboard";

  return (
    <aside className="hidden h-screen w-[292px] shrink-0 flex-col border-r border-slate-200/80 bg-slate-50/70 p-4 lg:sticky lg:top-0 lg:flex">
      <div className="rounded-2xl bg-slate-900 p-4 text-white shadow-[0_20px_40px_-30px_rgba(15,23,42,0.95)]">
        <div className="flex items-center gap-3">
          <span className="relative h-10 w-10 overflow-hidden rounded-xl border border-white/20 bg-white">
            <Image src="/brand/crc-logo.svg" alt="CRC logo" fill sizes="40px" className="object-cover" priority />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">CRC Reporting</p>
            <p className="truncate text-xs text-slate-300">{churchName ?? "Multi-tenant workspace"}</p>
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-300">
          Structured operations for attendance, reporting, and member care.
        </p>
      </div>

      <div className="mt-5 flex-1 overflow-hidden">
        <p className="px-3 text-[11px] font-semibold tracking-[0.16em] text-slate-400 uppercase">Navigation</p>
        <nav className="mt-2 h-full overflow-y-auto pr-1">
          <ul className="space-y-1">
            {items.map((item, index) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "group flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition",
                      active
                        ? "border-slate-900 bg-slate-900 text-white shadow-[0_14px_28px_-20px_rgba(15,23,42,0.8)]"
                        : "border-transparent text-slate-600 hover:border-slate-200 hover:bg-white hover:text-slate-900",
                    )}
                  >
                    <span
                      className={cn(
                        "rounded-lg border p-1.5",
                        active
                          ? "border-white/20 bg-white/10 text-sky-100"
                          : "border-slate-200 bg-slate-100 text-slate-500 group-hover:border-slate-300 group-hover:bg-slate-200/70",
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                    </span>
                    <span className="flex-1 font-medium">{item.label}</span>
                    <span
                      className={cn(
                        "text-[10px] font-semibold",
                        active ? "text-slate-300" : "text-slate-400",
                      )}
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex items-center gap-2 text-slate-700">
          <Sparkles className="h-4 w-4 text-sky-600" />
          <p className="text-sm font-semibold">Quick Summary</p>
        </div>
        <p className="mt-1 text-xs text-slate-500">Open your key workspace quickly from one shortcut.</p>
        <Link
          href={quickTarget}
          className="mt-3 inline-flex items-center rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800"
        >
          {summaryItem ? "Go to Summary" : "Open Workspace"}
        </Link>
      </div>
    </aside>
  );
}
