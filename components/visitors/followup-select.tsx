"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { updateVisitorFollowUpAction } from "@/app/dashboard/visitors/actions";
import { Select } from "@/components/ui/select";

type FollowupSelectProps = {
  visitorId: string;
  value: "PENDING" | "CONTACTED" | "SCHEDULED" | "COMPLETED";
};

export function FollowupSelect({ visitorId, value }: FollowupSelectProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Select
      disabled={isPending}
      defaultValue={value}
      onChange={(event) => {
        const status = event.target.value as FollowupSelectProps["value"];
        startTransition(async () => {
          const result = await updateVisitorFollowUpAction(visitorId, status);
          if (!result.success) {
            toast.error(result.message);
            return;
          }
          toast.success(result.message);
          router.refresh();
        });
      }}
    >
      <option value="PENDING">Pending</option>
      <option value="CONTACTED">Contacted</option>
      <option value="SCHEDULED">Scheduled</option>
      <option value="COMPLETED">Completed</option>
    </Select>
  );
}

