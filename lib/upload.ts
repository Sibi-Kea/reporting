import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { put } from "@vercel/blob";
import { nanoid } from "nanoid";

const uploadRoot = path.join(process.cwd(), "public", "uploads", "profiles");

export async function saveProfilePhoto(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const fileName = `${nanoid(16)}.${extension}`;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(`profiles/${fileName}`, file, {
      access: "public",
      addRandomSuffix: false,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    return blob.url;
  }

  if (process.env.VERCEL === "1") {
    throw new Error(
      "Profile uploads on Vercel require BLOB_READ_WRITE_TOKEN.",
    );
  }

  await mkdir(uploadRoot, { recursive: true });
  const destination = path.join(uploadRoot, fileName);
  const arrayBuffer = await file.arrayBuffer();
  await writeFile(destination, Buffer.from(arrayBuffer));

  return `/uploads/profiles/${fileName}`;
}
