import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { promises as fs } from "fs";
import db from "@/lib/db";
import { verifyAuth, deleteSessionToken } from "@/lib/auth";

export async function DELETE(req: NextRequest) {
  try {
    const auth = await verifyAuth(req);

    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (
      auth.profilePic &&
      auth.profilePic.startsWith("/uploads/profile-pics/")
    ) {
      const oldFilePath = path.join(process.cwd(), "public", auth.profilePic);
      try {
        await fs.unlink(oldFilePath);
      } catch {}
    }

    const token = req.cookies.get("session_token")?.value;
    if (token) deleteSessionToken(token);

    db.prepare(
      `
      DELETE FROM instructors
      WHERE id = ?
      `
    ).run(auth.instructorId);

    const response = NextResponse.json({
      success: true,
      message: "Account deleted successfully",
    });

    response.cookies.set("session_token", "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });

    return response;
  } catch (error) {
    console.error("DELETE ACCOUNT ERROR:", error);
    return NextResponse.json(
      { error: "Failed to delete account" },
      { status: 500 }
    );
  }
}