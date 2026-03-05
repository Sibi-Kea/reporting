import { NextResponse } from "next/server";

import { getServerAuthSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac";
import { saveProfilePhoto } from "@/lib/upload";

const MAX_IMAGE_SIZE_BYTES = 4 * 1024 * 1024;

export async function POST(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user || !hasPermission(session.user.role, "members:manage")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ message: "File is required" }, { status: 400 });
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ message: "Image files only" }, { status: 400 });
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return NextResponse.json(
      { message: "Image must be 4MB or smaller" },
      { status: 400 },
    );
  }

  try {
    const url = await saveProfilePhoto(file);
    return NextResponse.json({ url });
  } catch (error) {
    console.error("Profile photo upload failed:", error);
    return NextResponse.json(
      { message: "Upload failed. Check storage configuration." },
      { status: 500 },
    );
  }
}
