import { NextRequest, NextResponse } from "next/server";
import { getAssignmentsByInstructor } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

/**
 * GET /api/assignments
 *
 * Returns every assignment created by the currently logged-in instructor.
 * Assignments are created implicitly during log uploads (see /api/upload) —
 * this route just lists them back for the dashboard.
 *
 * Assignments are tagged with instructor_id at creation time (upsertAssignment)
 * so they can be filtered here. Two different instructors can both have an
 * assignment called "Homework 1" — they live in separate rows.
 */
export async function GET(req: NextRequest) {
  try {
    // Resolve the instructor from their session cookie, or reject with 401.
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const instructor = authResult;

    // Scoped fetch — only this instructor's assignments.
    const assignments = getAssignmentsByInstructor(instructor.instructorId);
    return NextResponse.json(assignments);
  } catch (error) {
    console.error("ACTUAL ERROR:", error);
    return NextResponse.json(
      { error: "failed to fetch assignments" },
      { status: 500 },
    );
  }
}