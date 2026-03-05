"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { submitReportingMembersAction } from "@/app/dashboard/reporting/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type MemberItem = {
  id: string;
  name: string;
};

type ExistingMemberItem = {
  memberId: string | null;
  memberName: string;
  present: boolean;
  absenceReason: string | null;
  absenceNote: string | null;
  homecellPresent?: boolean;
  homecellAbsenceReason?: string | null;
  homecellAbsenceNote?: string | null;
  churchPresent?: boolean;
  churchAttendedLabels?: string[];
  churchAbsenceReason?: string | null;
  churchAbsenceNote?: string | null;
  churchMorningPresent?: boolean;
  churchMorningAttendedLabel?: string | null;
  churchMorningAbsenceReason?: string | null;
  churchMorningAbsenceNote?: string | null;
  churchEveningPresent?: boolean;
  churchEveningAttendedLabel?: string | null;
  churchEveningAbsenceReason?: string | null;
  churchEveningAbsenceNote?: string | null;
};

type HomecellMembersReportFormProps = {
  homecellId: string;
  weekStartDate: string;
  weekEndDate: string;
  members: MemberItem[];
  existingItems: ExistingMemberItem[];
  serviceLabels: string[];
  serviceGroups?: {
    morning: string[];
    evening: string[];
    online: string[];
  };
  canSubmit: boolean;
  isLocked: boolean;
};

type MemberState = {
  memberId: string;
  memberName: string;
  homecellPresent: boolean | null;
  homecellAbsenceReason: string;
  homecellAbsenceNote: string;
  churchMorningPresent: boolean;
  churchMorningAttendedLabel: string;
  churchMorningAbsenceReason: string;
  churchMorningAbsenceNote: string;
  churchEveningPresent: boolean;
  churchEveningAttendedLabel: string;
  churchEveningAbsenceReason: string;
  churchEveningAbsenceNote: string;
};

type AbsenceEditorTarget = "homecell" | "churchMorning" | "churchEvening";

type AbsenceEditorState = {
  rowIndex: number;
  target: AbsenceEditorTarget;
};

type SessionOptions = {
  morning: string[];
  evening: string[];
};

function normalizeLabel(value: string) {
  return value.trim();
}

function uniqueLabels(labels: string[]) {
  return Array.from(new Set(labels.map(normalizeLabel).filter((label) => label.length > 0)));
}

function resolveSessionOptions(
  serviceLabels: string[],
  serviceGroups?: { morning: string[]; evening: string[]; online: string[] },
): SessionOptions {
  if (serviceGroups) {
    const morning = uniqueLabels([...serviceGroups.morning, ...serviceGroups.online]);
    const evening = uniqueLabels([...serviceGroups.evening, ...serviceGroups.online]);
    if (morning.length > 0 || evening.length > 0) {
      const fallback = uniqueLabels(serviceLabels);
      return {
        morning: morning.length > 0 ? morning : fallback,
        evening: evening.length > 0 ? evening : fallback,
      };
    }
  }

  const normalized = uniqueLabels(serviceLabels);
  const online = normalized.filter((label) => label.toLowerCase().includes("online"));
  const morning = uniqueLabels([
    ...normalized.filter((label) => /\b(am|morning)\b/i.test(label)),
    ...online,
  ]);
  const evening = uniqueLabels([
    ...normalized.filter((label) => /\b(pm|evening)\b/i.test(label)),
    ...online,
  ]);

  return {
    morning: morning.length > 0 ? morning : normalized,
    evening: evening.length > 0 ? evening : normalized,
  };
}

