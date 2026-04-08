import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { verifyAuth } from "@/lib/auth";

export async function DELETE(req: NextRequest) {
  try {
    const auth = await verifyAuth(req);

    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    db.prepare(
      `
      DELETE FROM instructors
      WHERE id = ?
      `
    ).run(auth.instructorId);

    const response = NextResponse.json({ success: true });

    // Clear the session cookie so the client is logged out
    response.cookies.set("token", "", {
      httpOnly: true,
      expires: new Date(0),
      path: "/",
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