//the allowment to choose date of assignment is best ulitized in this section(s) as well as the API 
//and database\
//Code Changed to allow and to recieve file, assignmentName, 
//startDate and endDate from the upload form and API.


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

  return Buffer.from(buffer).toString("utf-8");
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const file = formData.get("file") as File | null;
    const assignmentName = String(formData.get("assignmentName") ?? "").trim();
    const startDate = String(formData.get("startDate") ?? "").trim();
    const endDate = String(formData.get("endDate") ?? "").trim();

    const FIXED_COURSE_NAME = "CS 101";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!assignmentName) {
      return NextResponse.json(
        { error: "Assignment name is required" },
        { status: 400 }
      );
    }

    if (!startDate) {
      return NextResponse.json(
        { error: "Assignment start date is required" },
        { status: 400 }
      );
    }

    if (!endDate) {
      return NextResponse.json(
        { error: "Assignment end date is required" },
        { status: 400 }
      );
    }

    if (new Date(startDate) > new Date(endDate)) {
      return NextResponse.json(
        { error: "End date must be after the start date" },
        { status: 400 }
      );
    }

    const raw = await extractText(file);
    const parsed = parseTranscript(raw);

    console.log("Parsed transcript:", {
      parsedCourseName: parsed.courseName,
      generatedAt: parsed.generatedAt,
      sessions: parsed.sessions.length,
      uploadedAssignmentName: assignmentName,
      startDate,
      endDate,
    });

    if (parsed.sessions.length === 0) {
      return NextResponse.json(
        { error: "Could not parse transcript — check the file format" },
        { status: 422 }
      );
    }

    const courseId = upsertCourse(FIXED_COURSE_NAME, parsed.generatedAt);

    const assignmentId = upsertAssignment(
      courseId,
      assignmentName,
      undefined,
      startDate,
      endDate
    );

    for (const session of parsed.sessions) {
      const studentId = upsertStudent(session.studentEmail);

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

        for (const codeFile of msg.codeFiles) {
          createCodeSnapshot(
            messageId,
            codeFile.filename,
            codeFile.content,
            codeFile.isEmpty
          );
        }

        if (msg.terminalContent) {
          createTerminalSnapshot(messageId, msg.terminalContent);
        }
      }
    }

    return NextResponse.json({
      success: true,
      course: FIXED_COURSE_NAME,
      assignmentName,
      startDate,
      endDate,
      sessions: parsed.sessions.length,
    });
  } catch (error) {
    console.error("Upload route failed:", error);

    return NextResponse.json(
      { error: "Failed to process transcript" },
      { status: 500 }
    );
  }
}