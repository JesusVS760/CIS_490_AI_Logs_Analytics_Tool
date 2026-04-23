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
    const darkMode = Boolean(body?.darkMode);

    await db.execute({
      sql: "UPDATE instructors SET dark_mode = ? WHERE id = ?",
      args: [darkMode ? 1 : 0, auth.instructorId],
    });

    return NextResponse.json({
      success: true,
      darkMode,
      user: {
        id: auth.instructorId,
        email: auth.email,
        name: auth.name,
        darkMode,
        profilePic: auth.profilePic,
      },
    });
  } catch (error) {
    console.error("THEME UPDATE ERROR:", error);
    return NextResponse.json(
      { error: "Failed to update theme" },
      { status: 500 },
    );
  }
}
