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

export async function GET() {
  const session = await getServerAuthSession();
  if (!session?.user?.churchId || !hasPermission(session.user.role, "finance:view")) {
    return unauthorized();
  }

  const transactions = await db.financeTransaction.findMany({
    where: { churchId: session.user.churchId },
    orderBy: { transactionDate: "desc" },
  });
  return NextResponse.json(transactions);
}

export async function POST(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.churchId || !hasPermission(session.user.role, "finance:manage")) {
    return unauthorized();
  }

  const body = (await request.json()) as Record<string, unknown>;
  const parsed = financeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Validation failed", errors: parsed.error.flatten() }, { status: 400 });
  }

  const tx = await db.financeTransaction.create({
    data: {
      churchId: session.user.churchId,
      memberId: parsed.data.memberId || null,
      serviceId: parsed.data.serviceId || null,
      capturedById: session.user.id,
      financeType: parsed.data.financeType,
      amount: new Prisma.Decimal(parsed.data.amount.toFixed(2)),
      paymentMethod: parsed.data.paymentMethod,
      transactionDate: new Date(parsed.data.transactionDate),
      note: parsed.data.note || null,
    },
  });

  await logAudit({
    churchId: session.user.churchId,
    actorUserId: session.user.id,
    actorRole: session.user.role,
    action: AuditAction.CREATE,
    entity: "FinanceTransaction",
    entityId: tx.id,
  });

  return NextResponse.json(tx, { status: 201 });
}

