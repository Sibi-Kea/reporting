import { Role } from "@prisma/client";
import { redirect } from "next/navigation";

import { getServerAuthSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

export async function requireAuth() {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const dbUser = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, churchId: true, isActive: true },
  });
  if (!dbUser || !dbUser.isActive) {
    redirect("/login");
  }

  session.user.role = dbUser.role;
  session.user.churchId = dbUser.churchId;
  return session;
}

export async function requireChurchContext() {
  const session = await requireAuth();
  if (!session.user.churchId && session.user.role !== Role.SUPER_ADMIN) {
    redirect("/login");
  }

  if (!session.user.churchId && session.user.role === Role.SUPER_ADMIN) {
    const church = await db.church.findFirst({
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });
    if (!church) {
      return {
        userId: session.user.id,
        role: session.user.role,
        churchId: null,
      };
    }
    return {
      userId: session.user.id,
      role: session.user.role,
      churchId: church.id,
    };
  }

  return {
    userId: session.user.id,
    role: session.user.role,
    churchId: session.user.churchId,
  };
}

export function assertChurch(churchId: string | null | undefined): string {
  if (!churchId) {
    redirect("/dashboard/settings");
  }
  return churchId;
}
