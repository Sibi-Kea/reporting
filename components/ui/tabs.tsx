"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

type Tab = {
  key: string;
  label: string;
  content: React.ReactNode;
};

type TabsProps = {
  tabs: Tab[];
  defaultKey?: string;
};

export function Tabs({ tabs, defaultKey }: TabsProps) {
  const [active, setActive] = useState(defaultKey ?? tabs[0]?.key);
  const current = tabs.find((tab) => tab.key === active);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActive(tab.key)}
            className={cn(
              "rounded-lg px-3 py-2 text-sm font-medium transition",
              tab.key === active
                ? "bg-sky-100 text-sky-800"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-800",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div>{current?.content}</div>
    </div>
  );
}

