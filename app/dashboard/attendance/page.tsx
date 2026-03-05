import Link from "next/link";
import { addDays, endOfMonth, format } from "date-fns";

import { ChurchAttendanceMatrix } from "@/components/attendance/church-attendance-matrix";
import { ServiceLabelSettingsForm } from "@/components/attendance/service-label-settings-form";
import { SelfAttendanceReport } from "@/components/attendance/self-attendance-report";
import { ServiceForm } from "@/components/attendance/service-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";
import {
  canCreateAttendanceService,
  canMarkMemberAttendance,
  canSubmitSelfAttendance,
  resolveAttendanceScope,
} from "@/lib/attendance-scope";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/rbac";
import { assertChurch, requireChurchContext } from "@/lib/tenant";
import { formatPercent } from "@/lib/utils";

type SearchParams = {
  serviceId?: string;
  servicesMonth?: string;
  serviceDate?: string;
  registerYear?: string;
  registerMemberId?: string;
  registerZoneId?: string;
};

function parseMonthParam(value?: string) {
  if (!value) return format(new Date(), "yyyy-MM");
  return /^\d{4}-\d{2}$/.test(value) ? value : format(new Date(), "yyyy-MM");
}

function monthWindowFromParam(monthParam: string) {
  const [yearRaw, monthRaw] = monthParam.split("-");
  const year = Number(yearRaw);
  const monthIndex = Number(monthRaw) - 1;
  const start = new Date(Date.UTC(year, monthIndex, 1));
  const end = new Date(Date.UTC(year, monthIndex + 1, 1));
  return { start, end };
}

function parseServiceDateParam(value: string | undefined, monthParam: string) {
  const fallback = `${monthParam}-01`;
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return fallback;
  }
  return value.startsWith(`${monthParam}-`) ? value : fallback;
}

function sundaysInMonth(monthStart: Date) {
  const monthEndExclusive = addDays(endOfMonth(monthStart), 1);
  const days: Date[] = [];
  for (let cursor = new Date(monthStart); cursor < monthEndExclusive; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    if (cursor.getUTCDay() === 0) {
      days.push(new Date(cursor));
    }
  }
  return days;
}

function buildCalendarDays(monthStart: Date) {
  const monthEnd = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0));
  const gridStart = new Date(monthStart);
  gridStart.setUTCDate(gridStart.getUTCDate() - gridStart.getUTCDay());
  const gridEnd = new Date(monthEnd);
  gridEnd.setUTCDate(gridEnd.getUTCDate() + (6 - gridEnd.getUTCDay()));

  const days: Date[] = [];
  for (let cursor = new Date(gridStart); cursor <= gridEnd; cursor = addDays(cursor, 1)) {
    days.push(new Date(cursor));
  }
  return days;
}

const CALENDAR_DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function formatServiceType(serviceType: "SUNDAY" | "MIDWEEK" | "SPECIAL" | "CUSTOM") {
  switch (serviceType) {
    case "SUNDAY":
      return "Sunday service";
    case "MIDWEEK":
      return "Midweek service";
    case "SPECIAL":
      return "Special event";
    case "CUSTOM":
      return "Custom event";
    default:
      return serviceType;
  }
}

function workflowMessage(input: { canMarkMembers: boolean; canSelfReport: boolean }) {
  if (input.canMarkMembers) {
    return "Mark member attendance quickly with grouped sections and one-click batch actions.";
  }
  if (input.canSelfReport) {
    return "Submit your own attendance report and monitor attendance under your assigned structure.";
  }
  return "View attendance trends and scoped results for your structure.";
}