function initialStateFromInput(
  members: MemberItem[],
  existingItems: ExistingMemberItem[],
  sessionOptions: SessionOptions,
): MemberState[] {
  const existingById = new Map(
    existingItems
      .filter((item) => item.memberId)
      .map((item) => {
        const legacyLabels = uniqueLabels(item.churchAttendedLabels ?? []);
        const explicitMorning = item.churchMorningAttendedLabel ? normalizeLabel(item.churchMorningAttendedLabel) : "";
        const explicitEvening = item.churchEveningAttendedLabel ? normalizeLabel(item.churchEveningAttendedLabel) : "";
        const legacyMorning =
          legacyLabels.find((label) => sessionOptions.morning.includes(label)) ?? legacyLabels[0] ?? "";
        const legacyEvening =
          legacyLabels.find((label) => sessionOptions.evening.includes(label) && label !== legacyMorning) ??
          legacyLabels[1] ??
          "";
        const churchMorningAttendedLabel = explicitMorning || legacyMorning;
        const churchEveningAttendedLabel = explicitEvening || legacyEvening;
        const legacyChurchPresent = item.churchPresent;

        const churchMorningPresent =
          typeof item.churchMorningPresent === "boolean"
            ? item.churchMorningPresent
            : typeof legacyChurchPresent === "boolean"
              ? legacyChurchPresent
              : true;

        const churchEveningPresent =
          typeof item.churchEveningPresent === "boolean"
            ? item.churchEveningPresent
            : typeof legacyChurchPresent === "boolean"
              ? legacyChurchPresent
              : true;

        return [
          item.memberId as string,
          {
            homecellPresent: item.homecellPresent ?? item.present,
            homecellAbsenceReason: item.homecellAbsenceReason ?? item.absenceReason ?? "",
            homecellAbsenceNote: item.homecellAbsenceNote ?? item.absenceNote ?? "",
            churchMorningPresent,
            churchMorningAttendedLabel: churchMorningPresent ? churchMorningAttendedLabel : "",
            churchMorningAbsenceReason:
              item.churchMorningAbsenceReason ?? (churchMorningPresent ? "" : item.churchAbsenceReason ?? ""),
            churchMorningAbsenceNote:
              item.churchMorningAbsenceNote ?? (churchMorningPresent ? "" : item.churchAbsenceNote ?? ""),
            churchEveningPresent,
            churchEveningAttendedLabel: churchEveningPresent ? churchEveningAttendedLabel : "",
            churchEveningAbsenceReason:
              item.churchEveningAbsenceReason ?? (churchEveningPresent ? "" : item.churchAbsenceReason ?? ""),
            churchEveningAbsenceNote:
              item.churchEveningAbsenceNote ?? (churchEveningPresent ? "" : item.churchAbsenceNote ?? ""),
          },
        ];
      }),
  );

  return members.map((member) => {
    const existing = existingById.get(member.id);
    return {
      memberId: member.id,
      memberName: member.name,
      homecellPresent: existing?.homecellPresent ?? null,
      homecellAbsenceReason: existing?.homecellAbsenceReason ?? "",
      homecellAbsenceNote: existing?.homecellAbsenceNote ?? "",
      churchMorningPresent: existing?.churchMorningPresent ?? true,
      churchMorningAttendedLabel: existing?.churchMorningAttendedLabel ?? "",
      churchMorningAbsenceReason: existing?.churchMorningAbsenceReason ?? "",
      churchMorningAbsenceNote: existing?.churchMorningAbsenceNote ?? "",
      churchEveningPresent: existing?.churchEveningPresent ?? true,
      churchEveningAttendedLabel: existing?.churchEveningAttendedLabel ?? "",
      churchEveningAbsenceReason: existing?.churchEveningAbsenceReason ?? "",
      churchEveningAbsenceNote: existing?.churchEveningAbsenceNote ?? "",
    };
  });
}

