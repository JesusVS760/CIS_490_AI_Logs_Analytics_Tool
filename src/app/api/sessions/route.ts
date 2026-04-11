//Deleted getAllSessions

import { NextRequest, NextResponse } from "next/server";
import { getSessionsByInstructor } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const instructor = authResult;

    const sessions = getSessionsByInstructor(instructor.instructorId);
    return NextResponse.json(sessions);
  } catch (error) {
    console.error("ACTUAL ERROR:", error);
    return NextResponse.json(
      { error: "Failed to fetch sessions" },
      { status: 500 },
    );
  }
}
