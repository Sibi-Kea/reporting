"use server";

import { AuditAction, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/rbac";
import { assertChurch, requireChurchContext } from "@/lib/tenant";
import { financeSchema } from "@/lib/validations/finance";

export async function createFinanceTransactionAction(formData: FormData) {
  const context = await requireChurchContext();
  if (!hasPermission(context.role, "finance:manage")) {
    return { success: false, message: "You are not allowed to record finance transactions." };
  }

  const churchId = assertChurch(context.churchId);
  const parsed = financeSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { success: false, message: "Invalid finance transaction." };
  }

  const transaction = await db.financeTransaction.create({
    data: {
      churchId,
      memberId: parsed.data.memberId || null,
      serviceId: parsed.data.serviceId || null,
      capturedById: context.userId,
      financeType: parsed.data.financeType,
      amount: new Prisma.Decimal(parsed.data.amount.toFixed(2)),
      paymentMethod: parsed.data.paymentMethod,
      transactionDate: new Date(parsed.data.transactionDate),
      note: parsed.data.note || null,
    },
  });

  await logAudit({
    churchId,
    actorUserId: context.userId,
    actorRole: context.role,
    action: AuditAction.CREATE,
    entity: "FinanceTransaction",
    entityId: transaction.id,
  });

  revalidatePath("/dashboard/finance");
  return { success: true, message: "Transaction recorded." };
}

