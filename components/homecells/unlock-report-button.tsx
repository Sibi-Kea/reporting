"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { unlockHomecellReportAction } from "@/app/dashboard/homecells/reports/actions";
import { Button } from "@/components/ui/button";

type UnlockReportButtonProps = {
  reportId: string;
};

export function UnlockReportButton({ reportId }: UnlockReportButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          const result = await unlockHomecellReportAction({ reportId });
          if (!result.success) {
            toast.error(result.message);
            return;
          }
          toast.success(result.message);
          router.refresh();
        });
      }}
    >
      {isPending ? "Unlocking..." : "Unlock"}
    </Button>
  );
}

