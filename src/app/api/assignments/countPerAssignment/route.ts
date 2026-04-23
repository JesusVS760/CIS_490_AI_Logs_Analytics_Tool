import { NextRequest, NextResponse } from "next/server";
import { getUserCountsPerAssignmentByInstructor } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const instructor = authResult;

    const data = await getUserCountsPerAssignmentByInstructor(
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
