//Deleted getAllSessions

import { NextRequest, NextResponse } from "next/server";
import { getSessionsByInstructor } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

/**
 * GET /api/sessions
 *
 * Returns all upload sessions belonging to the currently logged-in instructor.
 *
 * IMPORTANT: This route must ALWAYS filter by instructor_id. Previously it
 * called an unfiltered getAllSessions() which returned every instructor's
 * data to every user — meaning Account A could see Account B's uploaded logs.
 * If you're adding a new sessions endpoint, use getSessionsByInstructor and
 * never query the sessions table without a WHERE instructor_id = ? clause.
 */
export async function GET(req: NextRequest) {
  try {
    // Step 1: Authenticate the request.
    // requireAuth reads the session_token cookie, looks it up in the
    // instructor_sessions table, and returns either the instructor payload
    // or a 401 NextResponse. If it's the 401, we forward it to the client.
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const instructor = authResult;

    // Step 2: Fetch only the sessions owned by this instructor.
    // The ByInstructor suffix is a reminder that this query is scoped —
    // never replace it with an unfiltered "getAll" variant.
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