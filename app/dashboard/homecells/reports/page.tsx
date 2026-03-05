import Link from "next/link";
import { Prisma, Role } from "@prisma/client";

import { HomecellReportForm } from "@/components/homecells/homecell-report-form";
import { UnlockReportButton } from "@/components/homecells/unlock-report-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/rbac";
import { assertChurch, requireChurchContext } from "@/lib/tenant";
import { formatCurrency, formatPercent } from "@/lib/utils";

export default async function HomecellReportsPage() {
  const context = await requireChurchContext();
  const churchId = assertChurch(context.churchId);

  const homecellScopeWhere: Prisma.HomecellReportWhereInput =
    context.role === Role.HOMECELL_LEADER
      ? { homecell: { leaderId: context.userId } }
      : {};

  const [homecells, reports] = await Promise.all([
    db.homecell.findMany({
      where: {
        churchId,
        ...(context.role === Role.HOMECELL_LEADER ? { leaderId: context.userId } : {}),
      },
      include: {
        members: {
          where: { isDeleted: false, membershipStatus: "ACTIVE" },
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
          orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        },
      },
      orderBy: { name: "asc" },
    }),
    db.homecellReport.findMany({
      where: {
        churchId,
        ...homecellScopeWhere,
      },
      include: {
        homecell: { select: { name: true } },
        submittedBy: { select: { name: true } },
      },
      orderBy: { weekStartDate: "desc" },
      take: 20,
    }),
  ]);

  const canSubmit = hasPermission(context.role, "homecell_reports:submit");
  const canUnlock = hasPermission(context.role, "homecell_reports:unlock");
  const canExport = hasPermission(context.role, "exports:run");

  return (
    <div className="space-y-6">
      <Card>
        <CardTitle>Homecell Weekly Reporting</CardTitle>
        <CardDescription className="mt-1">
          Pre-filled member list, auto-calculated totals, and duplicate-week submission protection.
        </CardDescription>
        {canSubmit ? (
          <div className="mt-4">
            <HomecellReportForm
              homecells={homecells.map((homecell) => ({
                id: homecell.id,
                name: homecell.name,
                members: homecell.members.map((member) => ({
                  id: member.id,
                  name: `${member.firstName} ${member.lastName}`,
                })),
              }))}
              defaultHomecellId={homecells[0]?.id}
            />
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-500">You have view-only access.</p>
        )}
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Submitted Reports</CardTitle>
            <CardDescription className="mt-1">Supervisor and Overseer can unlock locked submissions.</CardDescription>
          </div>
          {canExport ? (
            <Link
              href="/api/exports/homecell-reports"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Export CSV
            </Link>
          ) : null}
        </div>
        <div className="mt-4 overflow-x-auto">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Week</TableHeaderCell>
                <TableHeaderCell>Homecell</TableHeaderCell>
                <TableHeaderCell>Present / Total</TableHeaderCell>
                <TableHeaderCell>Attendance %</TableHeaderCell>
                <TableHeaderCell>Visitors</TableHeaderCell>
                <TableHeaderCell>Offering</TableHeaderCell>
                <TableHeaderCell>Submitted by</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell className="text-right">Actions</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {reports.map((report) => {
                const rate = report.totalMembers
                  ? (report.membersPresent / report.totalMembers) * 100
                  : 0;
                return (
                  <TableRow key={report.id}>
                    <TableCell>{report.weekStartDate.toISOString().slice(0, 10)}</TableCell>
                    <TableCell>{report.homecell.name}</TableCell>
                    <TableCell>
                      {report.membersPresent} / {report.totalMembers}
                    </TableCell>
                    <TableCell>{formatPercent(rate)}</TableCell>
                    <TableCell>
                      {report.firstTimeVisitors} first-time / {report.visitors} total
                    </TableCell>
                    <TableCell>{formatCurrency(Number(report.offeringCollected ?? 0))}</TableCell>
                    <TableCell>{report.submittedBy.name}</TableCell>
                    <TableCell>
                      {report.isLocked ? <Badge>Locked</Badge> : <Badge variant="success">Unlocked</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      {canUnlock && report.isLocked ? <UnlockReportButton reportId={report.id} /> : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
