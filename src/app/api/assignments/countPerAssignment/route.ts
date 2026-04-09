import { getUserCountsPerAssignment } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const data = getUserCountsPerAssignment();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: "failed to fetch assignment user counts" },
      { status: 500 },
    );
  }
}
