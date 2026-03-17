import llmService from "@/services/llm-service";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();
    const analytics = await llmService.generateAnalytics(text);

    return NextResponse.json(analytics);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch LLM" }, { status: 500 });
  }
}
