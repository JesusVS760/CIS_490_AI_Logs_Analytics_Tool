//the allowment to choose date of assignment is best ulitized in this section(s) as well as the API 
//and database\
//Code Changed to allow and to recieve file, assignmentName, 
//startDate and endDate from the upload form and API.
import db from "@/lib/db";
import { requireAuth } from "@/lib/auth";


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
import { createHash } from "crypto";

type ParsedTranscript = ReturnType<typeof parseTranscript>;

type FileConfig = {
  uploadId?: string;
  fileName?: string;
  endDate?: string;
};

type PreparedUpload = {
  uploadId: string;
  fileName: string;
  fileFingerprint: string;
  raw: string;
  parsed: ParsedTranscript;
  logDates: string[];
  logDerivedStartDate: string;
  logDerivedEndDate: string;
  logDerivedAssignmentName: string;
  resolvedAssignmentName: string;
  resolvedStartDate: string;
  resolvedEndDate: string;
};

type FileValidationError = {
  uploadId?: string;
  fileName?: string;
  expectedEndDate?: string;
  expectedEndDates?: string[];
  logDates?: string[];
  error?: string;
};

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

function buildStableFileFingerprint(raw: string): string {
  return createHash("sha256").update(raw).digest("hex").slice(0, 24);
}

function buildStableSourceFile(fileName: string, fingerprint: string): string {
  return `${fileName}__${fingerprint}`;
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

function parseDateStringAsLocalDate(value?: string | null): Date | null {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const transcriptDate = parseTranscriptTimestamp(trimmed);
  if (transcriptDate) return transcriptDate;

  const isoDateOnlyMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDateOnlyMatch) {
    const [, yyyy, mm, dd] = isoDateOnlyMatch;
    return new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  }

  const usDateOnlyMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (usDateOnlyMatch) {
    const [, mm, dd, yyyy] = usDateOnlyMatch;
    return new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  }

  const nativeDate = new Date(trimmed);
  return Number.isNaN(nativeDate.getTime()) ? null : nativeDate;
}

function toDateOnly(value?: string | null): string {
  if (!value) return "";

  const trimmed = value.trim();
  if (!trimmed) return "";

  const isoMatch = trimmed.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  const usMatch = trimmed.match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/);
  if (usMatch) {
    return `${usMatch[3]}-${usMatch[1]}-${usMatch[2]}`;
  }

  const parsed = parseDateStringAsLocalDate(trimmed);
  if (!parsed) return "";

  return formatLocalDate(parsed);
}

function toIsoTimestamp(value?: string | null): string | null {
  const date = parseDateStringAsLocalDate(value);
  if (!date) return null;
  return date.toISOString();
}

function isValidDateString(value?: string | null): boolean {
  return Boolean(toDateOnly(value));
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
      if (dateOnly) uniqueDates.add(dateOnly);
    }
  }

  return Array.from(uniqueDates).sort();
}

function getUploadId(file: File): string {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

function parseFileConfigs(formData: FormData): {
  configs: FileConfig[];
  error: string | null;
} {
  const raw = formData.get("fileConfigs");

  if (typeof raw !== "string" || !raw.trim()) {
    return { configs: [], error: null };
  }

  try {
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return {
        configs: [],
        error: "Invalid file configuration payload.",
      };
    }

    const configs: FileConfig[] = parsed.map((item) => ({
      uploadId:
        typeof item?.uploadId === "string" ? item.uploadId.trim() : undefined,
      fileName:
        typeof item?.fileName === "string" ? item.fileName.trim() : undefined,
      endDate:
        typeof item?.endDate === "string" ? item.endDate.trim() : undefined,
    }));

    return { configs, error: null };
  } catch {
    return {
      configs: [],
      error: "Invalid file configuration payload.",
    };
  }
}

function findMatchingFileConfig(
  file: File,
  fileConfigs: FileConfig[]
): FileConfig | undefined {
  const uploadId = getUploadId(file);

  return (
    fileConfigs.find((config) => config.uploadId === uploadId) ??
    fileConfigs.find((config) => config.fileName === file.name)
  );
}

