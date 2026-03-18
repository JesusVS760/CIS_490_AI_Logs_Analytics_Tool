import { NextRequest, NextResponse } from "next/server";
import path from "path";
import crypto from "crypto";
import { promises as fs } from "fs";
import db from "@/lib/db";
import { verifyAuth } from "@/lib/auth";

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

function getExtensionFromFile(file: File): string {
  const byType: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
  };

  if (byType[file.type]) return byType[file.type];

  const fileName = file.name.toLowerCase();
  const ext = path.extname(fileName);
  return ext || ".jpg";
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await verifyAuth(req);

    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("profilePic");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Profile picture file is required" },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Only JPG, PNG, WEBP, and GIF images are allowed" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: "Image must be 5MB or smaller" },
        { status: 400 }
      );
    }

    const uploadDir = path.join(
      process.cwd(),
      "public",
      "uploads",
      "profile-pics"
    );

    await fs.mkdir(uploadDir, { recursive: true });

    const ext = getExtensionFromFile(file);
    const fileName = `${auth.instructorId}-${Date.now()}-${crypto
      .randomBytes(8)
      .toString("hex")}${ext}`;

    const absolutePath = path.join(uploadDir, fileName);
    const publicPath = `/uploads/profile-pics/${fileName}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    await fs.writeFile(absolutePath, buffer);

    if (
      auth.profilePic &&
      auth.profilePic.startsWith("/uploads/profile-pics/")
    ) {
      const oldFilePath = path.join(process.cwd(), "public", auth.profilePic);
      try {
        await fs.unlink(oldFilePath);
      } catch {}
    }

    db.prepare(
      `
      UPDATE instructors
      SET profile_pic = ?
      WHERE id = ?
      `
    ).run(publicPath, auth.instructorId);

    return NextResponse.json({
      success: true,
      profilePic: publicPath,
      user: {
        id: auth.instructorId,
        email: auth.email,
        name: auth.name,
        darkMode: auth.darkMode,
        profilePic: publicPath,
      },
    });
  } catch (error) {
    console.error("PROFILE PIC UPDATE ERROR:", error);
    return NextResponse.json(
      { error: "Failed to update profile picture" },
      { status: 500 }
    );
  }
}