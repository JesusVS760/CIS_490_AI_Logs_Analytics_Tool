import { NextResponse } from "next/server";
import { getAllSessions } from "@/lib/db";

export async function GET() {
  try {
    const sessions = await getAllSessions();
    console.log("Sessions:", sessions);

    return NextResponse.json(sessions);
  } catch (error) {
    console.error("ACTUAL ERROR:", error);
    return NextResponse.json(
      { error: "Failed to fetch sessions" },
      { status: 500 },
    );
  }
}
