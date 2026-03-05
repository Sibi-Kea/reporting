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

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerAuthSession();
  if (!session?.user?.churchId || !hasPermission(session.user.role, "visitors:manage")) {
    return unauthorized();
  }

  const { id } = await params;
  const body = (await request.json()) as Record<string, unknown>;
  const parsed = visitorSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Validation failed", errors: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const visitor = await db.visitor.update({
    where: { id, churchId: session.user.churchId },
    data: {
      firstName: data.firstName,
      lastName: data.lastName || null,
      phone: data.phone,
      invitedBy: data.invitedBy || null,
      firstTime: data.firstTime,
      firstVisitDate: data.firstVisitDate ? new Date(data.firstVisitDate) : undefined,
      followUpStatus: data.followUpStatus,
      convertedToMember: data.convertedToMember,
      notes: data.notes || null,
    },
  });

  await logAudit({
    churchId: session.user.churchId,
    actorUserId: session.user.id,
    actorRole: session.user.role,
    action: AuditAction.UPDATE,
    entity: "Visitor",
    entityId: visitor.id,
  });

  return NextResponse.json(visitor);
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerAuthSession();
  if (!session?.user?.churchId || !hasPermission(session.user.role, "visitors:manage")) {
    return unauthorized();
  }

  const { id } = await params;
  await db.visitor.delete({
    where: { id, churchId: session.user.churchId },
  });

  await logAudit({
    churchId: session.user.churchId,
    actorUserId: session.user.id,
    actorRole: session.user.role,
    action: AuditAction.DELETE,
    entity: "Visitor",
    entityId: id,
  });

  return NextResponse.json({ message: "Visitor deleted" });
}

