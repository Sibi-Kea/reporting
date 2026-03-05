"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { requireChurchContext } from "@/lib/tenant";

export async function markNotificationReadAction(notificationId: string) {
  const context = await requireChurchContext();
  if (!context.churchId) {
    return { success: false, message: "No church context" };
  }

  const result = await db.notification.updateMany({
    where: {
      id: notificationId,
      churchId: context.churchId,
      userId: context.userId,
    },
    data: {
      isRead: true,
      sentAt: new Date(),
    },
  });

  if (!result.count) {
    return { success: false, message: "Notification not found." };
  }

  revalidatePath("/dashboard/notifications");
  return { success: true, message: "Notification marked as read." };
}

export async function markAllNotificationsReadAction() {
  const context = await requireChurchContext();
  if (!context.churchId) {
    return { success: false, message: "No church context" };
  }

  await db.notification.updateMany({
    where: {
      churchId: context.churchId,
      userId: context.userId,
      isRead: false,
    },
    data: {
      isRead: true,
      sentAt: new Date(),
    },
  });

  revalidatePath("/dashboard/notifications");
  return { success: true, message: "All notifications marked read." };
}
