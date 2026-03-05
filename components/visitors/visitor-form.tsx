"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { createVisitorAction } from "@/app/dashboard/visitors/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export function VisitorForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <form
      className="grid gap-3 md:grid-cols-4"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(async () => {
          const result = await createVisitorAction(formData);
          if (!result.success) {
            toast.error(result.message);
            return;
          }
          toast.success(result.message);
          event.currentTarget.reset();
          router.refresh();
        });
      }}
    >
      <Input name="firstName" placeholder="First name" />
      <Input name="lastName" placeholder="Last name" />
      <Input name="phone" placeholder="Phone" />
      <Input name="invitedBy" placeholder="Invited by" />
      <Input name="firstVisitDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
      <Select name="followUpStatus" defaultValue="PENDING">
        <option value="PENDING">Pending</option>
        <option value="CONTACTED">Contacted</option>
        <option value="SCHEDULED">Scheduled</option>
        <option value="COMPLETED">Completed</option>
      </Select>
      <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
        <input type="checkbox" name="firstTime" defaultChecked />
        First-time visitor
      </label>
      <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
        <input type="checkbox" name="convertedToMember" />
        Converted to member
      </label>
      <Input className="md:col-span-3" name="notes" placeholder="Notes (optional)" />
      <Button type="submit" disabled={isPending}>
        {isPending ? "Saving..." : "Add Visitor"}
      </Button>
    </form>
  );
}