export function HomecellMembersReportForm({
  homecellId,
  weekStartDate,
  weekEndDate,
  members,
  existingItems,
  serviceLabels,
  serviceGroups,
  canSubmit,
  isLocked,
}: HomecellMembersReportFormProps) {
  const [isPending, startTransition] = useTransition();
  const sessionOptions = useMemo(
    () => resolveSessionOptions(serviceLabels, serviceGroups),
    [serviceGroups, serviceLabels],
  );
  const [rows, setRows] = useState(() => initialStateFromInput(members, existingItems, sessionOptions));
  const [absenceEditor, setAbsenceEditor] = useState<AbsenceEditorState | null>(null);
  const [absenceReason, setAbsenceReason] = useState("");
  const [absenceNote, setAbsenceNote] = useState("");

  const canEdit = canSubmit && !isLocked;
  const homecellPresentCount = rows.filter((row) => row.homecellPresent === true).length;
  const homecellAbsentCount = rows.filter((row) => row.homecellPresent === false).length;
  const homecellNotSetCount = rows.filter((row) => row.homecellPresent === null).length;
  const churchMorningPresentCount = rows.filter((row) => row.churchMorningPresent).length;
  const churchMorningAbsentCount = rows.length - churchMorningPresentCount;
  const churchEveningPresentCount = rows.filter((row) => row.churchEveningPresent).length;
  const churchEveningAbsentCount = rows.length - churchEveningPresentCount;

  const updateRow = (targetIndex: number, updater: (current: MemberState) => MemberState) => {
    setRows((current) =>
      current.map((item, index) => {
        if (index !== targetIndex) return item;
        return updater(item);
      }),
    );
  };

  const openAbsenceEditor = (rowIndex: number, target: AbsenceEditorTarget) => {
    const row = rows[rowIndex];
    if (!row) return;
    setAbsenceEditor({ rowIndex, target });

    if (target === "homecell") {
      setAbsenceReason(row.homecellAbsenceReason);
      setAbsenceNote(row.homecellAbsenceNote);
      return;
    }

    if (target === "churchMorning") {
      setAbsenceReason(row.churchMorningAbsenceReason);
      setAbsenceNote(row.churchMorningAbsenceNote);
      return;
    }

    setAbsenceReason(row.churchEveningAbsenceReason);
    setAbsenceNote(row.churchEveningAbsenceNote);
  };

  const saveAbsenceEditor = () => {
    if (!absenceEditor) return;

    updateRow(absenceEditor.rowIndex, (item) => {
      if (absenceEditor.target === "homecell") {
        return {
          ...item,
          homecellPresent: false,
          homecellAbsenceReason: absenceReason,
          homecellAbsenceNote: absenceNote,
        };
      }

      if (absenceEditor.target === "churchMorning") {
        return {
          ...item,
          churchMorningPresent: false,
          churchMorningAttendedLabel: "",
          churchMorningAbsenceReason: absenceReason,
          churchMorningAbsenceNote: absenceNote,
        };
      }

      return {
        ...item,
        churchEveningPresent: false,
        churchEveningAttendedLabel: "",
        churchEveningAbsenceReason: absenceReason,
        churchEveningAbsenceNote: absenceNote,
      };
    });

    setAbsenceEditor(null);
    setAbsenceReason("");
    setAbsenceNote("");
  };

  const cancelAbsenceEditor = () => {
    setAbsenceEditor(null);
    setAbsenceReason("");
    setAbsenceNote("");
  };

  const absenceEditorRow = absenceEditor ? rows[absenceEditor.rowIndex] : null;

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!canEdit) return;

        const hasMissingHomecellSelection = rows.some((row) => row.homecellPresent === null);
        if (hasMissingHomecellSelection) {
          toast.error("Select Homecell P or A for each member.");
          return;
        }

        const hasMissingHomecellReason = rows.some(
          (row) => row.homecellPresent === false && !row.homecellAbsenceReason.trim(),
        );
        if (hasMissingHomecellReason) {
          toast.error("Each homecell absence needs a homecell reason.");
          return;
        }

        const hasMissingMorningReason = rows.some(
          (row) => !row.churchMorningPresent && !row.churchMorningAbsenceReason.trim(),
        );
        if (hasMissingMorningReason) {
          toast.error("Each morning absence needs a reason.");
          return;
        }

        const hasMissingEveningReason = rows.some(
          (row) => !row.churchEveningPresent && !row.churchEveningAbsenceReason.trim(),
        );
        if (hasMissingEveningReason) {
          toast.error("Each evening absence needs a reason.");
          return;
        }

        const hasMissingMorningSelection = rows.some(
          (row) => row.churchMorningPresent && !row.churchMorningAttendedLabel,
        );
        if (hasMissingMorningSelection) {
          toast.error("Select one morning service or online option for each member.");
          return;
        }

        const hasMissingEveningSelection = rows.some(
          (row) => row.churchEveningPresent && !row.churchEveningAttendedLabel,
        );
        if (hasMissingEveningSelection) {
          toast.error("Select one evening service or online option for each member.");
          return;
        }

        startTransition(async () => {
          const result = await submitReportingMembersAction({
            homecellId,
            weekStartDate,
            weekEndDate,
            members: rows.map((row) => {
              const churchAttendedLabels = [
                row.churchMorningPresent ? row.churchMorningAttendedLabel : "",
                row.churchEveningPresent ? row.churchEveningAttendedLabel : "",
              ].filter((value): value is string => Boolean(value));
              const churchPresent = churchAttendedLabels.length > 0;

              return {
                memberId: row.memberId,
                memberName: row.memberName,
                present: row.homecellPresent === true,
                absenceReason: row.homecellAbsenceReason,
                absenceNote: row.homecellAbsenceNote,
                homecellPresent: row.homecellPresent === true,
                homecellAbsenceReason: row.homecellAbsenceReason,
                homecellAbsenceNote: row.homecellAbsenceNote,
                churchPresent,
                churchAttendedLabels,
                churchAbsenceReason: churchPresent
                  ? ""
                  : row.churchMorningAbsenceReason || row.churchEveningAbsenceReason,
                churchAbsenceNote: churchPresent ? "" : row.churchMorningAbsenceNote || row.churchEveningAbsenceNote,
                churchMorningPresent: row.churchMorningPresent,
                churchMorningAttendedLabel: row.churchMorningAttendedLabel,
                churchMorningAbsenceReason: row.churchMorningAbsenceReason,
                churchMorningAbsenceNote: row.churchMorningAbsenceNote,
                churchEveningPresent: row.churchEveningPresent,
                churchEveningAttendedLabel: row.churchEveningAttendedLabel,
                churchEveningAbsenceReason: row.churchEveningAbsenceReason,
                churchEveningAbsenceNote: row.churchEveningAbsenceNote,
              };
            }),
          });
          if (!result.success) {
            toast.error(result.message);
            return;
          }
          toast.success(result.message);
        });
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-base font-semibold text-slate-900">CRC Members</p>
        <div className="text-sm text-slate-600">
          Homecell: <span className="font-medium text-emerald-700">{homecellPresentCount}</span> present /{" "}
          <span className="font-medium text-red-700">{homecellAbsentCount}</span> absent
          {" | "}
          <span className="font-medium text-amber-700">{homecellNotSetCount}</span> not set
          {" | "}
          Morning: <span className="font-medium text-emerald-700">{churchMorningPresentCount}</span> present /{" "}
          <span className="font-medium text-red-700">{churchMorningAbsentCount}</span> absent
          {" | "}
          Evening: <span className="font-medium text-emerald-700">{churchEveningPresentCount}</span> present /{" "}
          <span className="font-medium text-red-700">{churchEveningAbsentCount}</span> absent
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[980px] space-y-3 rounded-lg border border-slate-200 p-3">
          <div className="grid grid-cols-[1.2fr_0.9fr_2.2fr] gap-3 border-b border-slate-200 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <p>Member</p>
            <p>Homecell</p>
            <p>Church Attendance</p>
          </div>
          {rows.map((row, index) => (
            <div
              key={row.memberId}
              className="grid grid-cols-[1.2fr_0.9fr_2.2fr] gap-3 rounded-lg border border-slate-200 p-2"
            >
              <p className="self-center text-sm text-slate-800">
                {index + 1}. {row.memberName}
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!canEdit}
                  onClick={() =>
                    updateRow(index, (item) => ({
                      ...item,
                      homecellPresent: true,
                      homecellAbsenceReason: "",
                      homecellAbsenceNote: "",
                    }))
                  }
                  className={cn(
                    "rounded-md border px-3 py-1 text-xs font-medium",
                    row.homecellPresent === true
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                      : "border-slate-300 text-slate-700",
                  )}
                >
                  P
                </button>
                <button
                  type="button"
                  disabled={!canEdit}
                  onClick={() => openAbsenceEditor(index, "homecell")}
                  className={cn(
                    "rounded-md border px-3 py-1 text-xs font-medium",
                    row.homecellPresent === false
                      ? "border-red-500 bg-red-50 text-red-700"
                      : "border-slate-300 text-slate-700",
                  )}
                >
                  A
                </button>
                {row.homecellPresent === false ? (
                  <button
                    type="button"
                    disabled={!canEdit}
                    onClick={() => openAbsenceEditor(index, "homecell")}
                    className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700"
                  >
                    Reason/Note
                  </button>
                ) : null}
              </div>

              <div className="flex w-full flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="min-w-16 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Morning
                  </span>
                  {sessionOptions.morning.map((label) => {
                    const active = row.churchMorningPresent && row.churchMorningAttendedLabel === label;
                    return (
                      <button
                        key={`${row.memberId}-morning-${label}`}
                        type="button"
                        disabled={!canEdit}
                        onClick={() =>
                          updateRow(index, (item) => ({
                            ...item,
                            churchMorningPresent: true,
                            churchMorningAttendedLabel: label,
                            churchMorningAbsenceReason: "",
                            churchMorningAbsenceNote: "",
                          }))
                        }
                        className={cn(
                          "rounded-md border px-2 py-1 text-xs font-medium",
                          active
                            ? "border-slate-800 bg-slate-100 text-slate-900"
                            : "border-slate-300 text-slate-700",
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    disabled={!canEdit}
                    onClick={() => openAbsenceEditor(index, "churchMorning")}
                    className={cn(
                      "rounded-md border px-2 py-1 text-xs font-medium",
                      !row.churchMorningPresent
                        ? "border-red-500 bg-red-50 text-red-700"
                        : "border-slate-300 text-slate-700",
                    )}
                  >
                    ABSENT
                  </button>
                  {!row.churchMorningPresent ? (
                    <button
                      type="button"
                      disabled={!canEdit}
                      onClick={() => openAbsenceEditor(index, "churchMorning")}
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700"
                    >
                      Reason/Note
                    </button>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="min-w-16 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Evening
                  </span>
                  {sessionOptions.evening.map((label) => {
                    const active = row.churchEveningPresent && row.churchEveningAttendedLabel === label;
                    return (
                      <button
                        key={`${row.memberId}-evening-${label}`}
                        type="button"
                        disabled={!canEdit}
                        onClick={() =>
                          updateRow(index, (item) => ({
                            ...item,
                            churchEveningPresent: true,
                            churchEveningAttendedLabel: label,
                            churchEveningAbsenceReason: "",
                            churchEveningAbsenceNote: "",
                          }))
                        }
                        className={cn(
                          "rounded-md border px-2 py-1 text-xs font-medium",
                          active
                            ? "border-slate-800 bg-slate-100 text-slate-900"
                            : "border-slate-300 text-slate-700",
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    disabled={!canEdit}
                    onClick={() => openAbsenceEditor(index, "churchEvening")}
                    className={cn(
                      "rounded-md border px-2 py-1 text-xs font-medium",
                      !row.churchEveningPresent
                        ? "border-red-500 bg-red-50 text-red-700"
                        : "border-slate-300 text-slate-700",
                    )}
                  >
                    ABSENT
                  </button>
                  {!row.churchEveningPresent ? (
                    <button
                      type="button"
                      disabled={!canEdit}
                      onClick={() => openAbsenceEditor(index, "churchEvening")}
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700"
                    >
                      Reason/Note
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
          {rows.length === 0 ? <p className="text-sm text-slate-500">No active members in this homecell yet.</p> : null}
        </div>
      </div>

      <div>
        <Link
          href="/dashboard/membership"
          className="inline-flex rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Add Member
        </Link>
      </div>

      {isLocked ? <p className="text-sm text-amber-700">This weekly report is locked and cannot be edited.</p> : null}
      {!canSubmit ? <p className="text-sm text-slate-500">You have view-only access for member reporting.</p> : null}

      <div className="flex items-center justify-end gap-2">
        <Button type="submit" disabled={!canEdit || isPending || rows.length === 0}>
          {isPending ? "Submitting..." : "Submit"}
        </Button>
        <Link
          href="/dashboard"
          className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Exit
        </Link>
      </div>

      {absenceEditor ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/35 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
            <h4 className="text-base font-semibold text-slate-900">
              {absenceEditor.target === "homecell"
                ? "Homecell absence"
                : absenceEditor.target === "churchMorning"
                  ? "Morning service absence"
                  : "Evening service absence"}
              : <span className="font-normal">{absenceEditorRow?.memberName}</span>
            </h4>
            <p className="mt-1 text-sm text-slate-600">Capture reason and note for this absence.</p>
            <div className="mt-3 space-y-2">
              <Select value={absenceReason} onChange={(event) => setAbsenceReason(event.target.value)}>
                <option value="">Reason required</option>
                <option value="Travel">Travel</option>
                <option value="Sick">Sick</option>
                <option value="Work">Work</option>
                <option value="Family">Family</option>
                <option value="Other">Other</option>
              </Select>
              <Input value={absenceNote} onChange={(event) => setAbsenceNote(event.target.value)} placeholder="Note" />
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <Button type="button" variant="outline" onClick={cancelAbsenceEditor}>
                Cancel
              </Button>
              <Button type="button" onClick={saveAbsenceEditor} disabled={!absenceReason.trim()}>
                Save
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </form>
  );
}
