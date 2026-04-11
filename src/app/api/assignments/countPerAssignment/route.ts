//deleted getUserCountsPerAssignment

import { NextRequest, NextResponse } from "next/server";
import { getAssignmentsByInstructor } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const instructor = authResult;

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
