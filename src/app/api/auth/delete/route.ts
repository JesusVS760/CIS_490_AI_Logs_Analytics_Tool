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

    // Clean up profile picture file if it exists
    if (
      auth.profilePic &&
      auth.profilePic.startsWith("/uploads/profile-pics/")
    ) {
      const oldFilePath = path.join(process.cwd(), "public", auth.profilePic);
      try {
        await fs.unlink(oldFilePath);
      } catch {}
    }

    // Clear the session token
    const token = req.cookies.get("session_token")?.value;
    if (token) deleteSessionToken(token);

    // Wipe all uploaded data from the database.
    // Order: leaf tables → parent tables (respects foreign keys).
    db.prepare("DELETE FROM terminal_snapshots").run();
    db.prepare("DELETE FROM code_snapshots").run();
    db.prepare("DELETE FROM messages").run();
    db.prepare("DELETE FROM sessions").run();
    db.prepare("DELETE FROM students").run();
    db.prepare("DELETE FROM assignments").run();
    db.prepare("DELETE FROM courses").run();

    // Delete auth sessions for this instructor
    db.prepare("DELETE FROM instructor_sessions WHERE instructor_id = ?").run(
      auth.instructorId
    );

    // Delete the instructor account
    db.prepare("DELETE FROM instructors WHERE id = ?").run(auth.instructorId);

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

//need to push to github to main test 
// 