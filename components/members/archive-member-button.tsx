"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { softDeleteMemberAction } from "@/app/dashboard/members/actions";
import { Button } from "@/components/ui/button";

type ArchiveMemberButtonProps = {
  memberId: string;
};

export function ArchiveMemberButton({ memberId }: ArchiveMemberButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="danger"
      disabled={isPending}
      onClick={() => {
        const confirmed = window.confirm("Archive this member? This is a soft delete and can be restored manually.");
        if (!confirmed) return;
        startTransition(async () => {
          const result = await softDeleteMemberAction(memberId);
          if (!result.success) {
            toast.error(result.message);
            return;
          }
          toast.success(result.message);
          router.push("/dashboard/members");
        });
      }}
    >
      {isPending ? "Archiving..." : "Archive Member"}
    </Button>
  );
}

