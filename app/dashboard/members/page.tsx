import Link from "next/link";
import { Prisma, Role } from "@prisma/client";

import { MemberForm } from "@/components/members/member-form";
import { MemberFilters } from "@/components/members/member-filters";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";
import { db } from "@/lib/db";
import { resolveMemberScope } from "@/lib/member-scope";
import { hasPermission } from "@/lib/rbac";
import { assertChurch, requireChurchContext } from "@/lib/tenant";

type SearchParams = {
  q?: string;
  page?: string;
  homecellId?: string;
  departmentId?: string;
  status?: "ACTIVE" | "INACTIVE" | "VISITOR";
};

const pageSize = 12;

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const context = await requireChurchContext();
  const churchId = assertChurch(context.churchId);
  const params = await searchParams;
  const page = Number(params.page ?? "1");
  const canManage = hasPermission(context.role, "members:manage");
  const scope = await resolveMemberScope({
    churchId,
    userId: context.userId,
    role: context.role,
  });
  const scopedHomecellIds = scope.isFullAccess
    ? []
    : scope.homecellIds.length > 0
      ? scope.homecellIds
      : ["__no_scope__"];

  const whereAnd: Prisma.MemberWhereInput[] = [];
  if (!scope.isFullAccess) {
    whereAnd.push({ homecellId: { in: scopedHomecellIds } });
  }
  if (params.homecellId) {
    whereAnd.push({ homecellId: params.homecellId });
  }

  const where: Prisma.MemberWhereInput = {
    churchId,
    isDeleted: false,
    membershipStatus: params.status || undefined,
    departmentId: params.departmentId || undefined,
    ...(whereAnd.length > 0 ? { AND: whereAnd } : {}),
    OR: params.q
      ? [
          { firstName: { contains: params.q, mode: "insensitive" as const } },
          { lastName: { contains: params.q, mode: "insensitive" as const } },
          { phone: { contains: params.q, mode: "insensitive" as const } },
          { email: { contains: params.q, mode: "insensitive" as const } },
        ]
      : undefined,
  };

  const [members, totalMembers, homecells, departments] = await Promise.all([
    db.member.findMany({
      where,
      include: {
        homecell: { select: { name: true } },
        department: { select: { name: true } },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.member.count({ where }),
    db.homecell.findMany({
      where: {
        churchId,
        ...(scope.isFullAccess ? {} : { id: { in: scopedHomecellIds } }),
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.department.findMany({
      where: {
        churchId,
        ...(scope.isFullAccess
          ? {}
          : {
              members: {
                some: {
                  churchId,
                  isDeleted: false,
                  homecellId: { in: scopedHomecellIds },
                },
              },
            }),
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const totalPages = Math.max(Math.ceil(totalMembers / pageSize), 1);

  return (
    <div className="space-y-6">
      <Card>
        <CardTitle>Membership</CardTitle>
        <CardDescription className="mt-1">
          Smart search, filters, quick card view, and profile drill-down with attendance/giving history.
        </CardDescription>
        <p className="mt-2 text-sm text-slate-600">
          Scope:{" "}
          <span className="font-medium">
            {scope.isFullAccess ? "Full church view" : `${scope.homecellIds.length} homecell(s) under your structure`}
          </span>
        </p>
        {!scope.isFullAccess && scope.homecellIds.length === 0 ? (
          <p className="mt-1 text-sm text-amber-700">
            No structure assignment found yet. Ask your Pastor or Church Admin to assign your scope.
          </p>
        ) : null}
        <div className="mt-4">
          <MemberFilters homecells={homecells} departments={departments} />
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Name</TableHeaderCell>
              <TableHeaderCell>Contacts</TableHeaderCell>
              <TableHeaderCell>Homecell</TableHeaderCell>
              <TableHeaderCell>Department</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell className="text-right">Action</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {members.map((member) => (
              <TableRow key={member.id}>
                <TableCell>
                  <div className="space-y-0.5">
                    <p className="font-medium text-slate-900">
                      {member.firstName} {member.lastName}
                    </p>
                    <p className="text-xs text-slate-500">{member.occupation ?? "No occupation set"}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <p>{member.phone ?? "-"}</p>
                  <p className="text-xs text-slate-500">{member.email ?? "-"}</p>
                </TableCell>
                <TableCell>{member.homecell?.name ?? "-"}</TableCell>
                <TableCell>{member.department?.name ?? "-"}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      member.membershipStatus === "ACTIVE"
                        ? "success"
                        : member.membershipStatus === "INACTIVE"
                          ? "warning"
                          : "default"
                    }
                  >
                    {member.membershipStatus}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Link
                    href={`/dashboard/members/${member.id}`}
                    className="text-sm font-medium text-sky-700 hover:underline"
                  >
                    Open profile
                  </Link>
                </TableCell>
              </TableRow>
            ))}
            {members.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-6 text-center text-sm text-slate-500">
                  No members found for your current filters and scope.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
        <div className="border-t border-slate-100 p-4">
          <Pagination
            page={page}
            totalPages={totalPages}
            buildHref={(targetPage) => {
              const query = new URLSearchParams();
              if (params.q) query.set("q", params.q);
              if (params.homecellId) query.set("homecellId", params.homecellId);
              if (params.departmentId) query.set("departmentId", params.departmentId);
              if (params.status) query.set("status", params.status);
              query.set("page", String(targetPage));
              return `/dashboard/members?${query.toString()}`;
            }}
          />
        </div>
      </Card>

      {canManage && context.role !== Role.FINANCE_ADMIN ? (
        <Card>
          <CardTitle>Add Member Profile</CardTitle>
          <CardDescription className="mt-1">
            Capture personal, contact, residence, demographic, discipleship, baptism, and involvement details.
          </CardDescription>
          <div className="mt-4">
            <MemberForm mode="create" departments={departments} homecells={homecells} />
          </div>
        </Card>
      ) : null}
    </div>
  );
}
