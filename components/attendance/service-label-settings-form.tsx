"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { updateChurchServiceLabelsAction } from "@/app/dashboard/admin/churches/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type ServiceLabelSettingsFormProps = {
  churchId: string;
  serviceLabels: string[];
};

export function ServiceLabelSettingsForm({ churchId, serviceLabels }: ServiceLabelSettingsFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [labelsText, setLabelsText] = useState(serviceLabels.join("\n"));

  return (
    <form
      className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const formData = new FormData();
          formData.set("churchId", churchId);
          formData.set("labelsText", labelsText);
          const result = await updateChurchServiceLabelsAction(formData);
          if (!result.success) {
            toast.error(result.message);
            return;
          }
          toast.success(result.message);
          router.refresh();
        });
      }}
    >
      <p className="text-sm font-medium text-slate-700">Service Labels Settings</p>
      <Textarea
        rows={5}
        value={labelsText}
        onChange={(event) => setLabelsText(event.target.value)}
        placeholder={"North AM1\nSouth AM\nSouth AM2\nSouth PM"}
      />
      <p className="text-xs text-slate-500">One label per line. These labels are used for service creation and checkboxes.</p>
      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving..." : "Save Labels"}
        </Button>
      </div>
    </form>
  );
}
