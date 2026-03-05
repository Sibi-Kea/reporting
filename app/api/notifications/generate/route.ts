import { NextResponse } from "next/server";

import { getServerAuthSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac";
import { generateOperationalNotifications } from "@/lib/services/notifications";

export async function POST() {
  const session = await getServerAuthSession();
  if (!session?.user?.churchId || !hasPermission(session.user.role, "notifications:manage")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const result = await generateOperationalNotifications(session.user.churchId);
  return NextResponse.json(result);
}

