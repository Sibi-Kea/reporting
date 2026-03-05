"use client";

import type { Role } from "@prisma/client";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { getNavItemsForRole } from "@/lib/navigation";
import { toStartCase } from "@/lib/utils";
import { cn } from "@/lib/utils";

type MobileNavProps = {
  role: Role;
};

const QUICK_LINK_PRIORITY = [
  "/dashboard",
  "/dashboard/reporting",
  "/dashboard/attendance",
  "/dashboard/membership",
] as const;

export function MobileNav({ role }: MobileNavProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const items = getNavItemsForRole(role);
  const quickItems = useMemo(() => {
    const prioritized = QUICK_LINK_PRIORITY
      .map((href) => items.find((item) => item.href === href))
      .filter((item): item is (typeof items)[number] => item !== undefined);
    const uniqueHrefs = new Set(prioritized.map((item) => item.href));
    const extras = items.filter((item) => !uniqueHrefs.has(item.href));
    return [...prioritized, ...extras].slice(0, 4);
  }, [items]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [menuOpen]);

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200/90 bg-white/95 px-2 pt-2 pb-[calc(env(safe-area-inset-bottom)+0.55rem)] backdrop-blur lg:hidden">
        <ul className="grid grid-cols-5 gap-1">
          {quickItems.map((item) => {
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
          <li>
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="flex min-h-14 w-full flex-col items-center justify-center gap-1 rounded-xl px-1 py-1 text-[11px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            >
              <Menu className="h-4 w-4" />
              <span className="max-w-full truncate">More</span>
            </button>
          </li>
        </ul>
      </nav>

      {menuOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/45"
            onClick={() => setMenuOpen(false)}
            aria-label="Close mobile menu"
          />
          <div className="absolute inset-x-0 bottom-0 rounded-t-3xl border-t border-slate-200 bg-white p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-[0_-20px_45px_-25px_rgba(15,23,42,0.45)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">Menu</p>
                <p className="text-xs text-slate-500">{toStartCase(role)} workspace navigation</p>
              </div>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <ul className="mt-4 grid grid-cols-2 gap-2">
              {items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm",
                        active
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
                      )}
                      onClick={() => setMenuOpen(false)}
                    >
                      <item.icon className="h-4 w-4" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      ) : null}
    </>
  );
}
