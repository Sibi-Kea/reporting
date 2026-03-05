import { AuditAction } from "@prisma/client";
import { NextResponse } from "next/server";

import { logAudit } from "@/lib/audit";
import { getServerAuthSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/rbac";
import { visitorSchema } from "@/lib/validations/visitor";

function unauthorized() {
  return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
}

export async function GET() {
  const session = await getServerAuthSession();
  if (!session?.user?.churchId || !hasPermission(session.user.role, "visitors:view")) {
    return unauthorized();
  }

  const visitors = await db.visitor.findMany({
    where: { churchId: session.user.churchId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(visitors);
}

export async function POST(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.churchId || !hasPermission(session.user.role, "visitors:manage")) {
    return unauthorized();
  }

  const body = (await request.json()) as Record<string, unknown>;
  const parsed = visitorSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Validation failed", errors: parsed.error.flatten() }, { status: 400 });
  }

  const visitor = await db.visitor.create({
    data: {
      churchId: session.user.churchId,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName || null,
      phone: parsed.data.phone,
      invitedBy: parsed.data.invitedBy || null,
      firstTime: parsed.data.firstTime,
      firstVisitDate: new Date(parsed.data.firstVisitDate),
      followUpStatus: parsed.data.followUpStatus,
      convertedToMember: parsed.data.convertedToMember,
      notes: parsed.data.notes || null,
    },
  });

  await logAudit({
    churchId: session.user.churchId,
    actorUserId: session.user.id,
    actorRole: session.user.role,
    action: AuditAction.CREATE,
    entity: "Visitor",
    entityId: visitor.id,
  });

  return NextResponse.json(visitor, { status: 201 });
}

