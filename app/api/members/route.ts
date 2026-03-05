import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { getServerAuthSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { resolveMemberScope } from "@/lib/member-scope";
import { hasPermission } from "@/lib/rbac";
import { memberSchema } from "@/lib/validations/member";

function unauthorized() {
  return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
}

function scopedHomecellIds(input: { isFullAccess: boolean; homecellIds: string[] }) {
  return input.isFullAccess ? [] : input.homecellIds.length > 0 ? input.homecellIds : ["__no_scope__"];
}

export async function GET(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.churchId || !session.user.id || !hasPermission(session.user.role, "members:view")) {
    return unauthorized();
  }

  const scope = await resolveMemberScope({
    churchId: session.user.churchId,
    userId: session.user.id,
    role: session.user.role,
  });
  const scopeHomecellIds = scopedHomecellIds(scope);

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");
  const page = Number(searchParams.get("page") ?? "1");
  const pageSize = Math.min(Number(searchParams.get("limit") ?? "20"), 100);

  const where: Prisma.MemberWhereInput = {
    churchId: session.user.churchId,
    isDeleted: false,
    ...(scope.isFullAccess ? {} : { homecellId: { in: scopeHomecellIds } }),
    ...(q
      ? {
          OR: [
            { firstName: { contains: q, mode: "insensitive" } },
            { lastName: { contains: q, mode: "insensitive" } },
            { phone: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    db.member.findMany({
      where,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.member.count({ where }),
  ]);

  return NextResponse.json({
    items,
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
  });
}

export async function POST(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.churchId || !session.user.id || !hasPermission(session.user.role, "members:manage")) {
    return unauthorized();
  }

  const scope = await resolveMemberScope({
    churchId: session.user.churchId,
    userId: session.user.id,
    role: session.user.role,
  });

  const json = (await request.json()) as Record<string, unknown>;
  const parsed = memberSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ message: "Validation failed", errors: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  if (!scope.isFullAccess) {
    if (!data.homecellId || !scope.homecellIds.includes(data.homecellId)) {
      return NextResponse.json(
        { message: "Select a homecell inside your assigned structure scope." },
        { status: 403 },
      );
    }
  }

  const member = await db.member.create({
    data: {
      churchId: session.user.churchId,
      firstName: data.firstName,
      lastName: data.lastName,
      gender: data.gender,
      dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
      phone: data.phone || null,
      email: data.email || null,
      address: data.address || null,
      maritalStatus: data.maritalStatus || null,
      occupation: data.occupation || null,
      dateJoined: new Date(data.dateJoined),
      salvationStatus: data.salvationStatus,
      baptismStatus: data.baptismStatus,
      holySpiritBaptismStatus: data.holySpiritBaptismStatus,
      jimJohn316Status: data.jimJohn316Status,
      jimSgtStatus: data.jimSgtStatus,
      jimDiscStatus: data.jimDiscStatus,
      jimNltStatus: data.jimNltStatus,
      involvementNotes: data.involvementNotes || null,
      membershipStatus: data.membershipStatus,
      departmentId: data.departmentId || null,
      homecellId: data.homecellId || null,
      emergencyContactName: data.emergencyContactName || null,
      emergencyContactPhone: data.emergencyContactPhone || null,
      profilePhotoUrl: data.profilePhotoUrl || null,
    },
  });

  return NextResponse.json(member, { status: 201 });
}
