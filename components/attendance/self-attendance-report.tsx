"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { submitSelfAttendanceReportAction } from "@/app/dashboard/attendance/actions";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type SelfAttendanceReportProps = {
  serviceId: string;
  initialStatus?: "PRESENT" | "ABSENT" | "ONLINE";
  initialNote?: string;
  submittedAtLabel?: string | null;
};

export function SelfAttendanceReport({
  serviceId,
  initialStatus = "PRESENT",
  initialNote = "",
  submittedAtLabel,
}: SelfAttendanceReportProps) {
  const [status, setStatus] = useState<"PRESENT" | "ABSENT" | "ONLINE">(initialStatus);
  const [note, setNote] = useState(initialNote);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      className="space-y-3 rounded-xl border border-slate-200 bg-white p-4"
      onSubmit={(event) => {
        event.preventDefault();
        const payload = {
          serviceId,
          status,
          note,
        };

        startTransition(async () => {
          const result = await submitSelfAttendanceReportAction(payload);
          if (!result.success) {
            toast.error(result.message);
            return;
          }
          toast.success(result.message);
        });
      }}
    >
      <div className="grid gap-3 md:grid-cols-2">
        <Select
          name="status"
          value={status}
          onChange={(event) => setStatus(event.target.value as "PRESENT" | "ABSENT" | "ONLINE")}
        >
          <option value="PRESENT">I am present</option>
          <option value="ONLINE">I am online</option>
          <option value="ABSENT">I am absent</option>
        </Select>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Submitting..." : "Submit Self Report"}
        </Button>
      </div>

      <Textarea
        name="note"
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Optional note (meeting reason, follow-up, or ministry context)"
      />
      <p className="text-xs text-slate-500">
        {submittedAtLabel ? `Last submitted: ${submittedAtLabel}` : "No self report submitted yet for this service."}
      </p>
    </form>
  );
}
