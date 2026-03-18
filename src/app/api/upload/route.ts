//the allowment to choose date of assignment is best ulitized in this section(s) as well as the API 
//and database\
//Code Changed to allow and to recieve file, assignmentName, 
//startDate and endDate from the upload form and API.


import {
  anonymizeId,
  buildSessionImportKey,
  createCodeSnapshot,
  createMessage,
  createOrGetSession,
  createTerminalSnapshot,
  runInTransaction,
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

function parseTranscriptTimestamp(value?: string | null): Date | null {
  if (!value) return null;

  const match = value.match(
    /^(\d{2})\/(\d{2})\/(\d{4}),\s*(\d{2}):(\d{2}):(\d{2})\s*([AP]M)$/
  );

  if (!match) return null;

  const [, mm, dd, yyyy, hh, min, ss, ampm] = match;

  let hours = Number(hh);
  const month = Number(mm) - 1;
  const day = Number(dd);
  const year = Number(yyyy);
  const minutes = Number(min);
  const seconds = Number(ss);

  if (ampm === "AM" && hours === 12) hours = 0;
  if (ampm === "PM" && hours !== 12) hours += 12;

  const date = new Date(year, month, day, hours, minutes, seconds);

  return Number.isNaN(date.getTime()) ? null : date;
}

function parseAnyDate(value?: string | null): Date | null {
  if (!value) return null;

  const transcriptDate = parseTranscriptTimestamp(value);
  if (transcriptDate) return transcriptDate;

  const nativeDate = new Date(value);
  return Number.isNaN(nativeDate.getTime()) ? null : nativeDate;
}

function toDateOnly(value?: string | null): string {
  const date = parseAnyDate(value);
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}

function toIsoTimestamp(value?: string | null): string | null {
  const date = parseAnyDate(value);
  if (!date) return null;
  return date.toISOString();
}

function isValidDateString(value?: string | null): boolean {
  return Boolean(parseAnyDate(value));
}

function getEarliestValidDate(values: Array<string | null | undefined>): string {
  const dates = values
    .map((value) => toDateOnly(value))
    .filter(Boolean)
    .sort();

  return dates[0] ?? "";
}

function getLatestValidDate(values: Array<string | null | undefined>): string {
  const dates = values
    .map((value) => toDateOnly(value))
    .filter(Boolean)
    .sort();

  return dates[dates.length - 1] ?? "";
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

function getSortedUniqueLogDates(
  sessions: Array<{
    messages: Array<{ timestamp?: string | null }>;
  }>
): string[] {
  const uniqueDates = new Set<string>();

  for (const session of sessions) {
    for (const msg of session.messages) {
      const dateOnly = toDateOnly(msg.timestamp);
      if (dateOnly) {
        uniqueDates.add(dateOnly);
      }
    }
  }

  return Array.from(uniqueDates).sort();
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
      logDates: string[];
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

      const extractedLogDates = getSortedUniqueLogDates(parsed.sessions);
      const fallbackGeneratedDate = toDateOnly(parsed.generatedAt);

      const logDates =
        extractedLogDates.length > 0
          ? extractedLogDates
          : fallbackGeneratedDate
            ? [fallbackGeneratedDate]
            : [];

      const logDerivedStartDate = logDates[0] ?? "";
      const logDerivedEndDate = logDates[logDates.length - 1] ?? "";
      const logDerivedAssignmentName = getAssignmentNameFromLogs(raw).trim();

      parsedFiles.push({
        fileName: file.name,
        raw,
        parsed,
        logDates,
        logDerivedStartDate,
        logDerivedEndDate,
        logDerivedAssignmentName,
      });
    }

    const combinedLogDates = Array.from(
      new Set(parsedFiles.flatMap((file) => file.logDates).filter(Boolean))
    ).sort();

    const combinedLogDerivedStartDate =
      combinedLogDates[0] ??
      getEarliestValidDate(
        parsedFiles.map((file) => toDateOnly(file.parsed.generatedAt))
      );

    const combinedLogDerivedEndDate =
      combinedLogDates[combinedLogDates.length - 1] ??
      getLatestValidDate(
        parsedFiles.map((file) => toDateOnly(file.parsed.generatedAt))
      );

    if (combinedLogDates.length === 0 && !combinedLogDerivedEndDate) {
      return NextResponse.json(
        {
          error:
            "Could not determine any valid log dates from the uploaded logs.",
        },
        { status: 400 }
      );
    }

    const normalizedEnteredEndDate = toDateOnly(endDate);
    const normalizedExpectedEndDate = combinedLogDerivedEndDate;

    const isAllowedEndDate =
      combinedLogDates.length > 0
        ? combinedLogDates.includes(normalizedEnteredEndDate)
        : normalizedEnteredEndDate === normalizedExpectedEndDate;

    if (!isAllowedEndDate) {
      return NextResponse.json(
        {
          error:
            combinedLogDates.length > 1
              ? `Incorrect assignment end date. Please enter one of: ${combinedLogDates.join(", ")}.`
              : `Incorrect assignment end date. Please enter ${normalizedExpectedEndDate}.`,
          expectedEndDate: normalizedExpectedEndDate,
          expectedEndDates:
            combinedLogDates.length > 0
              ? combinedLogDates
              : normalizedExpectedEndDate
                ? [normalizedExpectedEndDate]
                : [],
          logDates: combinedLogDates,
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

    const firstParsedAssignmentName = parsedFiles
      .flatMap((file) =>
        file.parsed.sessions.map((session) => session.assignmentName?.trim())
      )
      .find(Boolean);

    const firstExtractedAssignmentName = parsedFiles
      .map((file) => file.logDerivedAssignmentName)
      .find(Boolean);

    const derivedAssignmentName =
      uploadedAssignmentName ||
      firstParsedAssignmentName ||
      firstExtractedAssignmentName ||
      (parsedFiles.length === 1
        ? getFileBaseName(parsedFiles[0].fileName)
        : "Uploaded Assignment");

    let insertedSessions = 0;
    let skippedDuplicateSessions = 0;
    let insertedMessages = 0;

    runInTransaction(() => {
      const courseId = upsertCourse(
        FIXED_COURSE_NAME,
        parsedFiles[0]?.parsed.generatedAt ?? undefined
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
          const rawEmail = session.studentEmail?.trim();

          if (!rawEmail) {
            continue;
          }

          const studentId = upsertStudent(rawEmail);

          const normalizedMessageTimestamps = session.messages
            .map((msg) => toIsoTimestamp(msg.timestamp))
            .filter((value): value is string => Boolean(value));

          const startedAt = normalizedMessageTimestamps[0] ?? null;
          const endedAt =
            normalizedMessageTimestamps[normalizedMessageTimestamps.length - 1] ??
            null;

          const firstMessage = session.messages[0]?.content ?? "";
          const lastMessage =
            session.messages[session.messages.length - 1]?.content ?? "";

          const importKey = buildSessionImportKey({
            studentAnonymousId: anonymizeId(rawEmail),
            assignmentId,
            sourceFile: parsedFile.fileName,
            startedAt,
            endedAt,
            firstMessage,
            lastMessage,
          });

          const sessionResult = createOrGetSession({
            studentId,
            assignmentId,
            importKey,
            sourceFile: parsedFile.fileName,
            startedAt,
            endedAt,
          });

          if (!sessionResult.inserted) {
            skippedDuplicateSessions += 1;
            continue;
          }

          insertedSessions += 1;

          for (const msg of session.messages) {
            const normalizedTimestamp = toIsoTimestamp(msg.timestamp);

            const messageId = createMessage(
              sessionResult.id,
              msg.role,
              msg.content,
              normalizedTimestamp ?? undefined
            );

            insertedMessages += 1;

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
    });

    return NextResponse.json({
      success: true,
      course: FIXED_COURSE_NAME,
      assignmentName: derivedAssignmentName,
      startDate: normalizedStartDate,
      endDate: normalizedEnteredEndDate,
      expectedEndDate: normalizedExpectedEndDate,
      expectedEndDates:
        combinedLogDates.length > 0
          ? combinedLogDates
          : normalizedExpectedEndDate
            ? [normalizedExpectedEndDate]
            : [],
      logDates: combinedLogDates,
      filesProcessed: parsedFiles.length,
      sessionsInserted: insertedSessions,
      duplicateSessionsSkipped: skippedDuplicateSessions,
      messagesInserted: insertedMessages,
    });
  } catch (error) {
    console.error("Upload processing failed:", error);

    return NextResponse.json(
      { error: "Failed to process transcript" },
      { status: 500 }
    );
  }
}