"use client";

import { Search } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { submitAttendanceAction } from "@/app/dashboard/attendance/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type MemberItem = {
  id: string;
  firstName: string;
  lastName: string;
  homecellName?: string | null;
};

type ExistingEntry = {
  memberId: string;
  status: "PRESENT" | "ABSENT" | "ONLINE";
  absentReason?: string | null;
  absentNote?: string | null;
};

type AttendanceBoardProps = {
  serviceId: string;
  members: MemberItem[];
  existing: ExistingEntry[];
};

type EntryState = {
  status: "PRESENT" | "ABSENT" | "ONLINE";
  absentReason: string;
  absentNote: string;
};

const absenceReasons = ["Travel", "Sick", "Work", "Family", "Unknown"];

export function AttendanceBoard({ serviceId, members, existing }: AttendanceBoardProps) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PRESENT" | "ABSENT" | "ONLINE">("ALL");
  const [isPending, startTransition] = useTransition();

  const existingByMemberId = useMemo(
    () => new Map(existing.map((entry) => [entry.memberId, entry])),
    [existing],
  );

  const seededEntries = useMemo(() => {
    const seeded: Record<string, EntryState> = {};
    for (const member of members) {
      const existingEntry = existingByMemberId.get(member.id);
      seeded[member.id] = {
        status: existingEntry?.status ?? "PRESENT",
        absentReason: existingEntry?.absentReason ?? "",
        absentNote: existingEntry?.absentNote ?? "",
      };
    }
    return seeded;
  }, [existingByMemberId, members]);

  const [entries, setEntries] = useState<Record<string, EntryState>>(seededEntries);

  const filteredMembers = useMemo(() => {
    const normalized = query.toLowerCase().trim();
    const queryFiltered = !normalized
      ? members
      : members.filter((member) =>
      `${member.firstName} ${member.lastName} ${member.homecellName ?? ""}`
        .toLowerCase()
        .includes(normalized),
      );

    if (statusFilter === "ALL") return queryFiltered;
    return queryFiltered.filter((member) => (entries[member.id]?.status ?? "PRESENT") === statusFilter);
  }, [entries, members, query, statusFilter]);

  const summary = useMemo(() => {
    let present = 0;
    let online = 0;
    let absent = 0;
    for (const member of members) {
      const status = entries[member.id]?.status ?? "PRESENT";
      if (status === "PRESENT") present += 1;
      if (status === "ONLINE") online += 1;
      if (status === "ABSENT") absent += 1;
    }
    return {
      total: members.length,
      present,
      online,
      absent,
      attendanceRate: members.length ? ((present + online) / members.length) * 100 : 0,
    };
  }, [entries, members]);

  const groupedMembers = useMemo(() => {
    const groups = new Map<string, MemberItem[]>();
    for (const member of filteredMembers) {
      const key = member.homecellName?.trim() || "No Homecell";
      const current = groups.get(key) ?? [];
      current.push(member);
      groups.set(key, current);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredMembers]);

  const membersMissingAbsenceReason = useMemo(
    () =>
      members.filter((member) => {
        const entry = entries[member.id];
        return entry?.status === "ABSENT" && !entry.absentReason.trim();
      }),
    [entries, members],
  );

  function markAllPresent() {
    setEntries((current) => {
      const next = { ...current };
      for (const member of members) {
        next[member.id] = { status: "PRESENT", absentReason: "", absentNote: "" };
      }
      return next;
    });
  }

  function markVisibleAs(status: "PRESENT" | "ABSENT" | "ONLINE") {
    setEntries((current) => {
      const next = { ...current };
      for (const member of filteredMembers) {
        next[member.id] = {
          ...next[member.id],
          status,
          absentReason: status === "ABSENT" ? next[member.id]?.absentReason ?? "" : "",
          absentNote: status === "ABSENT" ? next[member.id]?.absentNote ?? "" : "",
        };
      }
      return next;
    });
  }

  function markGroupAs(status: "PRESENT" | "ABSENT" | "ONLINE", groupMembers: MemberItem[]) {
    setEntries((current) => {
      const next = { ...current };
      for (const member of groupMembers) {
        next[member.id] = {
          ...next[member.id],
          status,
          absentReason: status === "ABSENT" ? next[member.id]?.absentReason ?? "" : "",
          absentNote: status === "ABSENT" ? next[member.id]?.absentNote ?? "" : "",
        };
      }
      return next;
    });
  }

  function submit() {
    if (membersMissingAbsenceReason.length > 0) {
      toast.error(
        `Set absence reason for ${membersMissingAbsenceReason.length} absent member${
          membersMissingAbsenceReason.length === 1 ? "" : "s"
        } before saving.`,
      );
      return;
    }

    startTransition(async () => {
      const payload = {
        serviceId,
        entries: members.map((member) => ({
          memberId: member.id,
          status: entries[member.id]?.status ?? "PRESENT",
          absentReason: entries[member.id]?.absentReason ?? "",
          absentNote: entries[member.id]?.absentNote ?? "",
        })),
      };

      const result = await submitAttendanceAction(payload);
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
          <p className="text-xs text-slate-500">Total in scope</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{summary.total}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-emerald-50 p-3">
          <p className="text-xs text-emerald-600">Present</p>
          <p className="mt-1 text-xl font-semibold text-emerald-700">{summary.present}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-amber-50 p-3">
          <p className="text-xs text-amber-600">Online</p>
          <p className="mt-1 text-xl font-semibold text-amber-700">{summary.online}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-red-50 p-3">
          <p className="text-xs text-red-600">Absent</p>
          <p className="mt-1 text-xl font-semibold text-red-700">{summary.absent}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-sky-50 p-3">
          <p className="text-xs text-sky-600">Attendance rate</p>
          <p className="mt-1 text-xl font-semibold text-sky-700">{summary.attendanceRate.toFixed(1)}%</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="pl-9"
            placeholder="Search member..."
          />
        </div>
        <Button variant="secondary" onClick={markAllPresent} disabled={members.length === 0}>
          Mark all present
        </Button>
        <Button variant="outline" onClick={() => markVisibleAs("PRESENT")} disabled={filteredMembers.length === 0}>
          Mark visible present
        </Button>
        <Button variant="outline" onClick={() => markVisibleAs("ABSENT")} disabled={filteredMembers.length === 0}>
          Mark visible absent
        </Button>
        <Button variant="outline" onClick={() => markVisibleAs("ONLINE")} disabled={filteredMembers.length === 0}>
          Mark visible online
        </Button>
        <Select
          className="w-[170px]"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as "ALL" | "PRESENT" | "ABSENT" | "ONLINE")}
        >
          <option value="ALL">Show all</option>
          <option value="PRESENT">Show present</option>
          <option value="ONLINE">Show online</option>
          <option value="ABSENT">Show absent</option>
        </Select>
      </div>
      {membersMissingAbsenceReason.length > 0 ? (
        <p className="text-sm text-rose-600">
          {membersMissingAbsenceReason.length} absent member{membersMissingAbsenceReason.length === 1 ? "" : "s"} still
          need an absence reason.
        </p>
      ) : null}

      <div className="space-y-2">
        {groupedMembers.map(([homecellName, groupMembers]) => (
          <div key={homecellName} className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-slate-800">{homecellName}</p>
                <p className="text-xs text-slate-500">{groupMembers.length} members in view</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => markGroupAs("PRESENT", groupMembers)}>
                  Group present
                </Button>
                <Button variant="outline" onClick={() => markGroupAs("ABSENT", groupMembers)}>
                  Group absent
                </Button>
                <Button variant="outline" onClick={() => markGroupAs("ONLINE", groupMembers)}>
                  Group online
                </Button>
              </div>
            </div>

            {groupMembers.map((member) => {
              const state = entries[member.id] ?? {
                status: "PRESENT" as const,
                absentReason: "",
                absentNote: "",
              };

              return (
                <div
                  key={member.id}
                  className="grid gap-3 rounded-lg border border-slate-200 bg-white p-3 md:grid-cols-[2fr_1fr_1fr]"
                >
                  <div>
                    <p className="font-medium text-slate-800">
                      {member.firstName} {member.lastName}
                    </p>
                    <p className="text-xs text-slate-500">{member.homecellName ?? "No homecell"}</p>
                  </div>
                  <Select
                    value={state.status}
                    onChange={(event) =>
                      setEntries((current) => ({
                        ...current,
                        [member.id]: {
                          ...state,
                          status: event.target.value as "PRESENT" | "ABSENT" | "ONLINE",
                          absentReason: event.target.value === "ABSENT" ? state.absentReason : "",
                          absentNote: event.target.value === "ABSENT" ? state.absentNote : "",
                        },
                      }))
                    }
                  >
                    <option value="PRESENT">Present</option>
                    <option value="ONLINE">Online</option>
                    <option value="ABSENT">Absent</option>
                  </Select>
                  {state.status === "ABSENT" ? (
                    <div className="grid gap-2 md:grid-cols-2">
                      <Select
                        value={state.absentReason}
                        onChange={(event) =>
                          setEntries((current) => ({
                            ...current,
                            [member.id]: { ...state, absentReason: event.target.value },
                          }))
                        }
                      >
                        <option value="">Reason required</option>
                        {absenceReasons.map((reason) => (
                          <option key={reason} value={reason}>
                            {reason}
                          </option>
                        ))}
                      </Select>
                      <Input
                        placeholder="Optional note"
                        value={state.absentNote}
                        onChange={(event) =>
                          setEntries((current) => ({
                            ...current,
                            [member.id]: { ...state, absentNote: event.target.value },
                          }))
                        }
                      />
                    </div>
                  ) : (
                    <div className="text-xs text-emerald-600 md:self-center">
                      {state.status === "ONLINE" ? "Marked online" : "Marked present"}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
        {groupedMembers.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
            No members match your current filter.
          </div>
        ) : null}
      </div>

      <div className="flex justify-end">
        <Button onClick={submit} disabled={isPending || members.length === 0 || membersMissingAbsenceReason.length > 0}>
          {isPending ? "Saving..." : "Save Attendance"}
        </Button>
      </div>
    </div>
  );
}