export async function POST(req: NextRequest) {
  try {
    // Authenticate first. If the user isn't logged in, requireAuth returns
    // a 401 NextResponse — we just hand that back to the client.
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const instructor = authResult; // { instructorId, email, name, ... }

    const formData = await req.formData();

    const files = getUploadedFiles(formData);
    const { configs: fileConfigs, error: fileConfigError } =
      parseFileConfigs(formData);

    const FIXED_COURSE_NAME = "CS 101";

    if (files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    if (fileConfigError) {
      return NextResponse.json({ error: fileConfigError }, { status: 400 });
    }

    const preparedUploads: PreparedUpload[] = [];
    const fileErrors: FileValidationError[] = [];
    let hasParseError = false;

    for (const file of files) {
      const uploadId = getUploadId(file);
      const fileConfig = findMatchingFileConfig(file, fileConfigs);

      if (fileConfig?.endDate && !isValidDateString(fileConfig.endDate)) {
        fileErrors.push({
          uploadId,
          fileName: file.name,
          error: "Please enter a valid assignment end date for this file.",
        });
        continue;
      }

      const raw = await extractText(file);
      const parsed = parseTranscript(raw);
      const fileFingerprint = buildStableFileFingerprint(raw);

      if (parsed.sessions.length === 0) {
        hasParseError = true;
        fileErrors.push({
          uploadId,
          fileName: file.name,
          error: `Could not parse transcript in "${file.name}" — check the file format.`,
        });
        continue;
      }

      const extractedLogDates = getSortedUniqueLogDates(parsed.sessions);
      const fallbackGeneratedDate = toDateOnly(parsed.generatedAt);

      const logDates =
        extractedLogDates.length > 0
          ? extractedLogDates
          : fallbackGeneratedDate
            ? [fallbackGeneratedDate]
            : [];

      const logDerivedStartDate =
        logDates[0] ||
        fallbackGeneratedDate ||
        "";

      const logDerivedEndDate =
        logDates[logDates.length - 1] ||
        fallbackGeneratedDate ||
        "";

      if (!logDerivedEndDate) {
        fileErrors.push({
          uploadId,
          fileName: file.name,
          error: "Could not determine any valid log dates from this uploaded log.",
        });
        continue;
      }

      const firstParsedAssignmentName = parsed.sessions
        .map((session) => session.assignmentName?.trim())
        .find(Boolean);

      const logDerivedAssignmentName = getAssignmentNameFromLogs(raw).trim();

      const resolvedAssignmentName =
        firstParsedAssignmentName ||
        logDerivedAssignmentName ||
        getFileBaseName(file.name);

      const expectedEndDates =
        logDates.length > 0
          ? logDates
          : [logDerivedEndDate];

      const configNormalizedEndDate = fileConfig?.endDate
        ? toDateOnly(fileConfig.endDate)
        : "";

      const normalizedEnteredEndDate =
        configNormalizedEndDate || logDerivedEndDate;
 
        //validation logic shouldn't force the end date to match a message timestamp. 
        //It should just accept any valid date the user enters.
      const isAllowedEndDate = Boolean(normalizedEnteredEndDate);

      if (!isAllowedEndDate) {
        fileErrors.push({
          uploadId,
          fileName: file.name,
          expectedEndDate: logDerivedEndDate,
          expectedEndDates,
          logDates,
          error:
            expectedEndDates.length > 1
              ? `Incorrect assignment end date. Please enter one of: ${expectedEndDates.join(", ")}.`
              : `Incorrect assignment end date. Please enter ${logDerivedEndDate}.`,
        });
        continue;
      }

      const resolvedStartDate = logDerivedStartDate || normalizedEnteredEndDate;

      preparedUploads.push({
        uploadId,
        fileName: file.name,
        fileFingerprint,
        raw,
        parsed,
        logDates,
        logDerivedStartDate,
        logDerivedEndDate,
        logDerivedAssignmentName,
        resolvedAssignmentName,
        resolvedStartDate,
        resolvedEndDate: normalizedEnteredEndDate,
      });
    }

    if (fileErrors.length > 0) {
      return NextResponse.json(
        {
          error:
            fileErrors.length === 1
              ? fileErrors[0].error || "One uploaded file has invalid data."
              : "Some uploaded files have invalid dates or could not be parsed.",
          fileErrors,
        },
        { status: hasParseError ? 422 : 400 }
      );
    }

    if (preparedUploads.length === 0) {
      return NextResponse.json(
        { error: "No valid files were available to import." },
        { status: 400 }
      );
    }

    let insertedSessions = 0;
    let skippedDuplicateSessions = 0;
    let insertedMessages = 0;
    const assignmentsUsed = new Set<number>();

    //a set to is used to track assignments that have been already cleared 
    runInTransaction(() => {
      const courseId = upsertCourse(
    instructor.instructorId,
   FIXED_COURSE_NAME,
    preparedUploads[0]?.parsed.generatedAt ?? undefined
  );

      const clearedAssignments = new Set<number>();

      for (const preparedFile of preparedUploads) {
        const assignmentId = upsertAssignment(
        instructor.instructorId,
         courseId,
         preparedFile.resolvedAssignmentName,
         undefined,
         preparedFile.resolvedStartDate || undefined,
         preparedFile.resolvedEndDate
      );

        assignmentsUsed.add(assignmentId);

        if (!clearedAssignments.has(assignmentId)) {
          db.prepare("DELETE FROM sessions WHERE assignment_id = ?").run(assignmentId);
          clearedAssignments.add(assignmentId);
        }

        // Clear old sessions (and their messages via CASCADE) for this assignment
        // so re-uploading replaces data instead of accumulating it
        //db.prepare("DELETE FROM sessions WHERE assignment_id = ?").run(assignmentId);

        const stableSourceFile = buildStableSourceFile(
          preparedFile.fileName,
          preparedFile.fileFingerprint
        );

        for (const session of preparedFile.parsed.sessions) {
          const rawEmail = session.studentEmail?.trim();
          if (!rawEmail) continue;

          const studentId = upsertStudent(instructor.instructorId, rawEmail);

          const normalizedMessageTimestamps = session.messages
            .map((msg) => toIsoTimestamp(msg.timestamp))
            .filter((value): value is string => Boolean(value));

          const startedAt = normalizedMessageTimestamps[0] ?? null;
          const endedAt =
            normalizedMessageTimestamps[
              normalizedMessageTimestamps.length - 1
            ] ?? null;

          const firstMessage = session.messages[0]?.content ?? "";
          const lastMessage =
            session.messages[session.messages.length - 1]?.content ?? "";

          const importKey = buildSessionImportKey({
             instructorId: instructor.instructorId,
            studentAnonymousId: anonymizeId(rawEmail),
             assignmentId,
             sourceFile: stableSourceFile,
             startedAt,
             endedAt,
             firstMessage,
             lastMessage,
            });

          const sessionResult = createOrGetSession
          ({
             instructorId: instructor.instructorId,
             studentId,
             assignmentId,
             importKey,
             sourceFile: stableSourceFile,
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
      filesProcessed: preparedUploads.length,
      assignmentsCreatedOrMatched: assignmentsUsed.size,
      sessionsInserted: insertedSessions,
      duplicateSessionsSkipped: skippedDuplicateSessions,
      messagesInserted: insertedMessages,
      files: preparedUploads.map((file) => ({
        uploadId: file.uploadId,
        fileName: file.fileName,
        assignmentName: file.resolvedAssignmentName,
        startDate: file.resolvedStartDate,
        endDate: file.resolvedEndDate,
        expectedEndDate: file.logDerivedEndDate,
        expectedEndDates: file.logDates.length
          ? file.logDates
          : file.logDerivedEndDate
            ? [file.logDerivedEndDate]
            : [],
        logDates: file.logDates,
      })),
    });
  } catch (error) {
    console.error("Upload processing failed:", error);

    return NextResponse.json(
      { error: "Failed to process transcript" },
      { status: 500 }
    );
  }
}