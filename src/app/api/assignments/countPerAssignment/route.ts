//deleted getUserCountsPerAssignment

import { NextRequest, NextResponse } from "next/server";
import { getUserCountsPerAssignmentByInstructor } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

/**
 * GET /api/assignments/countPerAssignment
 *
 * Returns a list of { assignmentId, assignmentName, userCount } tuples for
 * the currently logged-in instructor. Used by AssignmentsUsersChart on the
 * dashboard to show how many unique students worked on each assignment.
 *
 * The underlying query joins assignments → sessions and counts DISTINCT
 * student_ids, filtered by assignments.instructor_id. Without that filter,
 * an instructor could see student counts from other instructors' classes.
 */
export async function GET(req: NextRequest) {
  try {
    // Authenticate and get the current instructor.
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const instructor = authResult;

    // Query is scoped to assignments owned by this instructor only.
    const data = getUserCountsPerAssignmentByInstructor(
      instructor.instructorId,
    );
    return NextResponse.json(data);
  } catch (error) {
    console.error("ACTUAL ERROR:", error);
    return NextResponse.json(
      { error: "failed to fetch assignment user counts" },
      { status: 500 },
    );
  }
}
