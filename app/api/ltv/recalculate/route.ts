import { NextResponse } from "next/server";

import { getServerAuthSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac";
import { recalculateMonthlyLtv } from "@/lib/services/ltv";

export async function POST(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.churchId || !hasPermission(session.user.role, "analytics:view")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  await recalculateMonthlyLtv(session.user.churchId);
  return NextResponse.redirect(new URL("/dashboard/analytics", request.url));
}

