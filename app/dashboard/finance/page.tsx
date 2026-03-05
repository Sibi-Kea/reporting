import Link from "next/link";
import { startOfMonth, subMonths } from "date-fns";

import { FinanceForm } from "@/components/finance/finance-form";
import { FinanceTrendChart } from "@/components/finance/finance-trend-chart";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/rbac";
import { assertChurch, requireChurchContext } from "@/lib/tenant";
import { formatCurrency, formatPercent } from "@/lib/utils";

export default async function FinancePage() {
  const context = await requireChurchContext();
  const churchId = assertChurch(context.churchId);

  if (!hasPermission(context.role, "finance:view")) {
    return (
      <Card>
        <CardTitle>Finance Access Restricted</CardTitle>
        <CardDescription className="mt-1">
          Only Finance Admin and authorized leadership roles can view this module.
        </CardDescription>
      </Card>
    );
  }

  const monthStart = startOfMonth(new Date());
  const titheWindowStart = startOfMonth(subMonths(new Date(), 2));
  const trendStart = startOfMonth(subMonths(new Date(), 5));

  const [transactions, monthlySummary, members, services, topContributors, titherConsistency, trendRows] =
    await Promise.all([
    db.financeTransaction.findMany({
      where: { churchId },
      include: {
        member: { select: { firstName: true, lastName: true } },
        service: { select: { title: true } },
        capturedBy: { select: { name: true } },
      },
      orderBy: { transactionDate: "desc" },
      take: 50,
    }),
    db.financeTransaction.aggregate({
      where: { churchId, transactionDate: { gte: monthStart } },
      _sum: { amount: true },
    }),
    db.member.findMany({
      where: { churchId, isDeleted: false },
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    db.service.findMany({
      where: { churchId },
      select: { id: true, title: true, eventDate: true },
      orderBy: { eventDate: "desc" },
      take: 24,
    }),
    db.financeTransaction.groupBy({
      by: ["memberId"],
      where: { churchId, memberId: { not: null } },
      _sum: { amount: true },
      orderBy: { _sum: { amount: "desc" } },
      take: 5,
    }),
    db.financeTransaction.groupBy({
      by: ["memberId"],
      where: {
        churchId,
        memberId: { not: null },
        financeType: "TITHE",
        transactionDate: { gte: titheWindowStart },
      },
      _count: { _all: true },
    }),
    db.financeTransaction.findMany({
      where: {
        churchId,
        transactionDate: { gte: trendStart },
      },
      select: {
        transactionDate: true,
        amount: true,
        financeType: true,
      },
      orderBy: { transactionDate: "asc" },
    }),
  ]);

  const memberLookup = new Map(
    members.map((member) => [member.id, `${member.firstName} ${member.lastName}`]),
  );

  const totalMonthly = Number(monthlySummary._sum.amount ?? 0);
  const canManage = hasPermission(context.role, "finance:manage");
  const titheCount = titherConsistency.length;
  const titherRate = members.length ? (titheCount / members.length) * 100 : 0;

  const monthlyMap = new Map<string, { total: number; tithe: number }>();
  for (const row of trendRows) {
    const monthKey = row.transactionDate.toLocaleString("en-US", { month: "short" });
    const bucket = monthlyMap.get(monthKey) ?? { total: 0, tithe: 0 };
    const amount = Number(row.amount);
    bucket.total += amount;
    if (row.financeType === "TITHE") {
      bucket.tithe += amount;
    }
    monthlyMap.set(monthKey, bucket);
  }
  const trendData = Array.from(monthlyMap.entries()).map(([month, values]) => ({
    month,
    total: Number(values.total.toFixed(2)),
    tithe: Number(values.tithe.toFixed(2)),
  }));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <p className="text-sm text-slate-500">Monthly Total</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-700">{formatCurrency(totalMonthly)}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Top Contributor</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">
            {topContributors[0]?.memberId ? memberLookup.get(topContributors[0].memberId) : "No data"}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Consistent Tithers (3 months)</p>
          <p className="mt-1 text-2xl font-semibold text-sky-700">
            {titherConsistency.filter((entry) => entry._count._all >= 3).length}
          </p>
          <p className="mt-1 text-xs text-slate-500">Rate: {formatPercent(titherRate)}</p>
        </Card>
      </div>

      {trendData.length ? <FinanceTrendChart data={trendData} /> : null}

      {canManage ? (
        <Card>
          <CardTitle>Record Finance Transaction</CardTitle>
          <CardDescription className="mt-1">Finance Admin only. Every action is captured in audit logs.</CardDescription>
          <div className="mt-4">
            <FinanceForm
              members={members.map((member) => ({
                id: member.id,
                name: `${member.firstName} ${member.lastName}`,
              }))}
              services={services.map((service) => ({
                id: service.id,
                name: `${service.title} (${service.eventDate.toISOString().slice(0, 10)})`,
              }))}
            />
          </div>
        </Card>
      ) : null}

      <Card>
        <div className="flex items-center justify-between">
          <CardTitle>Recent Transactions</CardTitle>
          <Link
            href="/api/exports/finance"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Export CSV
          </Link>
        </div>
        <div className="mt-4 overflow-x-auto">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Date</TableHeaderCell>
                <TableHeaderCell>Type</TableHeaderCell>
                <TableHeaderCell>Member</TableHeaderCell>
                <TableHeaderCell>Service</TableHeaderCell>
                <TableHeaderCell>Method</TableHeaderCell>
                <TableHeaderCell>Captured by</TableHeaderCell>
                <TableHeaderCell className="text-right">Amount</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {transactions.map((transaction) => (
                <TableRow key={transaction.id}>
                  <TableCell>{transaction.transactionDate.toISOString().slice(0, 10)}</TableCell>
                  <TableCell>
                    <Badge>{transaction.financeType}</Badge>
                  </TableCell>
                  <TableCell>
                    {transaction.member ? `${transaction.member.firstName} ${transaction.member.lastName}` : "-"}
                  </TableCell>
                  <TableCell>{transaction.service?.title ?? "-"}</TableCell>
                  <TableCell>{transaction.paymentMethod}</TableCell>
                  <TableCell>{transaction.capturedBy.name}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(Number(transaction.amount))}
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
