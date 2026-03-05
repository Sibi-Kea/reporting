"use client";

import { startOfWeek, endOfWeek } from "date-fns";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { submitHomecellReportAction } from "@/app/dashboard/homecells/reports/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type MemberItem = {
  id: string;
  name: string;
};

type HomecellItem = {
  id: string;
  name: string;
  members: MemberItem[];
};

type ReportFormProps = {
  homecells: HomecellItem[];
  defaultHomecellId?: string;
};

export function HomecellReportForm({ homecells, defaultHomecellId }: ReportFormProps) {
  const [isPending, startTransition] = useTransition();
  const [homecellId, setHomecellId] = useState(defaultHomecellId ?? homecells[0]?.id ?? "");
  const [members, setMembers] = useState(
    () =>
      homecells.find((homecell) => homecell.id === (defaultHomecellId ?? homecells[0]?.id))?.members.map((member) => ({
        memberId: member.id,
        memberName: member.name,
        present: true,
        absenceReason: "",
        absenceNote: "",
      })) ?? [],
  );
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 }).toISOString().slice(0, 10);
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 }).toISOString().slice(0, 10);

  const selectedHomecell = useMemo(
    () => homecells.find((homecell) => homecell.id === homecellId),
    [homecellId, homecells],
  );

  const presentCount = members.filter((member) => member.present).length;
  const absentCount = members.length - presentCount;

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const payload = {
          homecellId,
          weekStartDate: String(formData.get("weekStartDate")),
          weekEndDate: String(formData.get("weekEndDate")),
          visitors: Number(formData.get("visitors") ?? 0),
          firstTimeVisitors: Number(formData.get("firstTimeVisitors") ?? 0),
          prayerRequests: String(formData.get("prayerRequests") ?? ""),
          offeringCollected: String(formData.get("offeringCollected") ?? ""),
          members,
        };

        startTransition(async () => {
          const result = await submitHomecellReportAction(payload);
          if (!result.success) {
            toast.error(result.message);
            return;
          }
          toast.success(result.message);
        });
      }}
    >
      <div className="grid gap-3 md:grid-cols-3">
        <Select
          value={homecellId}
          onChange={(event) => {
            const nextHomecellId = event.target.value;
            setHomecellId(nextHomecellId);
            const nextMembers =
              homecells.find((homecell) => homecell.id === nextHomecellId)?.members.map((member) => ({
                memberId: member.id,
                memberName: member.name,
                present: true,
                absenceReason: "",
                absenceNote: "",
              })) ?? [];
            setMembers(nextMembers);
          }}
        >
          {homecells.map((homecell) => (
            <option key={homecell.id} value={homecell.id}>
              {homecell.name}
            </option>
          ))}
        </Select>
        <Input name="weekStartDate" type="date" defaultValue={weekStart} />
        <Input name="weekEndDate" type="date" defaultValue={weekEnd} />
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Input name="visitors" type="number" min={0} defaultValue={0} placeholder="Visitors" />
        <Input name="firstTimeVisitors" type="number" min={0} defaultValue={0} placeholder="First-time visitors" />
        <Input name="offeringCollected" type="number" min={0} step="0.01" placeholder="Offering collected" />
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
          <p>Total: {members.length}</p>
          <p>Present: {presentCount}</p>
          <p>Absent: {absentCount}</p>
        </div>
      </div>

      <Textarea name="prayerRequests" placeholder="Prayer requests..." />

      <div className="space-y-2">
        {selectedHomecell?.members.map((member, index) => {
          const state = members[index];
          if (!state) return null;
          return (
            <div
              key={member.id}
              className="grid gap-2 rounded-lg border border-slate-200 bg-white p-3 md:grid-cols-[2fr_1fr_2fr]"
            >
              <p className="font-medium text-slate-700">{member.name}</p>
              <Select
                value={state.present ? "PRESENT" : "ABSENT"}
                onChange={(event) => {
                  const present = event.target.value === "PRESENT";
                  setMembers((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index
                        ? {
                            ...item,
                            present,
                            absenceReason: present ? "" : item.absenceReason,
                            absenceNote: present ? "" : item.absenceNote,
                          }
                        : item,
                    ),
                  );
                }}
              >
                <option value="PRESENT">Present</option>
                <option value="ABSENT">Absent</option>
              </Select>
              {state.present ? (
                <div className="text-xs text-emerald-600 md:self-center">Present</div>
              ) : (
                <div className="grid gap-2 md:grid-cols-2">
                  <Select
                    value={state.absenceReason}
                    onChange={(event) =>
                      setMembers((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, absenceReason: event.target.value } : item,
                        ),
                      )
                    }
                  >
                    <option value="">Reason required</option>
                    <option value="Travel">Travel</option>
                    <option value="Sick">Sick</option>
                    <option value="Work">Work</option>
                    <option value="Family">Family</option>
                    <option value="Other">Other</option>
                  </Select>
                  <Input
                    value={state.absenceNote}
                    onChange={(event) =>
                      setMembers((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, absenceNote: event.target.value } : item,
                        ),
                      )
                    }
                    placeholder="Note"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Submitting..." : "Submit Report"}
        </Button>
      </div>
    </form>
  );
}

