"use client";

import { Search } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { submitChurchAttendanceMatrixAction } from "@/app/dashboard/attendance/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ServiceItem = {
  id: string;
  title: string;
};

type MemberItem = {
  id: string;
  firstName: string;
  lastName: string;
  homecellName?: string | null;
};

type ExistingEntry = {
  serviceId: string;
  memberId: string;
  status: "PRESENT" | "ABSENT" | "ONLINE";
};

type ChurchAttendanceMatrixProps = {
  services: ServiceItem[];
  members: MemberItem[];
  existing: ExistingEntry[];
};

function buildInitialState(input: {
  services: ServiceItem[];
  members: MemberItem[];
  existing: ExistingEntry[];
}) {
  const statusMap = new Map(
    input.existing.map((entry) => [`${entry.memberId}:${entry.serviceId}`, entry.status]),
  );

  const presentKeys = new Set(
    input.existing
      .filter((entry) => entry.status === "PRESENT" || entry.status === "ONLINE")
      .map((entry) => `${entry.memberId}:${entry.serviceId}`),
  );
  const onlineKeys = new Set(
    input.existing
      .filter((entry) => entry.status === "ONLINE")
      .map((entry) => `${entry.memberId}:${entry.serviceId}`),
  );

  const matrix: Record<string, Record<string, boolean>> = {};
  const onlineMatrix: Record<string, Record<string, boolean>> = {};
  for (const member of input.members) {
    matrix[member.id] = {};
    onlineMatrix[member.id] = {};
    for (const service of input.services) {
      const key = `${member.id}:${service.id}`;
      const status = statusMap.get(key);
      matrix[member.id][service.id] = presentKeys.has(key);
      onlineMatrix[member.id][service.id] = status === "ONLINE" || onlineKeys.has(key);
    }
  }
  return { attended: matrix, online: onlineMatrix };
}

