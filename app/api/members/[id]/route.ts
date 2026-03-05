import { AuditAction } from "@prisma/client";
import { NextResponse } from "next/server";

import { logAudit } from "@/lib/audit";
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

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
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

  const { id } = await params;
  const member = await db.member.findFirst({
    where: {
      id,
      churchId: session.user.churchId,
      isDeleted: false,
      ...(scope.isFullAccess ? {} : { homecellId: { in: scopeHomecellIds } }),
    },
    include: {
      homecell: { select: { name: true } },
      department: { select: { name: true } },
    },
  });

  if (!member) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  return NextResponse.json(member);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerAuthSession();
  if (!session?.user?.churchId || !session.user.id || !hasPermission(session.user.role, "members:manage")) {
    return unauthorized();
  }

  const scope = await resolveMemberScope({
    churchId: session.user.churchId,
    userId: session.user.id,
    role: session.user.role,
  });
  const scopeHomecellIds = scopedHomecellIds(scope);

  const { id } = await params;
  const scopedMember = await db.member.findFirst({
    where: {
      id,
      churchId: session.user.churchId,
      isDeleted: false,
      ...(scope.isFullAccess ? {} : { homecellId: { in: scopeHomecellIds } }),
    },
    select: { id: true },
  });
  if (!scopedMember) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const body = (await request.json()) as Record<string, unknown>;
  const parsed = memberSchema.safeParse(body);
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

  const member = await db.member.update({
    where: { id, churchId: session.user.churchId },
    data: {
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

  await logAudit({
    churchId: session.user.churchId,
    actorUserId: session.user.id,
    actorRole: session.user.role,
    action: AuditAction.UPDATE,
    entity: "Member",
    entityId: member.id,
  });

  return NextResponse.json(member);
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerAuthSession();
  if (!session?.user?.churchId || !session.user.id || !hasPermission(session.user.role, "members:manage")) {
    return unauthorized();
  }

  const scope = await resolveMemberScope({
    churchId: session.user.churchId,
    userId: session.user.id,
    role: session.user.role,
  });
  const scopeHomecellIds = scopedHomecellIds(scope);

  const { id } = await params;
  const scopedMember = await db.member.findFirst({
    where: {
      id,
      churchId: session.user.churchId,
      isDeleted: false,
      ...(scope.isFullAccess ? {} : { homecellId: { in: scopeHomecellIds } }),
    },
    select: { id: true },
  });
  if (!scopedMember) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const member = await db.member.update({
    where: { id, churchId: session.user.churchId },
    data: {
      isDeleted: true,
      deletedAt: new Date(),
      membershipStatus: "INACTIVE",
    },
  });

  await logAudit({
    churchId: session.user.churchId,
    actorUserId: session.user.id,
    actorRole: session.user.role,
    action: AuditAction.DELETE,
    entity: "Member",
    entityId: member.id,
  });

  return NextResponse.json({ message: "Member archived" });
}
