import { NextResponse } from "next/server";

import { getServerAuthSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac";

type ExportAccess = { churchId: string } | { response: NextResponse };

export async function requireExportAccess(): Promise<ExportAccess> {
  const session = await getServerAuthSession();
  if (!session?.user?.churchId || !hasPermission(session.user.role, "exports:run")) {
    return { response: NextResponse.json({ message: "Unauthorized" }, { status: 401 }) };
  }

  return { churchId: session.user.churchId };
}

export function csvResponse(csv: string, filename: string) {
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=\"${filename}\"`,
    },
  });
}
