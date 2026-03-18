import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import db from "@/lib/db";
import { verifyAuth } from "@/lib/auth";

export async function PUT(req: NextRequest) {
  try {
    const auth = await verifyAuth(req);

    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const newPassword = String(body?.newPassword || "").trim();

    if (!newPassword) {
      return NextResponse.json(
        { error: "Password is required" },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    db.prepare(
      `
      UPDATE instructors
      SET password_hash = ?
      WHERE id = ?
      `
    ).run(passwordHash, auth.instructorId);

    return NextResponse.json({
      success: true,
      message: "Password updated successfully",
    });
  } catch (error) {
    console.error("PASSWORD UPDATE ERROR:", error);
    return NextResponse.json(
      { error: "Failed to update password" },
      { status: 500 }
    );
  }
}