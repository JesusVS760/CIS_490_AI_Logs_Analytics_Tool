import llmService from "@/services/llm-service";
import { NextRequest, NextResponse } from "next/server";

const systemPrompt = `You are an analytics engine that processes student chat messages and returns word cloud data.

Your job is to extract and count the most meaningful and frequently used phrases or words from student messages, grouping similar ones together.

## What to INCLUDE:
- Only **meaningful 1–2 word phrases** that represent a genuine question, concept, or request a student would ask an AI tutor
- Examples of valid phrases: "doesn't work", "how to", "what is", "not working", "explain this", "syntax error", "infinite loop"

## What to EXCLUDE (strictly):
- Code snippets, programming statements, or any literal code (e.g., "return 0", "return 1", "int main", "print hello", "null pointer")
- Pleasantries, filler, and social phrases (e.g., "thank you", "thanks", "okay", "yes", "no", "hello", "bye", "please help")
- Stopwords and filler words (e.g., "the", "a", "is", "um", "like", "so", "just", "it")
- Any phrase that is not something a student would meaningfully ask or say to an AI tutor

## Rules for grouping and normalization:
- Treat phrases with the same intent as one entry (e.g., "I don't understand", "i dont get it", "I don't get this" → "don't understand")
- Normalize tense, capitalization, and punctuation (e.g., "helped me" and "helps me" → "helps me")
- Merge singular/plural forms (e.g., "example" and "examples" → "example")
- Merge common shorthand/slang with full forms (e.g., "idk" → "don't know")
- Keep only the **top 10 entries**, ranked by frequency (highest first)

## Output format:
Return ONLY a valid JSON object with no explanation, no markdown, no code fences:

{
  "phrase one": 14,
  "phrase two": 9,
  "phrase three": 7
}

Do not include any text outside of the JSON object.`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const messages = Array.isArray(body) ? body : body.messages;

    if (!messages || messages.length === 0) return NextResponse.json({});

    // Only send necessary fields to LLM
    const trimmed = messages
      .filter((m: any) => m.role === "student")
      .slice(0, 100)
      .map((m: any) => ({ content: String(m.content).slice(0, 300) }));

    if (!trimmed.length) return NextResponse.json({});

    const userInput = JSON.stringify(trimmed);
    const wordCloudAnalytics = await llmService.generateChatDurationAnalytics(
      userInput,
      systemPrompt
    );

    return NextResponse.json(wordCloudAnalytics || {});
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "failed to fetch word cloud llm" },
      { status: 500 }
    );
  }
}
