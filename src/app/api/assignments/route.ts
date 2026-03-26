import { getAllAssignments } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const assignments = getAllAssignments();
    return NextResponse.json(assignments);
  } catch (error) {
    return NextResponse.json(
      { error: "failed to fetch assignments" },
      { status: 500 }
    );
  }
}
