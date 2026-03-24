import llmService from "@/services/llm-service";
import { NextRequest, NextResponse } from "next/server";

const systemPrompt = "";
export async function POST(req: NextRequest) {
  try {
    const messages = await req.json();
    const wordCloudAnalytics: Record<string, number> =
      llmService.generateAnalytics(messages, systemPrompt);

    return NextResponse.json(wordCloudAnalytics);
  } catch (error) {
    return NextResponse.json(
      { error: "failed to fetch chat duration llm" },
      { status: 500 }
    );
  }
}
