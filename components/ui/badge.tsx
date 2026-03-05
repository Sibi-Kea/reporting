import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type Variant = "default" | "success" | "warning" | "danger";

const variantStyles: Record<Variant, string> = {
  default: "bg-slate-100 text-slate-800",
  success: "bg-emerald-100 text-emerald-800",
  warning: "bg-amber-100 text-amber-800",
  danger: "bg-red-100 text-red-800",
};

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: Variant;
};

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
        variantStyles[variant],
        className,
      )}
      {...props}
    />
  );
}

