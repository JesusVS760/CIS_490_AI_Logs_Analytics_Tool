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

  if (
    file.type === "application/pdf" ||
    file.name.toLowerCase().endsWith(".pdf")
  ) {
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

function isValidDateString(value?: string | null): boolean {
  if (!value) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
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

function getLatestSessionDate(
  sessions: Array<{
    messages: Array<{ timestamp?: string | null }>;
  }>
): string {
  const timestamps = sessions
    .flatMap((session) => session.messages.map((msg) => msg.timestamp))
    .filter((ts): ts is string => Boolean(ts))
    .map((ts) => new Date(ts))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => b.getTime() - a.getTime());

  if (timestamps.length === 0) return "";
  return timestamps[0].toISOString().slice(0, 10);
}

function getEarliestValidDate(values: Array<string | null | undefined>): string {
  const dates = values
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());

  if (dates.length === 0) return "";
  return dates[0].toISOString().slice(0, 10);
}

function getLatestValidDate(values: Array<string | null | undefined>): string {
  const dates = values
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => b.getTime() - a.getTime());

  if (dates.length === 0) return "";
  return dates[0].toISOString().slice(0, 10);
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

function getUploadedFiles(formData: FormData): File[] {
  const multiFiles = formData
    .getAll("files")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  if (multiFiles.length > 0) return multiFiles;

  const singleFile = formData.get("file");
  if (singleFile instanceof File && singleFile.size > 0) {
    return [singleFile];
  }

  return [];
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const files = getUploadedFiles(formData);
    const uploadedAssignmentName = String(
      formData.get("assignmentName") ?? ""
    ).trim();
    const uploadedStartDate = String(formData.get("startDate") ?? "").trim();
    const endDate = String(formData.get("endDate") ?? "").trim();

    const FIXED_COURSE_NAME = "CS 101";

    if (files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    if (!endDate) {
      return NextResponse.json(
        { error: "Assignment end date is required" },
        { status: 400 }
      );
    }

    if (!isValidDateString(endDate)) {
      return NextResponse.json(
        { error: "Please enter a valid assignment end date." },
        { status: 400 }
      );
    }

    if (uploadedStartDate && !isValidDateString(uploadedStartDate)) {
      return NextResponse.json(
        { error: "Please enter a valid assignment start date." },
        { status: 400 }
      );
    }

    const parsedFiles: Array<{
      fileName: string;
      raw: string;
      parsed: ReturnType<typeof parseTranscript>;
      logDerivedStartDate: string;
      logDerivedEndDate: string;
      logDerivedAssignmentName: string;
    }> = [];

    for (const file of files) {
      const raw = await extractText(file);
      const parsed = parseTranscript(raw);

      if (parsed.sessions.length === 0) {
        return NextResponse.json(
          {
            error: `Could not parse transcript in "${file.name}" — check the file format`,
          },
          { status: 422 }
        );
      }

      const logDerivedStartDate =
        getEarliestSessionDate(parsed.sessions) || toDateOnly(parsed.generatedAt);

      const logDerivedEndDate =
        getLatestSessionDate(parsed.sessions) || toDateOnly(parsed.generatedAt);

      const logDerivedAssignmentName = getAssignmentNameFromLogs(raw).trim();

      parsedFiles.push({
        fileName: file.name,
        raw,
        parsed,
        logDerivedStartDate,
        logDerivedEndDate,
        logDerivedAssignmentName,
      });
    }

    const allSessions = parsedFiles.flatMap((file) => file.parsed.sessions);

    const combinedLogDerivedStartDate =
      getEarliestSessionDate(allSessions) ||
      getEarliestValidDate(
        parsedFiles.map((file) => toDateOnly(file.parsed.generatedAt))
      );

    const combinedLogDerivedEndDate =
      getLatestSessionDate(allSessions) ||
      getLatestValidDate(
        parsedFiles.map((file) => toDateOnly(file.parsed.generatedAt))
      );

    if (!combinedLogDerivedEndDate) {
      return NextResponse.json(
        {
          error:
            "Could not determine the correct assignment end date from the uploaded logs.",
        },
        { status: 400 }
      );
    }

    const normalizedExpectedEndDate = toDateOnly(combinedLogDerivedEndDate);
    const normalizedEnteredEndDate = toDateOnly(endDate);

    if (normalizedEnteredEndDate !== normalizedExpectedEndDate) {
      return NextResponse.json(
        {
          error: `Incorrect assignment end date. Please enter ${normalizedExpectedEndDate}.`,
          expectedEndDate: normalizedExpectedEndDate,
        },
        { status: 400 }
      );
    }

    const derivedStartDate = uploadedStartDate || combinedLogDerivedStartDate;

    if (!derivedStartDate) {
      return NextResponse.json(
        {
          error:
            "Could not determine an assignment start date from the uploaded logs. Please enter a start date manually.",
        },
        { status: 400 }
      );
    }

    if (!isValidDateString(derivedStartDate)) {
      return NextResponse.json(
        {
          error: uploadedStartDate
            ? "Please enter a valid assignment start date."
            : "The uploaded logs contain an invalid start date. Please enter a start date manually.",
        },
        { status: 400 }
      );
    }

    const normalizedStartDate = toDateOnly(derivedStartDate);

    if (!normalizedStartDate) {
      return NextResponse.json(
        {
          error: uploadedStartDate
            ? "Please enter a valid assignment start date."
            : "The uploaded logs contain an invalid start date. Please enter a start date manually.",
        },
        { status: 400 }
      );
    }

    if (new Date(normalizedStartDate) > new Date(normalizedEnteredEndDate)) {
      return NextResponse.json(
        {
          error: uploadedStartDate
            ? "End date must be after the start date."
            : `The end date is earlier than the start date found in the uploaded logs (${normalizedStartDate}). Please choose a later end date or enter a start date manually.`,
        },
        { status: 400 }
      );
    }

    const firstExtractedAssignmentName = parsedFiles
      .map((file) => file.logDerivedAssignmentName)
      .find(Boolean);

    const derivedAssignmentName =
      uploadedAssignmentName ||
      firstExtractedAssignmentName ||
      (parsedFiles.length === 1
        ? getFileBaseName(parsedFiles[0].fileName)
        : "Uploaded Assignment");

    const courseId = upsertCourse(
      FIXED_COURSE_NAME,
      parsedFiles[0]?.parsed.generatedAt ?? null
    );

    const assignmentId = upsertAssignment(
      courseId,
      derivedAssignmentName,
      undefined,
      normalizedStartDate,
      normalizedEnteredEndDate
    );

    for (const parsedFile of parsedFiles) {
      for (const session of parsedFile.parsed.sessions) {
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
    }

    return NextResponse.json({
      success: true,
      course: FIXED_COURSE_NAME,
      assignmentName: derivedAssignmentName,
      startDate: normalizedStartDate,
      endDate: normalizedEnteredEndDate,
      expectedEndDate: normalizedExpectedEndDate,
      filesProcessed: parsedFiles.length,
      sessions: allSessions.length,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to process transcript" },
      { status: 500 }
    );
  }
}