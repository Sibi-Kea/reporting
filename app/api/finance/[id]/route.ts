import { AuditAction, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { logAudit } from "@/lib/audit";
import { getServerAuthSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/rbac";
import { financeSchema } from "@/lib/validations/finance";

function unauthorized() {
  return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerAuthSession();
  if (!session?.user?.churchId || !hasPermission(session.user.role, "finance:manage")) {
    return unauthorized();
  }

  const { id } = await params;
  const body = (await request.json()) as Record<string, unknown>;
  const parsed = financeSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Validation failed", errors: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const tx = await db.financeTransaction.update({
    where: { id, churchId: session.user.churchId },
    data: {
      memberId: data.memberId || null,
      serviceId: data.serviceId || null,
      financeType: data.financeType,
      amount: data.amount ? new Prisma.Decimal(data.amount.toFixed(2)) : undefined,
      paymentMethod: data.paymentMethod,
      transactionDate: data.transactionDate ? new Date(data.transactionDate) : undefined,
      note: data.note || null,
    },
  });

  await logAudit({
    churchId: session.user.churchId,
    actorUserId: session.user.id,
    actorRole: session.user.role,
    action: AuditAction.UPDATE,
    entity: "FinanceTransaction",
    entityId: tx.id,
  });

  return NextResponse.json(tx);
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerAuthSession();
  if (!session?.user?.churchId || !hasPermission(session.user.role, "finance:manage")) {
    return unauthorized();
  }

  const { id } = await params;
  await db.financeTransaction.delete({
    where: { id, churchId: session.user.churchId },
  });

  await logAudit({
    churchId: session.user.churchId,
    actorUserId: session.user.id,
    actorRole: session.user.role,
    action: AuditAction.DELETE,
    entity: "FinanceTransaction",
    entityId: id,
  });

  return NextResponse.json({ message: "Transaction deleted" });
}

