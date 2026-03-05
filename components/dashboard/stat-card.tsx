import type { LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/card";

type StatCardProps = {
  label: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
};

export function StatCard({ label, value, subtitle, icon: Icon }: StatCardProps) {
  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-500">{label}</span>
        <span className="rounded-lg bg-sky-100 p-2 text-sky-700">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="text-2xl font-semibold text-slate-900">{value}</p>
      {subtitle ? <p className="text-xs text-slate-500">{subtitle}</p> : null}
    </Card>
  );
}

