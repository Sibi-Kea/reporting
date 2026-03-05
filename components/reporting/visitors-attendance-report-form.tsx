"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  submitReportingFirstVisitorsAction,
  submitReportingVisitorsAction,
} from "@/app/dashboard/reporting/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type VisitorsAttendanceItem = {
  id?: string;
  name: string;
  present: boolean;
  homecellPresent: boolean | null;
  churchPresent: boolean;
  churchMorningPresent: boolean;
  churchMorningAttendedLabel?: string | null;
  churchEveningPresent: boolean;
  churchEveningAttendedLabel?: string | null;
};

type VisitorsAttendanceReportFormProps = {
  mode: "visitors" | "first-visitors";
  homecellId: string;
  weekStartDate: string;
  weekEndDate: string;
  existingItems: VisitorsAttendanceItem[];
  serviceGroups: {
    morning: string[];
    evening: string[];
    online: string[];
  };
  canSubmit: boolean;
  isLocked: boolean;
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

function resolveSessionOptions(serviceGroups: { morning: string[]; evening: string[]; online: string[] }): SessionOptions {
  const morning = uniqueLabels([...serviceGroups.morning, ...serviceGroups.online]);
  const evening = uniqueLabels([...serviceGroups.evening, ...serviceGroups.online]);
  const fallback = uniqueLabels([...serviceGroups.morning, ...serviceGroups.evening, ...serviceGroups.online]);
  const base = fallback.length > 0 ? fallback : ["Online"];
  return {
    morning: morning.length > 0 ? morning : base,
    evening: evening.length > 0 ? evening : base,
  };
}

function createRow(): VisitorsAttendanceItem {
  return {
    id: crypto.randomUUID(),
    name: "",
    present: false,
    homecellPresent: null,
    churchPresent: true,
    churchMorningPresent: true,
    churchMorningAttendedLabel: "",
    churchEveningPresent: true,
    churchEveningAttendedLabel: "",
  };
}

export function VisitorsAttendanceReportForm({
  mode,
  homecellId,
  weekStartDate,
  weekEndDate,
  existingItems,
  serviceGroups,
  canSubmit,
  isLocked,
}: VisitorsAttendanceReportFormProps) {
  const [isPending, startTransition] = useTransition();
  const sessionOptions = useMemo(() => resolveSessionOptions(serviceGroups), [serviceGroups]);
  const [rows, setRows] = useState<VisitorsAttendanceItem[]>(() =>
    existingItems.length > 0
      ? existingItems.map((item) => {
          const homecellPresent = typeof item.homecellPresent === "boolean" ? item.homecellPresent : null;
          const legacyPresent = item.present;
          const churchMorningPresent = item.churchMorningPresent ?? item.churchPresent ?? legacyPresent;
          const churchEveningPresent = item.churchEveningPresent ?? item.churchPresent ?? legacyPresent;
          const churchMorningAttendedLabel =
            churchMorningPresent && typeof item.churchMorningAttendedLabel === "string"
              ? item.churchMorningAttendedLabel.trim()
              : "";
          const churchEveningAttendedLabel =
            churchEveningPresent && typeof item.churchEveningAttendedLabel === "string"
              ? item.churchEveningAttendedLabel.trim()
              : "";
          const churchPresent = churchMorningPresent || churchEveningPresent;

          return {
            id: item.id ?? crypto.randomUUID(),
            name: item.name,
            present: homecellPresent === true || churchPresent,
            homecellPresent,
            churchPresent,
            churchMorningPresent,
            churchMorningAttendedLabel,
            churchEveningPresent,
            churchEveningAttendedLabel,
          };
        })
      : [createRow()],
  );

  const canEdit = canSubmit && !isLocked;
  const title = mode === "visitors" ? "Visitors" : "Ftvs";
  const presentCount = useMemo(
    () => rows.filter((row) => row.name.trim().length > 0 && (row.homecellPresent || row.churchPresent)).length,
    [rows],
  );
  const absentCount = useMemo(
    () => rows.filter((row) => row.name.trim().length > 0 && !row.homecellPresent && !row.churchPresent).length,
    [rows],
  );

  const homecellPresentCount = useMemo(
    () => rows.filter((row) => row.name.trim().length > 0 && row.homecellPresent === true).length,
    [rows],
  );
  const homecellAbsentCount = useMemo(
    () => rows.filter((row) => row.name.trim().length > 0 && row.homecellPresent === false).length,
    [rows],
  );
  const homecellNotSetCount = useMemo(
    () => rows.filter((row) => row.name.trim().length > 0 && row.homecellPresent === null).length,
    [rows],
  );
  const morningPresentCount = useMemo(
    () => rows.filter((row) => row.name.trim().length > 0 && row.churchMorningPresent).length,
    [rows],
  );
  const morningAbsentCount = useMemo(
    () => rows.filter((row) => row.name.trim().length > 0 && !row.churchMorningPresent).length,
    [rows],
  );
  const eveningPresentCount = useMemo(
    () => rows.filter((row) => row.name.trim().length > 0 && row.churchEveningPresent).length,
    [rows],
  );
  const eveningAbsentCount = useMemo(
    () => rows.filter((row) => row.name.trim().length > 0 && !row.churchEveningPresent).length,
    [rows],
  );

  const updateRow = (index: number, updater: (row: VisitorsAttendanceItem) => VisitorsAttendanceItem) => {
    setRows((current) =>
      current.map((row, rowIndex) => {
        if (rowIndex !== index) return row;
        const updated = updater(row);
        const churchPresent = updated.churchMorningPresent || updated.churchEveningPresent;
        return {
          ...updated,
          churchPresent,
          present: updated.homecellPresent || churchPresent,
        };
      }),
    );
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!canEdit) return;

        const normalizedRows = rows
          .map((row) => {
            const name = row.name.trim();
            const churchPresent = row.churchMorningPresent || row.churchEveningPresent;
            return {
              id: row.id,
              name,
              present: row.homecellPresent === true || churchPresent,
              homecellPresent: row.homecellPresent,
              churchPresent,
              churchMorningPresent: row.churchMorningPresent,
              churchMorningAttendedLabel: row.churchMorningPresent ? row.churchMorningAttendedLabel?.trim() ?? "" : "",
              churchEveningPresent: row.churchEveningPresent,
              churchEveningAttendedLabel: row.churchEveningPresent ? row.churchEveningAttendedLabel?.trim() ?? "" : "",
            };
          })
          .filter((row) => row.name.length > 0);

        const hasMissingHomecellSelection = normalizedRows.some((row) => row.homecellPresent === null);
        if (hasMissingHomecellSelection) {
          toast.error(`Select Homecell P or A for each ${title.toLowerCase()} row.`);
          return;
        }

        const hasMissingMorningSelection = normalizedRows.some(
          (row) => row.churchMorningPresent && !row.churchMorningAttendedLabel,
        );
        if (hasMissingMorningSelection) {
          toast.error(`Select one morning service or online option for each ${title.toLowerCase()} row.`);
          return;
        }

        const hasMissingEveningSelection = normalizedRows.some(
          (row) => row.churchEveningPresent && !row.churchEveningAttendedLabel,
        );
        if (hasMissingEveningSelection) {
          toast.error(`Select one evening service or online option for each ${title.toLowerCase()} row.`);
          return;
        }

        startTransition(async () => {
          const result =
            mode === "visitors"
              ? await submitReportingVisitorsAction({
                  homecellId,
                  weekStartDate,
                  weekEndDate,
                  items: normalizedRows,
                })
              : await submitReportingFirstVisitorsAction({
                  homecellId,
                  weekStartDate,
                  weekEndDate,
                  items: normalizedRows,
                });

          if (!result.success) {
            toast.error(result.message);
            return;
          }

          toast.success(result.message);
          if (normalizedRows.length === 0) {
            setRows([createRow()]);
          }
        });
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-base font-semibold text-slate-900">{title}</p>
        <div className="text-sm text-slate-600">
          Total: <span className="font-medium text-emerald-700">{presentCount}</span> present /{" "}
          <span className="font-medium text-red-700">{absentCount}</span> absent
          {" | "}
          Homecell: <span className="font-medium text-emerald-700">{homecellPresentCount}</span> P /{" "}
          <span className="font-medium text-red-700">{homecellAbsentCount}</span> A
          {" | "}
          <span className="font-medium text-amber-700">{homecellNotSetCount}</span> not set
          {" | "}
          Morning: <span className="font-medium text-emerald-700">{morningPresentCount}</span> P /{" "}
          <span className="font-medium text-red-700">{morningAbsentCount}</span> A
          {" | "}
          Evening: <span className="font-medium text-emerald-700">{eveningPresentCount}</span> P /{" "}
          <span className="font-medium text-red-700">{eveningAbsentCount}</span> A
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-slate-200 p-3">
        <div className="grid grid-cols-[1.1fr_0.8fr_1.9fr_auto] gap-3 border-b border-slate-200 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <p>Name</p>
          <p>Homecell</p>
          <p>Church Attendance</p>
          <p>Row</p>
        </div>

        {rows.map((row, index) => (
          <div key={row.id ?? `${index}-${row.name}`} className="grid grid-cols-[1.1fr_0.8fr_1.9fr_auto] gap-3 rounded-lg border border-slate-200 p-2">
            <Input
              value={row.name}
              disabled={!canEdit}
              onChange={(event) => updateRow(index, (item) => ({ ...item, name: event.target.value }))}
              placeholder={mode === "visitors" ? "Visitor name" : "First-time visitor name"}
            />

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={!canEdit}
                onClick={() => updateRow(index, (item) => ({ ...item, homecellPresent: true }))}
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
                onClick={() => updateRow(index, (item) => ({ ...item, homecellPresent: false }))}
                className={cn(
                  "rounded-md border px-3 py-1 text-xs font-medium",
                  row.homecellPresent === false
                    ? "border-red-500 bg-red-50 text-red-700"
                    : "border-slate-300 text-slate-700",
                )}
              >
                A
              </button>
            </div>

            <div className="flex w-full flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="min-w-16 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Morning</span>
                {sessionOptions.morning.map((label) => {
                  const active = row.churchMorningPresent && row.churchMorningAttendedLabel === label;
                  return (
                    <button
                      key={`${row.id ?? index}-morning-${label}`}
                      type="button"
                      disabled={!canEdit}
                      onClick={() =>
                        updateRow(index, (item) => ({
                          ...item,
                          churchMorningPresent: true,
                          churchMorningAttendedLabel: label,
                        }))
                      }
                      className={cn(
                        "rounded-md border px-2 py-1 text-xs font-medium",
                        active ? "border-slate-800 bg-slate-100 text-slate-900" : "border-slate-300 text-slate-700",
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
                <button
                  type="button"
                  disabled={!canEdit}
                  onClick={() =>
                    updateRow(index, (item) => ({
                      ...item,
                      churchMorningPresent: false,
                      churchMorningAttendedLabel: "",
                    }))
                  }
                  className={cn(
                    "rounded-md border px-2 py-1 text-xs font-medium",
                    !row.churchMorningPresent ? "border-red-500 bg-red-50 text-red-700" : "border-slate-300 text-slate-700",
                  )}
                >
                  ABSENT
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="min-w-16 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Evening</span>
                {sessionOptions.evening.map((label) => {
                  const active = row.churchEveningPresent && row.churchEveningAttendedLabel === label;
                  return (
                    <button
                      key={`${row.id ?? index}-evening-${label}`}
                      type="button"
                      disabled={!canEdit}
                      onClick={() =>
                        updateRow(index, (item) => ({
                          ...item,
                          churchEveningPresent: true,
                          churchEveningAttendedLabel: label,
                        }))
                      }
                      className={cn(
                        "rounded-md border px-2 py-1 text-xs font-medium",
                        active ? "border-slate-800 bg-slate-100 text-slate-900" : "border-slate-300 text-slate-700",
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
                <button
                  type="button"
                  disabled={!canEdit}
                  onClick={() =>
                    updateRow(index, (item) => ({
                      ...item,
                      churchEveningPresent: false,
                      churchEveningAttendedLabel: "",
                    }))
                  }
                  className={cn(
                    "rounded-md border px-2 py-1 text-xs font-medium",
                    !row.churchEveningPresent ? "border-red-500 bg-red-50 text-red-700" : "border-slate-300 text-slate-700",
                  )}
                >
                  ABSENT
                </button>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              disabled={!canEdit || rows.length === 1}
              onClick={() => setRows((current) => current.filter((_, rowIndex) => rowIndex !== index))}
            >
              Remove
            </Button>
          </div>
        ))}

        <div className="flex items-center justify-between gap-2 pt-1">
          <p className="text-xs text-slate-500">Absence reason is not required for {title.toLowerCase()}.</p>
          <Button type="button" variant="outline" disabled={!canEdit} onClick={() => setRows((current) => [...current, createRow()])}>
            Add Row
          </Button>
        </div>
      </div>

      {isLocked ? <p className="text-sm text-amber-700">This weekly report is locked and cannot be edited.</p> : null}
      {!canSubmit ? <p className="text-sm text-slate-500">You have view-only access for this reporting tab.</p> : null}

      <div className="flex items-center justify-end gap-2">
        <Button type="submit" disabled={!canEdit || isPending}>
          {isPending ? "Submitting..." : "Submit"}
        </Button>
        <Link
          href="/dashboard"
          className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Exit
        </Link>
      </div>
    </form>
  );
}