function statusBadgeVariant(status: "PRESENT" | "ABSENT" | "ONLINE"): "success" | "danger" | "warning" {
  if (status === "PRESENT") return "success";
  if (status === "ONLINE") return "warning";
  return "danger";
}

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const context = await requireChurchContext();
  const churchId = assertChurch(context.churchId);
  const params = await searchParams;

  if (!hasPermission(context.role, "attendance:view")) {
    return (
      <Card>
        <CardTitle>Attendance Access Restricted</CardTitle>
        <CardDescription className="mt-1">Your role does not include attendance access.</CardDescription>
      </Card>
    );
  }

  const scope = await resolveAttendanceScope({
    churchId,
    userId: context.userId,
    role: context.role,
  });

  const canCreateService =
    hasPermission(context.role, "attendance:manage") &&
    canCreateAttendanceService(context.role);
  const canMarkMembers =
    hasPermission(context.role, "attendance:manage") &&
    canMarkMemberAttendance(context.role);
  const canSelfReport =
    hasPermission(context.role, "attendance:self_report") &&
    canSubmitSelfAttendance(context.role);
  const selectedServicesMonth = parseMonthParam(params.servicesMonth);
  const selectedServiceDate = parseServiceDateParam(params.serviceDate, selectedServicesMonth);
  const servicesMonthWindow = monthWindowFromParam(selectedServicesMonth);

  const membersWhere = {
    churchId,
    isDeleted: false,
    membershipStatus: "ACTIVE" as const,
    ...(scope.isFullAccess
      ? {}
      : { homecellId: { in: scope.homecellIds.length ? scope.homecellIds : ["__no_scope__"] } }),
  };

  const [members, churchSettings, selectedServiceFromParam] = await Promise.all([
    db.member.findMany({
      where: membersWhere,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        homecellId: true,
        zoneId: true,
        homecell: { select: { name: true } },
        zone: { select: { name: true } },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    db.church.findUnique({
      where: { id: churchId },
      select: { attendanceServiceLabels: true },
    }),
    params.serviceId
      ? db.service.findFirst({
          where: { churchId, id: params.serviceId },
        })
      : Promise.resolve(null),
  ]);
  const churchServiceLabels = churchSettings?.attendanceServiceLabels ?? [];

  if (canCreateService && churchServiceLabels.length > 0) {
    const sundayDates = sundaysInMonth(servicesMonthWindow.start);
    const existingSundayServices = await db.service.findMany({
      where: {
        churchId,
        serviceType: "SUNDAY",
        title: { in: churchServiceLabels },
        eventDate: {
          gte: servicesMonthWindow.start,
          lt: servicesMonthWindow.end,
        },
      },
      select: { title: true, eventDate: true },
    });
    const existingSet = new Set(
      existingSundayServices.map((service) => `${service.title}|${service.eventDate.toISOString().slice(0, 10)}`),
    );
    const rowsToCreate = sundayDates.flatMap((date) =>
      churchServiceLabels
        .filter((label) => !existingSet.has(`${label}|${date.toISOString().slice(0, 10)}`))
        .map((label) => ({
          churchId,
          title: label,
          serviceType: "SUNDAY" as const,
          eventDate: new Date(date),
          createdById: context.userId,
        })),
    );

    if (rowsToCreate.length > 0) {
      await db.$transaction(rowsToCreate.map((row) => db.service.create({ data: row })));
    }
  }

  const monthServices = await db.service.findMany({
    where: {
      churchId,
      eventDate: {
        gte: servicesMonthWindow.start,
        lt: servicesMonthWindow.end,
      },
    },
    orderBy: [{ eventDate: "asc" }, { title: "asc" }],
  });
  const servicesByDate = new Map<string, typeof monthServices>();
  for (const service of monthServices) {
    const key = service.eventDate.toISOString().slice(0, 10);
    const rows = servicesByDate.get(key) ?? [];
    rows.push(service);
    servicesByDate.set(key, rows);
  }
  const serviceCalendarDays = buildCalendarDays(servicesMonthWindow.start).map((date) => {
    const dateKey = date.toISOString().slice(0, 10);
    const inSelectedMonth =
      date.getUTCFullYear() === servicesMonthWindow.start.getUTCFullYear() &&
      date.getUTCMonth() === servicesMonthWindow.start.getUTCMonth();
    return {
      date,
      dateKey,
      inSelectedMonth,
      services: servicesByDate.get(dateKey) ?? [],
    };
  });

  const selectedService = selectedServiceFromParam ?? monthServices[0] ?? null;
  const registerQuery = new URLSearchParams();
  if (params.registerYear) registerQuery.set("registerYear", params.registerYear);
  if (params.registerMemberId) registerQuery.set("registerMemberId", params.registerMemberId);
  if (params.registerZoneId) registerQuery.set("registerZoneId", params.registerZoneId);
  registerQuery.set("servicesMonth", selectedServicesMonth);
  const servicesMonthLabel = format(servicesMonthWindow.start, "MMMM yyyy");
  const buildAttendanceHref = (input: { serviceId?: string; serviceDate?: string }) => {
    const query = new URLSearchParams(registerQuery.toString());
    if (input.serviceId) {
      query.set("serviceId", input.serviceId);
    } else {
      query.delete("serviceId");
    }
    if (input.serviceDate) {
      query.set("serviceDate", input.serviceDate);
    } else {
      query.delete("serviceDate");
    }
    return `/dashboard/attendance?${query.toString()}`;
  };
  const memberIds = members.map((member) => member.id);

  const [attendance, selfReport] = await Promise.all([
    selectedService
      ? db.attendanceRecord.findFirst({
          where: { churchId, serviceId: selectedService.id },
          include: {
            markedBy: {
              select: {
                name: true,
              },
            },
            entries: {
              where: { memberId: { in: memberIds.length ? memberIds : ["__no_members__"] } },
              select: {
                memberId: true,
                status: true,
                absentReason: true,
                absentNote: true,
                member: {
                  select: {
                    homecellId: true,
                    homecell: { select: { name: true } },
                  },
                },
              },
            },
          },
        })
      : Promise.resolve(null),
    canSelfReport && selectedService
      ? db.leaderAttendanceSelfReport.findUnique({
          where: {
            churchId_serviceId_reporterUserId: {
              churchId,
              serviceId: selectedService.id,
              reporterUserId: context.userId,
            },
          },
          select: {
            status: true,
            note: true,
            updatedAt: true,
          },
        })
      : Promise.resolve(null),
  ]);

  let sameDayServices: Array<{ id: string; title: string }> = [];
  let sameDayExistingEntries: Array<{
    serviceId: string;
    memberId: string;
    status: "PRESENT" | "ABSENT" | "ONLINE";
  }> = [];

  if (selectedService && canMarkMembers) {
    const start = new Date(selectedService.eventDate);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);

    sameDayServices = await db.service.findMany({
      where: {
        churchId,
        serviceType: selectedService.serviceType,
        eventDate: {
          gte: start,
          lt: end,
        },
      },
      select: {
        id: true,
        title: true,
      },
      orderBy: [{ title: "asc" }, { createdAt: "asc" }],
    });

    if (sameDayServices.length > 0) {
      const attendanceRecords = await db.attendanceRecord.findMany({
        where: {
          churchId,
          serviceId: { in: sameDayServices.map((service) => service.id) },
        },
        include: {
          entries: {
            where: { memberId: { in: memberIds.length ? memberIds : ["__no_members__"] } },
            select: {
              memberId: true,
              status: true,
            },
          },
        },
      });

      sameDayExistingEntries = attendanceRecords.flatMap((record) =>
        record.entries.map((entry) => ({
          serviceId: record.serviceId,
          memberId: entry.memberId,
          status: entry.status,
        })),
      );
    }
  }

  const currentYear = new Date().getUTCFullYear();
  const registerYearInput = Number(params.registerYear ?? String(currentYear));
  const registerYear =
    Number.isInteger(registerYearInput) && registerYearInput >= 2000 && registerYearInput <= currentYear + 1
      ? registerYearInput
      : currentYear;
  const registerYearStart = new Date(Date.UTC(registerYear, 0, 1));
  const registerYearEnd = new Date(Date.UTC(registerYear + 1, 0, 1));

  const zones = await db.zone.findMany({
    where: {
      churchId,
      ...(scope.isFullAccess
        ? {}
        : { id: { in: scope.zoneIds.length ? scope.zoneIds : ["__no_scope_zone__"] } }),
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const selectedRegisterZoneId = zones.some((zone) => zone.id === params.registerZoneId) ? params.registerZoneId : "";
  const zoneScopedMembers = selectedRegisterZoneId
    ? members.filter((member) => member.zoneId === selectedRegisterZoneId)
    : members;
  const memberRegisterPool = zoneScopedMembers.length > 0 ? zoneScopedMembers : members;
  const selectedRegisterMemberId = memberRegisterPool.some((member) => member.id === params.registerMemberId)
    ? params.registerMemberId
    : memberRegisterPool[0]?.id ?? "";
  const selectedRegisterMember = memberRegisterPool.find((member) => member.id === selectedRegisterMemberId) ?? null;

  const [memberYearEntries, zoneYearEntries] = await Promise.all([
    selectedRegisterMemberId
      ? db.attendanceEntry.findMany({
          where: {
            churchId,
            memberId: selectedRegisterMemberId,
            attendance: {
              service: {
                eventDate: {
                  gte: registerYearStart,
                  lt: registerYearEnd,
                },
              },
            },
          },
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
          orderBy: {
            attendance: {
              service: {
                eventDate: "desc",
              },
            },
          },
          take: 500,
        })
      : Promise.resolve([]),
    zoneScopedMembers.length > 0
      ? db.attendanceEntry.findMany({
          where: {
            churchId,
            memberId: { in: zoneScopedMembers.map((member) => member.id) },
            attendance: {
              service: {
                eventDate: {
                  gte: registerYearStart,
                  lt: registerYearEnd,
                },
              },
            },
          },
          select: {
            memberId: true,
            status: true,
          },
        })
      : Promise.resolve([]),
  ]);

  const memberYearSummary = memberYearEntries.reduce(
    (acc, entry) => {
      acc.total += 1;
      if (entry.status === "PRESENT") acc.present += 1;
      if (entry.status === "ONLINE") acc.online += 1;
      if (entry.status === "ABSENT") acc.absent += 1;
      return acc;
    },
    { total: 0, present: 0, online: 0, absent: 0 },
  );

  const zoneMemberMap = new Map<
    string,
    { memberId: string; present: number; online: number; absent: number; total: number }
  >();
  for (const member of zoneScopedMembers) {
    zoneMemberMap.set(member.id, {
      memberId: member.id,
      present: 0,
      online: 0,
      absent: 0,
      total: 0,
    });
  }
  for (const entry of zoneYearEntries) {
    const current = zoneMemberMap.get(entry.memberId);
    if (!current) continue;
    current.total += 1;
    if (entry.status === "PRESENT") current.present += 1;
    if (entry.status === "ONLINE") current.online += 1;
    if (entry.status === "ABSENT") current.absent += 1;
  }
  const zoneRegisterRows = zoneScopedMembers
    .map((member) => {
      const row = zoneMemberMap.get(member.id) ?? { memberId: member.id, present: 0, online: 0, absent: 0, total: 0 };
      const attended = row.present + row.online;
      return {
        ...row,
        memberName: `${member.firstName} ${member.lastName}`,
        homecellName: member.homecell?.name ?? "No homecell",
        attendanceRate: row.total ? (attended / row.total) * 100 : 0,
      };
    })
    .sort((a, b) => b.attendanceRate - a.attendanceRate || a.memberName.localeCompare(b.memberName));

  const visibleEntries = attendance?.entries ?? [];
  const presentCount = visibleEntries.filter((entry) => entry.status === "PRESENT").length;
  const onlineCount = visibleEntries.filter((entry) => entry.status === "ONLINE").length;
  const absentCount = visibleEntries.filter((entry) => entry.status === "ABSENT").length;
  const attendanceRate = visibleEntries.length ? ((presentCount + onlineCount) / visibleEntries.length) * 100 : 0;
  const attendanceUpdatedLabel = attendance?.updatedAt ? attendance.updatedAt.toLocaleString() : null;

  const homecellMap = new Map<string, { name: string; total: number; attended: number }>();
  for (const entry of visibleEntries) {
    const key = entry.member.homecellId ?? "unassigned";
    const existing = homecellMap.get(key) ?? {
      name: entry.member.homecell?.name ?? "Unassigned",
      total: 0,
      attended: 0,
    };
    existing.total += 1;
    if (entry.status === "PRESENT" || entry.status === "ONLINE") existing.attended += 1;
    homecellMap.set(key, existing);
  }
  const homecellRows = Array.from(homecellMap.values())
    .map((item) => ({
      ...item,
      rate: item.total ? (item.attended / item.total) * 100 : 0,
    }))
    .sort((a, b) => b.rate - a.rate || a.name.localeCompare(b.name));

  return (
    <div className="space-y-6">
      <Card>
        <CardTitle>Attendance Hub</CardTitle>
        <CardDescription className="mt-1">{workflowMessage({ canMarkMembers, canSelfReport })}</CardDescription>
        <p className="mt-2 text-sm text-slate-600">
          Scope:{" "}
          <span className="font-medium">
            {scope.isFullAccess ? "Full church view" : `${scope.homecellIds.length} homecell(s) under your structure`}
          </span>
        </p>
        <p className="mt-1 text-sm text-slate-600">
          Sunday reporting rule: AM1 and AM2 are merged as one AM attendance slot; PM is separate.
        </p>
        <p className="mt-1 text-sm text-slate-600">
          Service labels:{" "}
          <span className="font-medium">
            {churchServiceLabels.length ? churchServiceLabels.join(", ") : "No labels configured in settings yet."}
          </span>
        </p>
        {canCreateService ? (
          <div className="mt-4">
            <ServiceForm
              serviceLabels={churchServiceLabels}
              defaultEventDate={selectedServiceDate}
              servicesMonth={selectedServicesMonth}
            />
            <div className="mt-3">
              <ServiceLabelSettingsForm churchId={churchId} serviceLabels={churchServiceLabels} />
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-500">Service creation is restricted to Pastor or Church Admin roles.</p>
        )}
      </Card>

      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <p className="text-sm text-slate-500">Members in Scope</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{members.length}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Present</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-700">{presentCount}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Online</p>
          <p className="mt-1 text-2xl font-semibold text-amber-700">{onlineCount}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Absent</p>
          <p className="mt-1 text-2xl font-semibold text-red-700">{absentCount}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Attendance Rate</p>
          <p className="mt-1 text-2xl font-semibold text-sky-700">{formatPercent(attendanceRate)}</p>
        </Card>
      </div>

      <Card>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <CardTitle>Service Calendar</CardTitle>
            <CardDescription className="mt-1">
              Select services directly from the calendar and create missing services per date.
            </CardDescription>
          </div>
          <form method="get" className="flex flex-wrap items-end gap-2">
            {params.registerYear ? <input type="hidden" name="registerYear" value={params.registerYear} /> : null}
            {params.registerMemberId ? (
              <input type="hidden" name="registerMemberId" value={params.registerMemberId} />
            ) : null}
            {params.registerZoneId ? <input type="hidden" name="registerZoneId" value={params.registerZoneId} /> : null}
            <input
              type="month"
              name="servicesMonth"
              defaultValue={selectedServicesMonth}
              className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
            />
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center rounded-lg bg-sky-600 px-4 text-sm font-medium text-white hover:bg-sky-700"
            >
              Load Month
            </button>
          </form>
        </div>
        <p className="mt-3 text-sm text-slate-600">
          Viewing: <span className="font-medium">{servicesMonthLabel}</span>
        </p>
        <div className="mt-4 grid grid-cols-7 gap-2 text-xs font-medium text-slate-500">
          {CALENDAR_DAY_LABELS.map((label) => (
            <p key={label} className="rounded-md bg-slate-50 py-1 text-center">
              {label}
            </p>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-7">
          {serviceCalendarDays.map((day) => (
            <div
              key={day.dateKey}
              className={`rounded-xl border p-2 ${
                day.inSelectedMonth ? "border-slate-200 bg-white" : "border-slate-100 bg-slate-50/60"
              }`}
            >
              <div className="flex items-center justify-between">
                <p
                  className={`text-xs font-semibold ${
                    day.inSelectedMonth ? "text-slate-800" : "text-slate-400"
                  }`}
                >
                  {day.date.getUTCDate()}
                </p>
                {canCreateService && day.inSelectedMonth ? (
                  <Link
                    href={buildAttendanceHref({ serviceDate: day.dateKey })}
                    className="text-[11px] font-medium text-sky-700 hover:underline"
                  >
                    Create
                  </Link>
                ) : null}
              </div>
              <div className="mt-2 space-y-1">
                {day.services.map((service) => (
                  <Link
                    key={service.id}
                    href={buildAttendanceHref({
                      serviceId: service.id,
                      serviceDate: service.eventDate.toISOString().slice(0, 10),
                    })}
                    className={`block rounded-md border px-2 py-1 text-[11px] leading-tight ${
                      selectedService?.id === service.id
                        ? "border-sky-200 bg-sky-50 text-sky-700"
                        : "border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {service.title}
                  </Link>
                ))}
                {day.services.length === 0 ? (
                  <p className="text-[11px] text-slate-400">{day.inSelectedMonth ? "No service" : "-"}</p>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {selectedService ? (
        <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
          <Card>
            <CardTitle>
              {canMarkMembers ? "Mark Attendance" : "Leadership Attendance"}: {selectedService.title} (
              {selectedService.eventDate.toDateString()})
            </CardTitle>
            <CardDescription className="mt-1">
              {formatServiceType(selectedService.serviceType)} |{" "}
              {attendanceUpdatedLabel
                ? `Last saved ${attendanceUpdatedLabel}${attendance?.markedBy?.name ? ` by ${attendance.markedBy.name}` : ""}.`
                : "No attendance record saved yet for this service."}
            </CardDescription>
            <div className="mt-4">
              {canMarkMembers ? (
                members.length > 0 ? (
                  sameDayServices.length > 0 ? (
                    <ChurchAttendanceMatrix
                      key={`${selectedService.id}-matrix`}
                      services={sameDayServices}
                      members={members.map((member) => ({
                        id: member.id,
                        firstName: member.firstName,
                        lastName: member.lastName,
                        homecellName: member.homecell?.name ?? null,
                      }))}
                      existing={sameDayExistingEntries}
                    />
                  ) : (
                    <CardDescription>No services are available for this date yet.</CardDescription>
                  )
                ) : (
                  <CardDescription>
                    No active members are assigned to your structure scope yet.
                  </CardDescription>
                )
              ) : canSelfReport ? (
                <SelfAttendanceReport
                  key={selectedService.id}
                  serviceId={selectedService.id}
                  initialStatus={selfReport?.status ?? "PRESENT"}
                  initialNote={selfReport?.note ?? ""}
                  submittedAtLabel={selfReport?.updatedAt ? selfReport.updatedAt.toLocaleString() : null}
                />
              ) : (
                <CardDescription>
                  You have view-only attendance access. Contact your Pastor or Church Admin for marking privileges.
                </CardDescription>
              )}
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <CardTitle>Structure Snapshot</CardTitle>
              <Badge>{homecellRows.length} homecells</Badge>
            </div>
            <CardDescription className="mt-1">Attendance performance for the members under your scope.</CardDescription>
            <div className="mt-4 overflow-x-auto">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>Homecell</TableHeaderCell>
                    <TableHeaderCell>Attended</TableHeaderCell>
                    <TableHeaderCell>Total</TableHeaderCell>
                    <TableHeaderCell>Rate</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {homecellRows.map((row) => (
                    <TableRow key={row.name}>
                      <TableCell>{row.name}</TableCell>
                      <TableCell>{row.attended}</TableCell>
                      <TableCell>{row.total}</TableCell>
                      <TableCell>{formatPercent(row.rate)}</TableCell>
                    </TableRow>
                  ))}
                  {homecellRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-sm text-slate-500">
                        No scoped attendance data yet for this service.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      ) : (
        <Card>
          <CardDescription>No services available. Create a service first.</CardDescription>
        </Card>
      )}

      <Card>
        <CardTitle>Attendance Register</CardTitle>
        <CardDescription className="mt-1">
          Yearly register by member and zone. Green = Present, Orange = Online, Red = Absent.
        </CardDescription>

        <form method="get" className="mt-4 grid gap-3 md:grid-cols-4">
          {selectedService?.id ? <input type="hidden" name="serviceId" value={selectedService.id} /> : null}
          <input type="hidden" name="servicesMonth" value={selectedServicesMonth} />
          <select
            name="registerYear"
            defaultValue={String(registerYear)}
            className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
          >
            {Array.from({ length: 6 }).map((_, index) => {
              const year = currentYear - index;
              return (
                <option key={year} value={year}>
                  {year}
                </option>
              );
            })}
          </select>
          <select
            name="registerZoneId"
            defaultValue={selectedRegisterZoneId}
            className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
          >
            <option value="">All scoped zones</option>
            {zones.map((zone) => (
              <option key={zone.id} value={zone.id}>
                {zone.name}
              </option>
            ))}
          </select>
          <select
            name="registerMemberId"
            defaultValue={selectedRegisterMemberId}
            className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
          >
            {memberRegisterPool.map((member) => (
              <option key={member.id} value={member.id}>
                {member.firstName} {member.lastName}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-sky-600 px-4 text-sm font-medium text-white hover:bg-sky-700"
          >
            Load Register
          </button>
        </form>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card className="border border-slate-200">
            <CardTitle>Member Register ({registerYear})</CardTitle>
            <CardDescription className="mt-1">
              {selectedRegisterMember
                ? `${selectedRegisterMember.firstName} ${selectedRegisterMember.lastName}`
                : "No member selected"}
            </CardDescription>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant="success">Present: {memberYearSummary.present}</Badge>
              <Badge variant="warning">Online: {memberYearSummary.online}</Badge>
              <Badge variant="danger">Absent: {memberYearSummary.absent}</Badge>
              <Badge>Total: {memberYearSummary.total}</Badge>
            </div>
            <div className="mt-4 max-h-80 overflow-auto">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>Date</TableHeaderCell>
                    <TableHeaderCell>Service</TableHeaderCell>
                    <TableHeaderCell>Status</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {memberYearEntries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>{entry.attendance.service.eventDate.toISOString().slice(0, 10)}</TableCell>
                      <TableCell>{entry.attendance.service.title}</TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant(entry.status)}>{entry.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {memberYearEntries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-sm text-slate-500">
                        No attendance records for this member in {registerYear}.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          </Card>

          <Card className="border border-slate-200">
            <CardTitle>Zone Register ({registerYear})</CardTitle>
            <CardDescription className="mt-1">
              {selectedRegisterZoneId
                ? zones.find((zone) => zone.id === selectedRegisterZoneId)?.name ?? "Selected zone"
                : "All zones in your scope"}
            </CardDescription>
            <div className="mt-4 max-h-80 overflow-auto">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>Member</TableHeaderCell>
                    <TableHeaderCell>Present</TableHeaderCell>
                    <TableHeaderCell>Online</TableHeaderCell>
                    <TableHeaderCell>Absent</TableHeaderCell>
                    <TableHeaderCell>Total</TableHeaderCell>
                    <TableHeaderCell>Rate</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {zoneRegisterRows.map((row) => (
                    <TableRow key={row.memberId}>
                      <TableCell>
                        <p className="font-medium text-slate-800">{row.memberName}</p>
                        <p className="text-xs text-slate-500">{row.homecellName}</p>
                      </TableCell>
                      <TableCell className="text-emerald-700">{row.present}</TableCell>
                      <TableCell className="text-amber-700">{row.online}</TableCell>
                      <TableCell className="text-red-700">{row.absent}</TableCell>
                      <TableCell>{row.total}</TableCell>
                      <TableCell>{formatPercent(row.attendanceRate)}</TableCell>
                    </TableRow>
                  ))}
                  {zoneRegisterRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-sm text-slate-500">
                        No zone attendance records for {registerYear}.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      </Card>
    </div>
  );
}
