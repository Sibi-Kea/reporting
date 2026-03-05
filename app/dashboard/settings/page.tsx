import { Role } from "@prisma/client";
import { redirect } from "next/navigation";

import { ChurchSettingsForm } from "@/components/admin/church-settings-form";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { requireChurchContext } from "@/lib/tenant";

export default async function SettingsPage() {
  const context = await requireChurchContext();
  if (context.role !== Role.SUPER_ADMIN) {
    redirect("/dashboard");
  }

  const churches = await db.church.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      attendanceServiceLabels: true,
      attendanceMorningServiceLabels: true,
      attendanceEveningServiceLabels: true,
      attendanceOnlineServiceLabels: true,
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardTitle>Settings</CardTitle>
        <CardDescription className="mt-1">
          Super admin settings for church profiles and attendance service labels.
        </CardDescription>
      </Card>

      <ChurchSettingsForm churches={churches} currentChurchId={context.churchId ?? null} />
    </div>
  );
}
