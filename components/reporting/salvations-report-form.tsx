"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { submitReportingSalvationsAction } from "@/app/dashboard/reporting/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SalvationItem = {
  id?: string;
  name: string;
  source: "MEMBER" | "VISITOR" | "FTV";
  location: "HOMECELL" | "CHURCH";
};

type SalvationCandidate = {
  id: string;
  name: string;
  source: "MEMBER" | "VISITOR" | "FTV";
  eligible: boolean;
  presentAt: "NONE" | "HOMECELL" | "CHURCH" | "BOTH";
};

type SalvationsReportFormProps = {
  homecellId: string;
  weekStartDate: string;
  weekEndDate: string;
  candidates: SalvationCandidate[];
  existingItems: SalvationItem[];
  canSubmit: boolean;
  isLocked: boolean;
};

type SelectedLocation = "" | "HOMECELL" | "CHURCH";

function candidateKey(source: SalvationCandidate["source"], id: string) {
  return `${source}:${id}`;
}

function sourceLabel(source: SalvationCandidate["source"]) {
  if (source === "MEMBER") return "Member";
  if (source === "VISITOR") return "Visitor";
  return "FTV";
}

function presentLabel(value: SalvationCandidate["presentAt"]) {
  if (value === "BOTH") return "Present: Homecell + Church";
  if (value === "HOMECELL") return "Present: Homecell";
  if (value === "CHURCH") return "Present: Church";
  return "Absent";
}

function buildInitialSelections(candidates: SalvationCandidate[], existingItems: SalvationItem[]) {
  const selections = new Map<string, SelectedLocation>();
  const byName = new Map<string, string>();

  for (const candidate of candidates) {
    const key = candidateKey(candidate.source, candidate.id);
    selections.set(key, "");
    byName.set(`${candidate.source}:${candidate.name.trim().toLowerCase()}`, key);
  }

  for (const item of existingItems) {
    const id = item.id?.trim();
    const explicitKey = id ? candidateKey(item.source, id) : null;
    const fallbackKey = byName.get(`${item.source}:${item.name.trim().toLowerCase()}`);
    const key = explicitKey && selections.has(explicitKey) ? explicitKey : fallbackKey;
    if (!key) continue;

    const candidate = candidates.find((entry) => candidateKey(entry.source, entry.id) === key);
    if (!candidate?.eligible) continue;
    selections.set(key, item.location);
  }

  return selections;
}

export function SalvationsReportForm({
  homecellId,
  weekStartDate,
  weekEndDate,
  candidates,
  existingItems,
  canSubmit,
  isLocked,
}: SalvationsReportFormProps) {
  const [isPending, startTransition] = useTransition();
  const [selections, setSelections] = useState<Map<string, SelectedLocation>>(() =>
    buildInitialSelections(candidates, existingItems),
  );

  const canEdit = canSubmit && !isLocked;
  const selectedEntries = useMemo(
    () =>
      candidates.filter((candidate) => {
        const key = candidateKey(candidate.source, candidate.id);
        const location = selections.get(key) ?? "";
        return candidate.eligible && location !== "";
      }),
    [candidates, selections],
  );

  const selectedHomecellCount = useMemo(
    () =>
      selectedEntries.filter((candidate) => {
        const key = candidateKey(candidate.source, candidate.id);
        return (selections.get(key) ?? "") === "HOMECELL";
      }).length,
    [selectedEntries, selections],
  );
  const selectedChurchCount = useMemo(
    () =>
      selectedEntries.filter((candidate) => {
        const key = candidateKey(candidate.source, candidate.id);
        return (selections.get(key) ?? "") === "CHURCH";
      }).length,
    [selectedEntries, selections],
  );

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!canEdit) return;

        const items = candidates.flatMap((candidate) => {
          const key = candidateKey(candidate.source, candidate.id);
          const location = selections.get(key) ?? "";
          if (!candidate.eligible || location === "") return [];

          return [
            {
              id: candidate.id,
              name: candidate.name,
              source: candidate.source,
              location,
            },
          ];
        });

        startTransition(async () => {
          const result = await submitReportingSalvationsAction({
            homecellId,
            weekStartDate,
            weekEndDate,
            items,
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
        <p className="text-base font-semibold text-slate-900">Salvations</p>
        <div className="text-sm text-slate-600">
          Homecell: <span className="font-medium text-emerald-700">{selectedHomecellCount}</span>
          {" | "}
          Church: <span className="font-medium text-sky-700">{selectedChurchCount}</span>
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-slate-200 p-3">
        <div className="grid grid-cols-[1.2fr_1fr_1.3fr] gap-3 border-b border-slate-200 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <p>Person</p>
          <p>Type / Attendance</p>
          <p>Mark Salvation Location</p>
        </div>

        {candidates.map((candidate) => {
          const key = candidateKey(candidate.source, candidate.id);
          const location = selections.get(key) ?? "";
          return (
            <div key={key} className="grid grid-cols-[1.2fr_1fr_1.3fr] gap-3 rounded-lg border border-slate-200 p-2">
              <p className="self-center text-sm text-slate-900">{candidate.name}</p>

              <div className="space-y-1 self-center text-xs">
                <p className="font-medium text-slate-700">{sourceLabel(candidate.source)}</p>
                <p className={cn(candidate.eligible ? "text-emerald-700" : "text-red-700")}>
                  {presentLabel(candidate.presentAt)}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={!canEdit || !candidate.eligible}
                  onClick={() =>
                    setSelections((current) => {
                      const next = new Map(current);
                      next.set(key, location === "HOMECELL" ? "" : "HOMECELL");
                      return next;
                    })
                  }
                  className={cn(
                    "rounded-md border px-3 py-1 text-xs font-medium",
                    location === "HOMECELL"
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                      : "border-slate-300 text-slate-700",
                  )}
                >
                  Homecell
                </button>
                <button
                  type="button"
                  disabled={!canEdit || !candidate.eligible}
                  onClick={() =>
                    setSelections((current) => {
                      const next = new Map(current);
                      next.set(key, location === "CHURCH" ? "" : "CHURCH");
                      return next;
                    })
                  }
                  className={cn(
                    "rounded-md border px-3 py-1 text-xs font-medium",
                    location === "CHURCH" ? "border-sky-500 bg-sky-50 text-sky-700" : "border-slate-300 text-slate-700",
                  )}
                >
                  Church
                </button>
                {!candidate.eligible ? (
                  <p className="text-xs text-red-700">Only present people can be marked.</p>
                ) : null}
              </div>
            </div>
          );
        })}

        {candidates.length === 0 ? (
          <p className="text-sm text-slate-500">No members or visitors found for this homecell/week yet.</p>
        ) : null}
      </div>

      <p className="text-xs text-slate-600">No option is preselected; choose Homecell or Church only where salvation happened.</p>

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
