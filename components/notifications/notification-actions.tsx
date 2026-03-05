"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/app/dashboard/notifications/actions";
import { Button } from "@/components/ui/button";

type NotificationActionsProps = {
  notificationId?: string;
  all?: boolean;
};

export function NotificationActions({ notificationId, all = false }: NotificationActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          const result = all
            ? await markAllNotificationsReadAction()
            : await markNotificationReadAction(notificationId ?? "");
          if (!result.success) {
            toast.error(result.message);
            return;
          }
          toast.success(result.message);
          router.refresh();
        });
      }}
    >
      {isPending ? "Saving..." : all ? "Mark all read" : "Mark read"}
    </Button>
  );
}

