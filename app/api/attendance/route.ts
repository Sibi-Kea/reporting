import { NextResponse } from "next/server";

import { canMarkMemberAttendance, resolveAttendanceScope } from "@/lib/attendance-scope";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/rbac";
import { getServerAuthSession } from "@/lib/auth/session";
import { attendanceSubmissionSchema } from "@/lib/validations/attendance";

function unauthorized() {
  return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
}

export async function GET(request: Request) {
  const session = await getServerAuthSession();
  if (
    !session?.user?.id ||
    !session.user.churchId ||
    !hasPermission(session.user.role, "attendance:view")
  ) {
    return unauthorized();
  }

  const { searchParams } = new URL(request.url);
  const serviceId = searchParams.get("serviceId");
  if (!serviceId) {
    return NextResponse.json({ message: "serviceId is required" }, { status: 400 });
  }

  const scope = await resolveAttendanceScope({
    churchId: session.user.churchId,
    userId: session.user.id,
    role: session.user.role,
  });

  const record = await db.attendanceRecord.findFirst({
    where: {
      churchId: session.user.churchId,
      serviceId,
    },
    include: {
      entries: {
        where: scope.isFullAccess ? undefined : { member: { homecellId: { in: scope.homecellIds } } },
      },
      service: true,
    },
  });

  return NextResponse.json(record);
}

export async function POST(request: Request) {
  const session = await getServerAuthSession();
  if (
    !session?.user?.id ||
    !session.user.churchId ||
    !hasPermission(session.user.role, "attendance:manage") ||
    !canMarkMemberAttendance(session.user.role)
  ) {
    return unauthorized();
  }

  const body = (await request.json()) as unknown;
  const parsed = attendanceSubmissionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Validation failed", errors: parsed.error.flatten() }, { status: 400 });
  }

  const hasInvalidAbsence = parsed.data.entries.some(
    (entry) => entry.status === "ABSENT" && !entry.absentReason,
  );
  if (hasInvalidAbsence) {
    return NextResponse.json({ message: "Absent members require an absence reason" }, { status: 400 });
  }

  const payloadMemberIds = parsed.data.entries.map((entry) => entry.memberId);
  const uniqueMemberIds = Array.from(new Set(payloadMemberIds));
  if (uniqueMemberIds.length !== payloadMemberIds.length) {
    return NextResponse.json({ message: "Duplicate members in payload" }, { status: 400 });
  }

  const churchId = session.user.churchId;
  const service = await db.service.findFirst({
    where: { id: parsed.data.serviceId, churchId },
    select: { id: true },
  });
  if (!service) {
    return NextResponse.json({ message: "Invalid service" }, { status: 400 });
  }

  const scope = await resolveAttendanceScope({
    churchId,
    userId: session.user.id,
    role: session.user.role,
  });
  if (!scope.isFullAccess && scope.homecellIds.length === 0) {
    return NextResponse.json({ message: "No attendance scope assigned" }, { status: 403 });
  }

  const scopedMembers = await db.member.findMany({
    where: {
      churchId,
      isDeleted: false,
      id: { in: uniqueMemberIds },
      ...(scope.isFullAccess ? {} : { homecellId: { in: scope.homecellIds } }),
    },
    select: { id: true },
  });
  if (scopedMembers.length !== uniqueMemberIds.length) {
    return NextResponse.json({ message: "Members outside your scope" }, { status: 403 });
  }

  const attendanceRecord = await db.attendanceRecord.upsert({
    where: {
      churchId_serviceId: {
        churchId,
        serviceId: parsed.data.serviceId,
      },
    },
    update: {
      markedById: session.user.id,
      updatedAt: new Date(),
    },
    create: {
      churchId,
      serviceId: parsed.data.serviceId,
      markedById: session.user.id,
    },
  });

  await db.$transaction([
    db.attendanceEntry.deleteMany({
      where: {
        attendanceId: attendanceRecord.id,
        memberId: { in: uniqueMemberIds },
      },
    }),
    db.attendanceEntry.createMany({
      data: parsed.data.entries.map((entry) => ({
        churchId,
        attendanceId: attendanceRecord.id,
        memberId: entry.memberId,
        status: entry.status,
        absentReason: entry.status === "ABSENT" ? entry.absentReason || null : null,
        absentNote: entry.status === "ABSENT" ? entry.absentNote || null : null,
      })),
    }),
  ]);

  return NextResponse.json({ id: attendanceRecord.id, message: "Attendance saved" });
}
