import { getAllMessages } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const messages = getAllMessages();
    return NextResponse.json(messages);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 },
    );
  }
}
