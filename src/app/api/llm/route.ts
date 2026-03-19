import { systemPrompt } from "@/lib/openai";
import llmService from "@/services/llm-service";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // const analytics = await llmService.generateAnalytics(JSON.stringify(body));

    // return NextResponse.json(analytics);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch LLM" }, { status: 500 });
  }
}
