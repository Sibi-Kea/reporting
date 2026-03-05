import { AuditAction, Prisma, Role } from "@prisma/client";

import { db } from "@/lib/db";

type AuditLogInput = {
  churchId?: string | null;
  actorUserId: string;
  actorRole: Role;
  action: AuditAction;
  entity: string;
  entityId?: string;
  payload?: Prisma.InputJsonValue;
};

export async function logAudit(input: AuditLogInput) {
  try {
    await db.auditLog.create({
      data: {
        churchId: input.churchId ?? null,
        actorUserId: input.actorUserId,
        actorRole: input.actorRole,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId,
        payload: input.payload,
      },
    });
  } catch (error) {
    // Audit logging must never block business actions.
    if (process.env.NODE_ENV !== "production") {
      console.error("Audit log write failed", error);
    }
  }
}
