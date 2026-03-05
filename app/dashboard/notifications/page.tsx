import Link from "next/link";

import { GenerateRemindersButton } from "@/components/notifications/generate-reminders-button";
import { NotificationActions } from "@/components/notifications/notification-actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/rbac";
import { assertChurch, requireChurchContext } from "@/lib/tenant";

export default async function NotificationsPage() {
  const context = await requireChurchContext();
  const churchId = assertChurch(context.churchId);
  const canManage = hasPermission(context.role, "notifications:manage");

  const notifications = await db.notification.findMany({
    where: {
      churchId,
      userId: context.userId,
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle>Notifications</CardTitle>
            <CardDescription className="mt-1">
              In-app reminders for attendance, homecell report submissions, and visitor follow-up.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {canManage ? <GenerateRemindersButton /> : null}
            <NotificationActions all />
          </div>
        </div>
      </Card>

      <div className="space-y-3">
        {notifications.map((notification) => (
          <Card
            key={notification.id}
            className={`${notification.isRead ? "opacity-70" : "border-l-4 border-l-sky-500"}`}
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-slate-900">{notification.title}</h3>
                  <Badge variant={notification.isRead ? "default" : "success"}>
                    {notification.isRead ? "Read" : "Unread"}
                  </Badge>
                </div>
                <p className="text-sm text-slate-600">{notification.message}</p>
                <p className="text-xs text-slate-500">{notification.createdAt.toLocaleString()}</p>
              </div>
              <div className="flex gap-2">
                {notification.actionUrl ? (
                  <Link
                    href={notification.actionUrl}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    Open
                  </Link>
                ) : null}
                {!notification.isRead ? <NotificationActions notificationId={notification.id} /> : null}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

