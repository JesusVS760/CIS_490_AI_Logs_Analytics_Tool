import { NextResponse } from "next/server";

export async function GET() {
  try {
  } catch (error) {
    NextResponse.json({ error: "Failed to fetch LLM" }, { status: 500 });
  }
}
