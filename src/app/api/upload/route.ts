import {
  createCodeSnapshot,
  createMessage,
  createSession,
  createTerminalSnapshot,
  upsertAssignment,
  upsertCourse,
  upsertStudent,
} from "@/lib/db";
import { parseTranscript } from "@/lib/parseTranscript";
import { NextRequest, NextResponse } from "next/server";
import { extractText as extractPdfText } from "unpdf";

async function extractText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();

  if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
    const { text } = await extractPdfText(new Uint8Array(buffer), {
      mergePages: true,
    });
    return text;
  }

  // Plain text (.txt) — decode directly
  return Buffer.from(buffer).toString("utf-8");
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const raw = await extractText(file);

    const parsed = parseTranscript(raw);
    console.log("Parsed transcript:", {
      courseName: parsed.courseName,
      generatedAt: parsed.generatedAt,
      sessions: parsed.sessions.length,
    });

    if (!parsed.courseName && parsed.sessions.length === 0) {
      return NextResponse.json(
        { error: "Could not parse transcript — check the file format" },
        { status: 422 },
      );
    }

    // Store in DB
    const courseId = upsertCourse(parsed.courseName, parsed.generatedAt);

    for (const session of parsed.sessions) {
      const studentId = upsertStudent(session.studentEmail);
      const assignmentId = upsertAssignment(courseId, session.assignmentName);

      const startedAt = session.messages[0]?.timestamp ?? null;
      const endedAt =
        session.messages[session.messages.length - 1]?.timestamp ?? null;

      const sessionId = createSession(
        studentId,
        assignmentId,
        startedAt,
        endedAt,
      );

      for (const msg of session.messages) {
        const messageId = createMessage(
          sessionId,
          msg.role,
          msg.content,
          msg.timestamp,
        );

        for (const codeFile of msg.codeFiles) {
          createCodeSnapshot(
            messageId,
            codeFile.filename,
            codeFile.content,
            codeFile.isEmpty,
          );
        }

        if (msg.terminalContent) {
          createTerminalSnapshot(messageId, msg.terminalContent);
        }
      }
    }

    return NextResponse.json({
      success: true,
      course: parsed.courseName,
      sessions: parsed.sessions.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to process transcript" },
      { status: 500 },
    );
  }
}
