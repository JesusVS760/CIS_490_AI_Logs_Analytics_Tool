import { NextRequest, NextResponse } from "next/server";
import { extractText as extractPdfText } from "unpdf";
import { parseTranscript } from "@/lib/parseTranscript";

type FileConfig = {
  uploadId?: string;
  fileName?: string;
};

type DetectDatesFileResult = {
  uploadId?: string;
  fileName?: string;
  detectedEndDate?: string;
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
  if (ampm === "AM" && hours === 12) hours = 0;
  if (ampm === "PM" && hours !== 12) hours += 12;

  const date = new Date(
    Number(yyyy),
    Number(mm) - 1,
    Number(dd),
    hours,
    Number(min),
    Number(ss)
  );

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

function toDateOnly(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const isoMatch = trimmed.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  const usMatch = trimmed.match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/);
  if (usMatch) {
    return `${usMatch[3]}-${usMatch[1]}-${usMatch[2]}`;
  }

  const parsed = parseDateStringAsLocalDate(trimmed);
  if (!parsed) return null;

  return formatLocalDate(parsed);
}

function walkForDates(input: unknown, bucket: Set<string>) {
  if (input == null) return;

  if (typeof input === "string") {
    const usMatches =
      input.match(
        /\b\d{2}\/\d{2}\/\d{4}(?:,\s*\d{2}:\d{2}:\d{2}\s*[AP]M)?\b/g
      ) || [];

    for (const match of usMatches) {
      const date = toDateOnly(match);
      if (date) bucket.add(date);
    }

    const isoMatches = input.match(/\b\d{4}-\d{2}-\d{2}\b/g) || [];
    for (const match of isoMatches) {
      const date = toDateOnly(match);
      if (date) bucket.add(date);
    }

    return;
  }

  if (Array.isArray(input)) {
    for (const item of input) {
      walkForDates(item, bucket);
    }
    return;
  }

  if (typeof input === "object") {
    for (const value of Object.values(input as Record<string, unknown>)) {
      walkForDates(value, bucket);
    }
  }
}

function collectLogDates(raw: string, parsed: unknown): string[] {
  const bucket = new Set<string>();

  walkForDates(raw, bucket);
  walkForDates(parsed, bucket);

  return Array.from(bucket).sort((a, b) => a.localeCompare(b));
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const files = formData
      .getAll("files")
      .filter((value): value is File => value instanceof File);

    if (files.length === 0) {
      return NextResponse.json(
        { error: "No files were uploaded." },
        { status: 400 }
      );
    }

    let fileConfigs: FileConfig[] = [];
    const rawConfigs = formData.get("fileConfigs");

    if (typeof rawConfigs === "string" && rawConfigs.trim()) {
      try {
        fileConfigs = JSON.parse(rawConfigs) as FileConfig[];
      } catch {
        return NextResponse.json(
          { error: "Invalid file configuration payload." },
          { status: 400 }
        );
      }
    }

    const results: DetectDatesFileResult[] = [];

    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const fileConfig = fileConfigs[index];

      try {
        const raw = await extractText(file);
        const parsed = parseTranscript(raw);
        const logDates = collectLogDates(raw, parsed);
        const detectedEndDate =
          logDates.length > 0 ? logDates[logDates.length - 1] : undefined;

        results.push({
          uploadId: fileConfig?.uploadId,
          fileName: fileConfig?.fileName || file.name,
          detectedEndDate,
          logDates,
          error: detectedEndDate
            ? undefined
            : "Could not detect an end date from this log.",
        });
      } catch {
        results.push({
          uploadId: fileConfig?.uploadId,
          fileName: fileConfig?.fileName || file.name,
          error: "Failed to read this file.",
        });
      }
    }

    return NextResponse.json({
      success: true,
      files: results,
    });
  } catch {
    return NextResponse.json(
      { error: "Could not detect end dates." },
      { status: 500 }
    );
  }
}