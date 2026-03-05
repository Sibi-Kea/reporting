"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { addMemberNoteAction } from "@/app/dashboard/members/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type MemberNoteFormProps = {
  memberId: string;
};

export function MemberNoteForm({ memberId }: MemberNoteFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <form
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        formData.set("memberId", memberId);
        startTransition(async () => {
          const result = await addMemberNoteAction(formData);
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
      <Textarea name="content" placeholder="Private pastoral note..." />
      <Button type="submit" disabled={isPending}>
        {isPending ? "Saving..." : "Save note"}
      </Button>
    </form>
  );
}

