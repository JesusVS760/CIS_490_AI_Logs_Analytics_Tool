import llmService from "@/services/llm-service";
import { NextRequest, NextResponse } from "next/server";

const systemPrompt = ``;

export async function POST(req: NextRequest) {
  try {
    console.log("chat duration req:", req);
    const body = await req.json();
    const chatDurationAnalytics = llmService.generateAnalytics(
      JSON.stringify(body),
      systemPrompt
    );

    return NextResponse.json(chatDurationAnalytics);
  } catch (error) {
    return NextResponse.json(
      { error: "failed to fetch chat duration llm" },
      { status: 500 }
    );
  }
}
