import { Role } from "@prisma/client";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getServerAuthSession } from "@/lib/auth/session";
import { churchSchema } from "@/lib/validations/church";

function unauthorized() {
  return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
}

export async function GET() {
  const session = await getServerAuthSession();
  if (!session?.user || session.user.role !== Role.SUPER_ADMIN) {
    return unauthorized();
  }

  const churches = await db.church.findMany({
    include: {
      pastor: { select: { name: true, email: true } },
      _count: { select: { members: true, users: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(churches);
}

export async function POST(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user || session.user.role !== Role.SUPER_ADMIN) {
    return unauthorized();
  }

  const body = (await request.json()) as Record<string, unknown>;
  const parsed = churchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Validation failed", errors: parsed.error.flatten() }, { status: 400 });
  }

  const church = await db.church.create({
    data: {
      name: parsed.data.name,
      slug: parsed.data.slug,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      address: parsed.data.address || null,
      pastorId: parsed.data.pastorUserId || null,
      createdById: session.user.id,
    },
  });

  return NextResponse.json(church, { status: 201 });
}

