import Link from "next/link";

import { FollowupSelect } from "@/components/visitors/followup-select";
import { VisitorsCharts } from "@/components/visitors/visitors-charts";
import { VisitorForm } from "@/components/visitors/visitor-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/rbac";
import { assertChurch, requireChurchContext } from "@/lib/tenant";
import { formatPercent } from "@/lib/utils";

export default async function VisitorsPage() {
  const context = await requireChurchContext();
  const churchId = assertChurch(context.churchId);

  const [visitors, firstTimeCount, totalCount, convertedCount, pendingCount] = await Promise.all([
    db.visitor.findMany({
      where: { churchId },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
    db.visitor.count({ where: { churchId, firstTime: true } }),
    db.visitor.count({ where: { churchId } }),
    db.visitor.count({ where: { churchId, convertedToMember: true } }),
    db.visitor.count({ where: { churchId, followUpStatus: "PENDING" } }),
  ]);

  const conversionRate = totalCount ? (convertedCount / totalCount) * 100 : 0;
  const followUpData = [
    { status: "PENDING", count: visitors.filter((item) => item.followUpStatus === "PENDING").length },
    { status: "CONTACTED", count: visitors.filter((item) => item.followUpStatus === "CONTACTED").length },
    { status: "SCHEDULED", count: visitors.filter((item) => item.followUpStatus === "SCHEDULED").length },
    { status: "COMPLETED", count: visitors.filter((item) => item.followUpStatus === "COMPLETED").length },
  ];
  const visitorTypeData = [
    { label: "First-time", value: firstTimeCount },
    { label: "Returning", value: Math.max(totalCount - firstTimeCount, 0) },
  ];
  const canManage = hasPermission(context.role, "visitors:manage");

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <p className="text-sm text-slate-500">First-time Visitors</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{firstTimeCount}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Conversion Rate</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-700">{formatPercent(conversionRate)}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Follow-up Pending</p>
          <p className="mt-1 text-2xl font-semibold text-amber-700">{pendingCount}</p>
        </Card>
      </div>

      <VisitorsCharts followUpData={followUpData} visitorTypeData={visitorTypeData} />

      {canManage ? (
        <Card>
          <CardTitle>Add Visitor</CardTitle>
          <CardDescription className="mt-1">
            Track invited-by source, follow-up status, and conversion to membership.
          </CardDescription>
          <div className="mt-4">
            <VisitorForm />
          </div>
        </Card>
      ) : null}

      <Card>
        <div className="flex items-center justify-between">
          <CardTitle>Visitor Pipeline</CardTitle>
          <Link
            href="/api/exports/visitors"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Export CSV
          </Link>
        </div>
        <div className="mt-4 overflow-x-auto">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Name</TableHeaderCell>
                <TableHeaderCell>Phone</TableHeaderCell>
                <TableHeaderCell>Invited by</TableHeaderCell>
                <TableHeaderCell>First-time</TableHeaderCell>
                <TableHeaderCell>Conversion</TableHeaderCell>
                <TableHeaderCell>Follow-up</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visitors.map((visitor) => (
                <TableRow key={visitor.id}>
                  <TableCell>
                    {visitor.firstName} {visitor.lastName ?? ""}
                  </TableCell>
                  <TableCell>{visitor.phone}</TableCell>
                  <TableCell>{visitor.invitedBy ?? "-"}</TableCell>
                  <TableCell>
                    {visitor.firstTime ? <Badge variant="success">First-time</Badge> : <Badge>Returning</Badge>}
                  </TableCell>
                  <TableCell>
                    {visitor.convertedToMember ? (
                      <Badge variant="success">Converted</Badge>
                    ) : (
                      <Badge variant="warning">Not yet</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {canManage ? (
                      <FollowupSelect visitorId={visitor.id} value={visitor.followUpStatus} />
                    ) : (
                      <Badge>{visitor.followUpStatus}</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
