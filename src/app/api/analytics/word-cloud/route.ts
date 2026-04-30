import llmService from "@/services/llm-service";
import { NextRequest, NextResponse } from "next/server";

const systemPrompt = `You are an analytics engine that processes student chat messages from a C++ programming course and returns word cloud data.

Your ONLY job is to identify and count phrases that represent a student's **learning intent or struggle**.

## Canonical phrase list — use these as your foundation:
You must normalize what students say into the closest matching phrase from this list whenever possible.
Only create a new phrase if nothing in this list fits.

Understanding & confusion:
"i'm confused", "i'm lost", "i don't understand", "don't get it", "makes no sense",
"not sure how", "not sure why", "can you explain", "can you clarify", "what does this mean",
"how does this work", "why does this happen", "help me understand", "walk me through",
"step by step", "break it down"

Stuck / need help:
"i'm stuck", "stuck on this", "need help", "can you help me", "where do i start",
"how do i start", "don't know how", "i have no idea", "what should i do",
"how do i fix", "how do i solve", "help me figure out"

Validation / checking:
"check my code", "check my work", "is this correct", "is this right", "did i do this right",
"am i on the right track", "review my code", "is my logic correct", "does this look right",
"what am i doing wrong", "why is my output wrong", "not getting the right output"

Code requests:
"fix my code", "fix this error", "give me an example", "show an example",
"code example", "can you debug", "help me debug"

Errors:
"getting an error", "error in my code", "why is my code not working",
"why won't my code run", "segmentation fault", "infinite loop", "memory leak",
"null pointer", "why won't it compile", "why is it crashing", "not compiling"

Comparison / choice:
"what is the difference between", "when should i use", "which one should i use",
"which is better", "why would i use"

Academic context:
"for my homework", "for my assignment", "for my exam", "for my project",
"for my lab", "practice problem", "exam question", "homework question", "working on project"

Concept understanding:
"what is a pointer", "what is a reference", "what is a class", "what is a function",
"what is recursion", "what is a constructor", "what is inheritance", "what is polymorphism",
"what is a vector", "what is a linked list", "what is dynamic memory",
"how does recursion work", "how does inheritance work", "how does a pointer work"

Logic & approach:
"how do i approach", "what is the logic", "explain the algorithm", "how do i implement",
"best way to implement", "time complexity", "space complexity", "optimize my code",
"better approach", "how to implement"

Memory & pointers:
"pass by value", "pass by reference", "dynamic memory", "memory allocation",
"dangling pointer", "how to use pointers", "pointer arithmetic"

OOP:
"how to use inheritance", "how to use templates", "virtual function", "abstract class",
"overload a function", "override a method", "how to create a class", "how to use constructors"

STL / I/O:
"how to use vectors", "how to use getline", "file input output", "how to read a file",
"how to write to file", "exception handling", "try catch block", "how to use cin", "how to use cout"

## Normalization rules — map student language to the canonical list:
- "i dont get this", "i don't get it", "i do not understand" → "i don't understand"
- "can you walk me through", "walk me through this" → "walk me through"
- "check my work", "can you double check", "review my code", "does this look right" → "check my work"
- "how would you start", "where do i begin", "how do i start this" → "how do i start"
- "how to run", "how to add", "can you show", "how would you add" → DISCARD (incomplete, no object)
- "what is this assignment", "what is this about" → DISCARD (too contextual, not a learning intent)
- "can you show me an example" → "show an example"
- "getting an error", "get an error", "i got an error", "there's an error" → "getting an error"
- "how to implement this", "how would i implement" → "how to implement"

## CRITICAL — Incomplete phrase rule:
A phrase must express complete learning intent on its own. Apply this golden rule:
**If removing the object leaves the phrase meaningless, discard it.**

- BAD: "how to add" — add what? Discard
- BAD: "how to run" — run what? Discard  
- BAD: "how to use" — use what? Discard
- BAD: "can you show" — show what? Discard
- BAD: "how would you add" — add what? Discard
- BAD: "what is this" — this what? Discard
- BAD: "what is this assignment" — too contextual, discard
- BAD: "for my project" — alone means nothing, only keep if maps to "working on project"
- GOOD: "how to implement" — clear intent, keep
- GOOD: "check my work" — clear intent, keep
- GOOD: "getting an error" — clear intent, keep
- GOOD: "help me understand" — clear intent, keep

## Hard exclusions — NEVER include:
- Literal code, variable names, function names, or syntax
- Generic words with no learning intent ("includes", "discounts", "start", "add", "run")
- Pleasantries or filler ("thank you", "okay", "please", "yes", "hello")
- Phrases longer than 4 words
- Incomplete phrases that require context to have meaning
- Anything not in or closely mappable to the canonical list above

## Output:
- Return the top 10 phrases ranked by frequency
- Return ONLY a valid JSON object, no markdown, no explanation, no code fences:
{
  "check my work": 9,
  "help me understand": 7,
  "getting an error": 5
}`;

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
      systemPrompt,
    );

    return NextResponse.json(wordCloudAnalytics || {});
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "failed to fetch word cloud llm" },
      { status: 500 },
    );
  }
}