export function ChurchAttendanceMatrix({ services, members, existing }: ChurchAttendanceMatrixProps) {
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const initialState = useMemo(() => buildInitialState({ services, members, existing }), [existing, members, services]);
  const [attendedMatrix, setAttendedMatrix] = useState(initialState.attended);
  const [onlineMatrix, setOnlineMatrix] = useState(initialState.online);

  const filteredMembers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return members;
    return members.filter((member) =>
      `${member.firstName} ${member.lastName} ${member.homecellName ?? ""}`
        .toLowerCase()
        .includes(normalized),
    );
  }, [members, query]);

  const totalSelections = useMemo(
    () =>
      members.reduce(
        (count, member) =>
          count + services.filter((service) => attendedMatrix[member.id]?.[service.id]).length,
        0,
      ),
    [attendedMatrix, members, services],
  );

  const totalOnlineSelections = useMemo(
    () =>
      members.reduce(
        (count, member) =>
          count + services.filter((service) => onlineMatrix[member.id]?.[service.id]).length,
        0,
      ),
    [members, onlineMatrix, services],
  );

  function toggleMemberAttended(memberId: string, serviceId: string) {
    const nextAttended = !Boolean(attendedMatrix[memberId]?.[serviceId]);
    setAttendedMatrix((current) => ({
      ...current,
      [memberId]: {
        ...current[memberId],
        [serviceId]: nextAttended,
      },
    }));

    if (!nextAttended) {
      setOnlineMatrix((current) => ({
        ...current,
        [memberId]: {
          ...current[memberId],
          [serviceId]: false,
        },
      }));
    }
  }

  function toggleMemberOnline(memberId: string, serviceId: string) {
    const currentlyOnline = Boolean(onlineMatrix[memberId]?.[serviceId]);
    setOnlineMatrix((current) => ({
      ...current,
      [memberId]: {
        ...current[memberId],
        [serviceId]: !currentlyOnline,
      },
    }));

    if (!attendedMatrix[memberId]?.[serviceId]) {
      setAttendedMatrix((current) => ({
        ...current,
        [memberId]: {
          ...current[memberId],
          [serviceId]: true,
        },
      }));
    }
  }

  function setColumnForVisible(serviceId: string, value: boolean) {
    setAttendedMatrix((current) => {
      const next = { ...current };
      for (const member of filteredMembers) {
        next[member.id] = {
          ...next[member.id],
          [serviceId]: value,
        };
      }
      return next;
    });

    if (!value) {
      setOnlineMatrix((current) => {
        const next = { ...current };
        for (const member of filteredMembers) {
          next[member.id] = {
            ...next[member.id],
            [serviceId]: false,
          };
        }
        return next;
      });
    }
  }

  function submit() {
    startTransition(async () => {
      const payload = {
        serviceIds: services.map((service) => service.id),
        entries: members.map((member) => ({
          memberId: member.id,
          attendedServiceIds: services
            .filter((service) => attendedMatrix[member.id]?.[service.id])
            .map((service) => service.id),
          onlineServiceIds: services
            .filter((service) => onlineMatrix[member.id]?.[service.id])
            .map((service) => service.id),
        })),
      };

      const result = await submitChurchAttendanceMatrixAction(payload);
      if (!result.success) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs text-slate-500">Members in scope</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{members.length}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs text-slate-500">Configured services</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{services.length}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-sky-50 p-3">
          <p className="text-xs text-sky-600">Total service check-ins</p>
          <p className="mt-1 text-xl font-semibold text-sky-700">{totalSelections}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-amber-50 p-3">
          <p className="text-xs text-amber-600">Online check-ins</p>
          <p className="mt-1 text-xl font-semibold text-amber-700">{totalOnlineSelections}</p>
        </div>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          className="pl-9"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search member or homecell..."
        />
      </div>

      <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
        <p className="text-xs text-slate-500">Quick column actions (visible members only)</p>
        <div className="flex flex-wrap gap-2">
          {services.map((service) => (
            <div key={service.id} className="flex items-center gap-2 rounded-lg border border-slate-200 px-2 py-1">
              <span className="text-xs text-slate-600">{service.title}</span>
              <Button
                type="button"
                variant="outline"
                onClick={() => setColumnForVisible(service.id, true)}
                disabled={filteredMembers.length === 0}
              >
                Check all
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setColumnForVisible(service.id, false)}
                disabled={filteredMembers.length === 0}
              >
                Clear
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-slate-700">Member</th>
              {services.map((service) => (
                <th key={service.id} className="px-3 py-2 text-center font-medium text-slate-700">
                  {service.title}
                </th>
              ))}
              <th className="px-3 py-2 text-center font-medium text-slate-700">Total</th>
            </tr>
          </thead>
          <tbody>
            {filteredMembers.map((member) => {
              const rowTotal = services.filter((service) => attendedMatrix[member.id]?.[service.id]).length;
              const rowOnline = services.filter((service) => onlineMatrix[member.id]?.[service.id]).length;
              return (
                <tr key={member.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">
                    <p className="font-medium text-slate-800">
                      {member.firstName} {member.lastName}
                    </p>
                    <p className="text-xs text-slate-500">{member.homecellName ?? "No homecell"}</p>
                  </td>
                  {services.map((service) => (
                    <td key={service.id} className="px-3 py-2 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <label className="inline-flex items-center gap-1 text-xs text-slate-600">
                          <input
                            type="checkbox"
                            checked={Boolean(attendedMatrix[member.id]?.[service.id])}
                            onChange={() => toggleMemberAttended(member.id, service.id)}
                          />
                          In
                        </label>
                        <label className="inline-flex items-center gap-1 text-xs text-amber-700">
                          <input
                            type="checkbox"
                            checked={Boolean(onlineMatrix[member.id]?.[service.id])}
                            disabled={!attendedMatrix[member.id]?.[service.id]}
                            onChange={() => toggleMemberOnline(member.id, service.id)}
                          />
                          On
                        </label>
                      </div>
                    </td>
                  ))}
                  <td className="px-3 py-2 text-center font-semibold text-slate-700">
                    {rowTotal}
                    {rowOnline > 0 ? <span className="ml-1 text-xs text-amber-700">({rowOnline} online)</span> : null}
                  </td>
                </tr>
              );
            })}
            {filteredMembers.length === 0 ? (
              <tr>
                <td colSpan={services.length + 2} className="px-3 py-6 text-center text-sm text-slate-500">
                  No members match your search.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end">
        <Button onClick={submit} disabled={isPending || members.length === 0 || services.length === 0}>
          {isPending ? "Saving..." : "Save Church Attendance"}
        </Button>
      </div>
    </div>
  );
}
