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

type ParsedTranscript = ReturnType<typeof parseTranscript>;

type FileConfig = {
  uploadId?: string;
  fileName?: string;
  assignmentName?: string;
  startDate?: string;
  endDate?: string;
};

type PreparedUpload = {
  uploadId: string;
  fileName: string;
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
      assignmentName:
        typeof item?.assignmentName === "string"
          ? item.assignmentName.trim()
          : undefined,
      startDate:
        typeof item?.startDate === "string" ? item.startDate.trim() : undefined,
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
    const formData = await req.formData();

    const files = getUploadedFiles(formData);
    const uploadedAssignmentName = String(
      formData.get("assignmentName") ?? ""
    ).trim();
    const uploadedStartDate = String(formData.get("startDate") ?? "").trim();
    const sharedEndDate = String(formData.get("endDate") ?? "").trim();
    const detectDatesOnly =
      String(formData.get("detectDatesOnly") ?? "").trim() === "true";

    const { configs: fileConfigs, error: fileConfigError } =
      parseFileConfigs(formData);

    const FIXED_COURSE_NAME = "CS 101";

    if (files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    if (fileConfigError) {
      return NextResponse.json({ error: fileConfigError }, { status: 400 });
    }

    if (uploadedStartDate && !isValidDateString(uploadedStartDate)) {
      return NextResponse.json(
        { error: "Please enter a valid assignment start date." },
        { status: 400 }
      );
    }

    if (sharedEndDate && !isValidDateString(sharedEndDate)) {
      return NextResponse.json(
        { error: "Please enter a valid assignment end date." },
        { status: 400 }
      );
    }

    const preparedUploads: PreparedUpload[] = [];
    const fileErrors: FileValidationError[] = [];
    let hasParseError = false;

    for (const file of files) {
      const uploadId = getUploadId(file);
      const fileConfig = findMatchingFileConfig(file, fileConfigs);

      const raw = await extractText(file);
      const parsed = parseTranscript(raw);

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
        logDates[0] ??
        getEarliestValidDate(
          parsed.sessions.flatMap((session) =>
            session.messages.map((msg) => msg.timestamp)
          )
        ) ??
        fallbackGeneratedDate;

      const logDerivedEndDate =
        logDates[logDates.length - 1] ??
        getLatestValidDate(
          parsed.sessions.flatMap((session) =>
            session.messages.map((msg) => msg.timestamp)
          )
        ) ??
        fallbackGeneratedDate;

      if (logDates.length === 0 && !logDerivedEndDate) {
        fileErrors.push({
          uploadId,
          fileName: file.name,
          error:
            "Could not determine any valid log dates from this uploaded log.",
        });
        continue;
      }

      const firstParsedAssignmentName = parsed.sessions
        .map((session) => session.assignmentName?.trim())
        .find(Boolean);

      const logDerivedAssignmentName = getAssignmentNameFromLogs(raw).trim();

      const resolvedAssignmentName =
        fileConfig?.assignmentName ||
        uploadedAssignmentName ||
        firstParsedAssignmentName ||
        logDerivedAssignmentName ||
        getFileBaseName(file.name);

      const expectedEndDates =
        logDates.length > 0
          ? logDates
          : logDerivedEndDate
            ? [logDerivedEndDate]
            : [];

      if (detectDatesOnly) {
        preparedUploads.push({
          uploadId,
          fileName: file.name,
          raw,
          parsed,
          logDates,
          logDerivedStartDate,
          logDerivedEndDate,
          logDerivedAssignmentName,
          resolvedAssignmentName,
          resolvedStartDate: uploadedStartDate || logDerivedStartDate,
          resolvedEndDate: logDerivedEndDate,
        });
        continue;
      }

      const enteredEndDate =
        fileConfig?.endDate || sharedEndDate || logDerivedEndDate;

      if (enteredEndDate && !isValidDateString(enteredEndDate)) {
        fileErrors.push({
          uploadId,
          fileName: file.name,
          error: "Please enter a valid assignment end date for this file.",
        });
        continue;
      }

      const normalizedEnteredEndDate = enteredEndDate
        ? toDateOnly(enteredEndDate)
        : logDerivedEndDate;

      const isAllowedEndDate =
        !normalizedEnteredEndDate
          ? false
          : logDates.length > 0
            ? expectedEndDates.includes(normalizedEnteredEndDate)
            : normalizedEnteredEndDate === logDerivedEndDate;

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

      const resolvedStartDate =
        fileConfig?.startDate || uploadedStartDate || logDerivedStartDate;

      if (!resolvedStartDate) {
        fileErrors.push({
          uploadId,
          fileName: file.name,
          expectedEndDate: logDerivedEndDate,
          expectedEndDates,
          logDates,
          error:
            "Could not determine an assignment start date from this uploaded log. Please enter a start date manually.",
        });
        continue;
      }

      if (!isValidDateString(resolvedStartDate)) {
        fileErrors.push({
          uploadId,
          fileName: file.name,
          error:
            fileConfig?.startDate || uploadedStartDate
              ? "Please enter a valid assignment start date."
              : "The uploaded log contains an invalid start date. Please enter a start date manually.",
        });
        continue;
      }

      const normalizedStartDate = toDateOnly(resolvedStartDate);

      if (!normalizedStartDate) {
        fileErrors.push({
          uploadId,
          fileName: file.name,
          error:
            fileConfig?.startDate || uploadedStartDate
              ? "Please enter a valid assignment start date."
              : "The uploaded log contains an invalid start date. Please enter a start date manually.",
        });
        continue;
      }

      if (new Date(normalizedStartDate) > new Date(normalizedEnteredEndDate)) {
        fileErrors.push({
          uploadId,
          fileName: file.name,
          expectedEndDate: logDerivedEndDate,
          expectedEndDates,
          logDates,
          error:
            fileConfig?.startDate || uploadedStartDate
              ? "End date must be after the start date."
              : `The end date is earlier than the start date found in the uploaded log (${normalizedStartDate}). Please choose a later end date or enter a start date manually.`,
        });
        continue;
      }

      preparedUploads.push({
        uploadId,
        fileName: file.name,
        raw,
        parsed,
        logDates,
        logDerivedStartDate,
        logDerivedEndDate,
        logDerivedAssignmentName,
        resolvedAssignmentName,
        resolvedStartDate: normalizedStartDate,
        resolvedEndDate: normalizedEnteredEndDate,
      });
    }

    if (detectDatesOnly) {
      return NextResponse.json({
        success: fileErrors.length === 0,
        files: preparedUploads.map((file) => ({
          uploadId: file.uploadId,
          fileName: file.fileName,
          detectedEndDate: file.logDerivedEndDate,
          suggestedEndDates: file.logDates.length
            ? file.logDates
            : file.logDerivedEndDate
              ? [file.logDerivedEndDate]
              : [],
          detectedStartDate: file.logDerivedStartDate,
        })),
        fileErrors,
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
    const assignmentsUsed = new Map<string, string>();

    runInTransaction(() => {
      const courseId = upsertCourse(
        FIXED_COURSE_NAME,
        preparedUploads[0]?.parsed.generatedAt ?? undefined
      );

      const assignmentIdCache = new Map<string, number>();

      for (const preparedFile of preparedUploads) {
        const assignmentKey = [
          preparedFile.resolvedAssignmentName,
          preparedFile.resolvedStartDate,
          preparedFile.resolvedEndDate,
        ].join("__");

        let assignmentId = assignmentIdCache.get(assignmentKey);

        if (!assignmentId) {
          assignmentId = upsertAssignment(
            courseId,
            preparedFile.resolvedAssignmentName,
            undefined,
            preparedFile.resolvedStartDate,
            preparedFile.resolvedEndDate
          );

          assignmentIdCache.set(assignmentKey, assignmentId);
          assignmentsUsed.set(
            assignmentKey,
            preparedFile.resolvedAssignmentName
          );
        }

        for (const session of preparedFile.parsed.sessions) {
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
            sourceFile: preparedFile.fileName,
            startedAt,
            endedAt,
            firstMessage,
            lastMessage,
          });

          const sessionResult = createOrGetSession({
            studentId,
            assignmentId,
            importKey,
            sourceFile: preparedFile.fileName,
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