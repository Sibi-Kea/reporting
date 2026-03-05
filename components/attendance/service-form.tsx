"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { createServiceAction } from "@/app/dashboard/attendance/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type ServiceFormProps = {
  serviceLabels: string[];
  defaultEventDate?: string;
  servicesMonth?: string;
};

export function ServiceForm({ serviceLabels, defaultEventDate, servicesMonth }: ServiceFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <form
      className="grid gap-3 md:grid-cols-4"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(async () => {
          const result = await createServiceAction(formData);
          if (!result.success) {
            toast.error(result.message);
            return;
          }
          toast.success(result.message);
          const eventDateValue = String(formData.get("eventDate") ?? "");
          const monthFromDate = /^\d{4}-\d{2}-\d{2}$/.test(eventDateValue)
            ? eventDateValue.slice(0, 7)
            : servicesMonth;
          if (result.serviceId) {
            const query = new URLSearchParams();
            query.set("serviceId", result.serviceId);
            if (monthFromDate) {
              query.set("servicesMonth", monthFromDate);
            }
            router.push(`/dashboard/attendance?${query.toString()}`);
          } else {
            router.refresh();
          }
        });
      }}
    >
      <Input name="title" placeholder="Custom service title (optional)" />
      <Select name="serviceType" defaultValue="SUNDAY">
        <option value="SUNDAY">Sunday Service</option>
        <option value="MIDWEEK">Midweek Service</option>
        <option value="SPECIAL">Special Event</option>
        <option value="CUSTOM">Custom Event</option>
      </Select>
      <Input type="date" name="eventDate" defaultValue={defaultEventDate ?? new Date().toISOString().slice(0, 10)} />
      <Button type="submit" disabled={isPending}>
        {isPending ? "Creating..." : "Create Service(s)"}
      </Button>
      {serviceLabels.length > 0 ? (
        <div className="md:col-span-4">
          <p className="mb-2 text-sm font-medium text-slate-700">Church service labels</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {serviceLabels.map((label) => (
              <label
                key={label}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
              >
                <input type="checkbox" name="titles" value={label} />
                {label}
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Select one or more labels to create multiple services for the same date.
          </p>
        </div>
      ) : null}
    </form>
  );
}
