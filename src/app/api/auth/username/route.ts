import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { verifyAuth } from "@/lib/auth";

export async function PUT(req: NextRequest) {
  try {
    const auth = await verifyAuth(req);

    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const name = String(body?.name || "").trim();

    if (!name) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    db.prepare(
      `
      UPDATE instructors
      SET name = ?
      WHERE id = ?
      `
    ).run(name, auth.instructorId);

    return NextResponse.json({
      success: true,
      user: {
        id: auth.instructorId,
        email: auth.email,
        name,
        profilePic: auth.profilePic,
        darkMode: auth.darkMode,
      },
    });
  } catch (error) {
    console.error("USERNAME UPDATE ERROR:", error);
    return NextResponse.json(
      { error: "Failed to update username" },
      { status: 500 }
    );
  }
}