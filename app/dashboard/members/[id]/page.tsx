import { notFound } from "next/navigation";

import { ArchiveMemberButton } from "@/components/members/archive-member-button";
import { MemberForm } from "@/components/members/member-form";
import { MemberNoteForm } from "@/components/members/member-note-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { db } from "@/lib/db";
import { resolveMemberScope } from "@/lib/member-scope";
import { hasPermission } from "@/lib/rbac";
import { assertChurch, requireChurchContext } from "@/lib/tenant";
import { formatCurrency, formatPercent } from "@/lib/utils";

export default async function MemberProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const context = await requireChurchContext();
  const churchId = assertChurch(context.churchId);
  const { id } = await params;
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

  const [member, homecells, departments] = await Promise.all([
    db.member.findFirst({
      where: {
        id,
        churchId,
        isDeleted: false,
        ...(scope.isFullAccess ? {} : { homecellId: { in: scopedHomecellIds } }),
      },
      include: {
        homecell: { select: { name: true } },
        department: { select: { name: true } },
        notes: {
          include: {
            author: { select: { name: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        attendanceEntries: {
          include: {
            attendance: {
              include: {
                service: {
                  select: {
                    title: true,
                    eventDate: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 30,
        },
        financeTransactions: {
          orderBy: { transactionDate: "desc" },
          take: 30,
        },
        ltvStatuses: {
          orderBy: { monthStartDate: "desc" },
          take: 1,
        },
      },
    }),
    db.homecell.findMany({
      where: {
        churchId,
        ...(scope.isFullAccess ? {} : { id: { in: scopedHomecellIds } }),
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.department.findMany({
      where: { churchId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!member) {
    notFound();
  }

  const canManage = hasPermission(context.role, "members:manage");
  const canViewNotes = hasPermission(context.role, "members:notes");
  const attendancePresent = member.attendanceEntries.filter(
    (entry) => entry.status === "PRESENT" || entry.status === "ONLINE",
  ).length;
  const attendanceRate = member.attendanceEntries.length
    ? (attendancePresent / member.attendanceEntries.length) * 100
    : 0;
  const givingTotal = member.financeTransactions.reduce((acc, tx) => acc + Number(tx.amount), 0);
  const latestLtv = member.ltvStatuses[0];
  const jimTrack = [
    { label: "John 3:16", completed: member.jimJohn316Status },
    { label: "SGT", completed: member.jimSgtStatus },
    { label: "DISC", completed: member.jimDiscStatus },
    { label: "NLT", completed: member.jimNltStatus },
  ];

  const tabData = [
    {
      key: "overview",
      label: "Overview",
      content: (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardTitle>Personal Details</CardTitle>
            <div className="mt-3 space-y-2 text-sm text-slate-600">
              <p>Gender: {member.gender}</p>
              <p>Date of birth: {member.dateOfBirth ? member.dateOfBirth.toDateString() : "-"}</p>
              <p>Date joined: {member.dateJoined.toDateString()}</p>
              <p>Membership status: {member.membershipStatus}</p>
              <p>Salvation confirmed: {member.salvationStatus ? "Yes" : "No"}</p>
            </div>
          </Card>
          <Card>
            <CardTitle>Contact Details</CardTitle>
            <div className="mt-3 space-y-2 text-sm text-slate-600">
              <p>Phone: {member.phone ?? "-"}</p>
              <p>Email: {member.email ?? "-"}</p>
              <p>Emergency contact name: {member.emergencyContactName ?? "-"}</p>
              <p>Emergency contact phone: {member.emergencyContactPhone ?? "-"}</p>
            </div>
          </Card>
          <Card>
            <CardTitle>Residence Details</CardTitle>
            <div className="mt-3 space-y-2 text-sm text-slate-600">
              <p>Address: {member.address ?? "-"}</p>
            </div>
          </Card>
          <Card>
            <CardTitle>Demographic Details</CardTitle>
            <div className="mt-3 space-y-2 text-sm text-slate-600">
              <p>Marital status: {member.maritalStatus ?? "-"}</p>
              <p>Occupation: {member.occupation ?? "-"}</p>
            </div>
          </Card>
          <Card>
            <CardTitle>JIM TRACK</CardTitle>
            <div className="mt-3 space-y-2 text-sm text-slate-600">
              {jimTrack.map((step) => (
                <p key={step.label}>
                  {step.label}: {step.completed ? "Completed" : "Pending"}
                </p>
              ))}
            </div>
          </Card>
          <Card>
            <CardTitle>Baptism</CardTitle>
            <div className="mt-3 space-y-2 text-sm text-slate-600">
              <p>Water baptism: {member.baptismStatus ? "Yes" : "No"}</p>
              <p>Holy Spirit baptism: {member.holySpiritBaptismStatus ? "Yes" : "No"}</p>
            </div>
          </Card>
          <Card>
            <CardTitle>Involvement</CardTitle>
            <div className="mt-3 space-y-2 text-sm text-slate-600">
              <p>Homecell: {member.homecell?.name ?? "Unassigned"}</p>
              <p>Department: {member.department?.name ?? "Unassigned"}</p>
              <p>Notes: {member.involvementNotes ?? "-"}</p>
            </div>
          </Card>
        </div>
      ),
    },
    {
      key: "attendance",
      label: "Attendance",
      content: (
        <Card>
          <CardTitle>Attendance History</CardTitle>
          <CardDescription className="mt-1">
            Current attendance rate: {formatPercent(attendanceRate)}
          </CardDescription>
          <div className="mt-3 space-y-2">
            {member.attendanceEntries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm"
              >
                <p className="font-medium text-slate-700">{entry.attendance.service.title}</p>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">
                    {entry.attendance.service.eventDate.toDateString()}
                  </span>
                  <Badge
                    variant={
                      entry.status === "PRESENT"
                        ? "success"
                        : entry.status === "ONLINE"
                          ? "warning"
                          : "danger"
                    }
                  >
                    {entry.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ),
    },
    {
      key: "giving",
      label: "Giving",
      content: (
        <Card>
          <CardTitle>Giving History</CardTitle>
          <CardDescription className="mt-1">Recent total: {formatCurrency(givingTotal)}</CardDescription>
          <div className="mt-4 overflow-x-auto">
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Date</TableHeaderCell>
                  <TableHeaderCell>Type</TableHeaderCell>
                  <TableHeaderCell>Method</TableHeaderCell>
                  <TableHeaderCell className="text-right">Amount</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {member.financeTransactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell>{tx.transactionDate.toDateString()}</TableCell>
                    <TableCell>{tx.financeType}</TableCell>
                    <TableCell>{tx.paymentMethod}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(Number(tx.amount))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      ),
    },
    {
      key: "ltv",
      label: "LTV",
      content: (
        <Card>
          <CardTitle>LTV Status</CardTitle>
          {latestLtv ? (
            <div className="mt-3 space-y-3">
              <div className="flex flex-wrap gap-2">
                {latestLtv.isLeader ? <Badge variant="success">Leader</Badge> : null}
                {latestLtv.isTither ? <Badge variant="success">Tither</Badge> : null}
                {latestLtv.isVolunteer ? <Badge variant="success">Volunteer</Badge> : null}
                {!latestLtv.badgeCount ? <Badge variant="warning">No badges yet</Badge> : null}
              </div>
              <p className="text-sm text-slate-600">
                Attendance score: {formatPercent(latestLtv.attendanceRate)}
              </p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">LTV has not been computed for this member yet.</p>
          )}
        </Card>
      ),
    },
    {
      key: "notes",
      label: "Notes",
      content: (
        <Card>
          <CardTitle>Private Pastoral Notes</CardTitle>
          <CardDescription className="mt-1">
            Restricted by RBAC. Visible to Pastor, Overseer, Church Admin, and Super Admin.
          </CardDescription>
          {canViewNotes ? (
            <div className="mt-4 space-y-4">
              <MemberNoteForm memberId={member.id} />
              <div className="space-y-2">
                {member.notes.map((note) => (
                  <div key={note.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm">
                    <p className="text-slate-700">{note.content}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {note.author.name} · {note.createdAt.toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">You do not have permission to view notes.</p>
          )}
        </Card>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <Card className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <div className="h-20 w-20 overflow-hidden rounded-xl bg-slate-100">
            {member.profilePhotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={member.profilePhotoUrl} alt={member.firstName} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-slate-500">
                {member.firstName[0]}
                {member.lastName[0]}
              </div>
            )}
          </div>
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">
              {member.firstName} {member.lastName}
            </h2>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant="default">{member.membershipStatus}</Badge>
              {latestLtv?.isLeader ? <Badge variant="success">Leader</Badge> : null}
              {latestLtv?.isTither ? <Badge variant="success">Tither</Badge> : null}
              {latestLtv?.isVolunteer ? <Badge variant="success">Volunteer</Badge> : null}
            </div>
          </div>
        </div>
        {canManage ? <ArchiveMemberButton memberId={member.id} /> : null}
      </Card>

      <Tabs tabs={tabData} defaultKey="overview" />

      {canManage ? (
        <Card>
          <CardTitle>Edit Member</CardTitle>
          <div className="mt-4">
            <MemberForm
              mode="edit"
              memberId={member.id}
              departments={departments}
              homecells={homecells}
              initialValues={{
                firstName: member.firstName,
                lastName: member.lastName,
                gender: member.gender,
                dateOfBirth: member.dateOfBirth?.toISOString().slice(0, 10) ?? "",
                phone: member.phone ?? "",
                email: member.email ?? "",
                address: member.address ?? "",
                maritalStatus: member.maritalStatus ?? "",
                occupation: member.occupation ?? "",
                dateJoined: member.dateJoined.toISOString().slice(0, 10),
                salvationStatus: member.salvationStatus,
                baptismStatus: member.baptismStatus,
                holySpiritBaptismStatus: member.holySpiritBaptismStatus,
                jimJohn316Status: member.jimJohn316Status,
                jimSgtStatus: member.jimSgtStatus,
                jimDiscStatus: member.jimDiscStatus,
                jimNltStatus: member.jimNltStatus,
                involvementNotes: member.involvementNotes ?? "",
                membershipStatus: member.membershipStatus,
                departmentId: member.departmentId ?? "",
                homecellId: member.homecellId ?? "",
                emergencyContactName: member.emergencyContactName ?? "",
                emergencyContactPhone: member.emergencyContactPhone ?? "",
                profilePhotoUrl: member.profilePhotoUrl ?? "",
              }}
            />
          </div>
        </Card>
      ) : null}
    </div>
  );
}
