import Link from "next/link";

import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { hasPermission } from "@/lib/rbac";
import { requireChurchContext } from "@/lib/tenant";

const exportLinks = [
  { href: "/api/exports/members", label: "Export Members", description: "Member profiles and status data." },
  { href: "/api/exports/attendance", label: "Export Attendance", description: "Service attendance records and reasons." },
  { href: "/api/exports/finance", label: "Export Finance", description: "Financial transactions for accounting." },
  {
    href: "/api/exports/homecell-reports",
    label: "Export Homecell Reports",
    description: "Weekly homecell report summaries.",
  },
  { href: "/api/exports/visitors", label: "Export Visitors", description: "Visitor follow-up and conversion data." },
];

export default async function ExportsPage() {
  const context = await requireChurchContext();
  const canExport = hasPermission(context.role, "exports:run");

  if (!canExport) {
    return (
      <Card>
        <CardTitle>Exports Restricted</CardTitle>
        <CardDescription className="mt-1">Your role does not include CSV exports.</CardDescription>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>Data Exports</CardTitle>
        <CardDescription className="mt-1">
          Download operational data in CSV format for reporting or external analysis.
        </CardDescription>
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        {exportLinks.map((item) => (
          <Card key={item.href} className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">{item.label}</h3>
              <p className="mt-1 text-sm text-slate-500">{item.description}</p>
            </div>
            <Link
              href={item.href}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Download
            </Link>
          </Card>
        ))}
      </div>
    </div>
  );
}

