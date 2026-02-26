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

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No File Provided" }, { status: 400 });
    }

    const raw = await file.text();
    const parsed = parseTranscript(raw);

    //store in db
    const courseId = upsertCourse(parsed.courseName);
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
        endedAt
      );

      for (const msg of session.messages) {
        const messageId = createMessage(
          sessionId,
          msg.role,
          msg.content,
          msg.timestamp
        );

        // store code snapshots
        for (const file of msg.codeFiles) {
          createCodeSnapshot(
            messageId,
            file.filename,
            file.content,
            file.isEmpty
          );
        }

        // store terminal snapshot
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
    console.error("Upload error", error);
    return NextResponse.json(
      { error: "Failed to parse transcript" },
      { status: 500 }
    );
  }
}
