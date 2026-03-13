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

function toDateOnly(value?: string | null): string {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toISOString().slice(0, 10);
}

function getEarliestSessionDate(
  sessions: Array<{
    messages: Array<{ timestamp?: string | null }>;
  }>
): string {
  const timestamps = sessions
    .flatMap((session) => session.messages.map((msg) => msg.timestamp))
    .filter((ts): ts is string => Boolean(ts))
    .map((ts) => new Date(ts))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());

  if (timestamps.length === 0) return "";
  return timestamps[0].toISOString().slice(0, 10);
}

function getAssignmentNameFromLogs(raw: string): string {
  const patterns = [
    /assignment\s*name\s*:\s*(.+)/i,
    /assignment\s*:\s*(.+)/i,
    /homework\s*:\s*(.+)/i,
    /project\s*:\s*(.+)/i,
    /lab\s*:\s*(.+)/i,
  ];

  for (const pattern of patterns) {
    const match = raw.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return "";
}

function getFileBaseName(filename: string): string {
  return filename.replace(/\.[^/.]+$/, "").trim();
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const file = formData.get("file") as File | null;
    const uploadedAssignmentName = String(
      formData.get("assignmentName") ?? ""
    ).trim();
    const uploadedStartDate = String(formData.get("startDate") ?? "").trim();
    const endDate = String(formData.get("endDate") ?? "").trim();

    const FIXED_COURSE_NAME = "CS 101";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!endDate) {
      return NextResponse.json(
        { error: "Assignment end date is required" },
        { status: 400 }
      );
    }

    const raw = await extractText(file);
    const parsed = parseTranscript(raw);

    if (parsed.sessions.length === 0) {
      return NextResponse.json(
        { error: "Could not parse transcript — check the file format" },
        { status: 422 }
      );
    }

    const derivedStartDate =
      uploadedStartDate ||
      getEarliestSessionDate(parsed.sessions) ||
      toDateOnly(parsed.generatedAt);

    const derivedAssignmentName =
      uploadedAssignmentName ||
      getAssignmentNameFromLogs(raw) ||
      getFileBaseName(file.name) ||
      "Uploaded Assignment";

    if (!derivedStartDate) {
      return NextResponse.json(
        {
          error:
            "Could not determine assignment start date from the uploaded log. Please enter a start date manually.",
        },
        { status: 400 }
      );
    }

    if (new Date(derivedStartDate) > new Date(endDate)) {
      return NextResponse.json(
        { error: "End date must be after the start date" },
        { status: 400 }
      );
    }

    console.log("Parsed transcript:", {
      parsedCourseName: parsed.courseName,
      generatedAt: parsed.generatedAt,
      sessions: parsed.sessions.length,
      uploadedAssignmentName,
      finalAssignmentName: derivedAssignmentName,
      uploadedStartDate,
      finalStartDate: derivedStartDate,
      endDate,
    });

    const courseId = upsertCourse(FIXED_COURSE_NAME, parsed.generatedAt);

    const assignmentId = upsertAssignment(
      courseId,
      derivedAssignmentName,
      undefined,
      derivedStartDate,
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
      assignmentName: derivedAssignmentName,
      startDate: derivedStartDate,
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