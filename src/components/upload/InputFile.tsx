"use client";

import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import axios from "axios";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useAiAnalytics } from "@/app/dashboard/DashboardClient";
import { Switch } from "../ui/switch";

// Only these MIME types and file extensions are accepted by the upload form.
const ACCEPTED_TYPES = ["text/plain", "application/pdf"];
const ACCEPTED_EXTENSIONS = [".txt", ".pdf"];

// Shape of a per-file validation error returned by POST /api/upload when the
// backend rejects one or more files (e.g. the end date doesn't match the log).
type FileValidationError = {
  uploadId?: string;
  fileName?: string;
  expectedEndDate?: string;   // single correct date the backend expected
  expectedEndDates?: string[]; // multiple acceptable dates (when ambiguous)
  logDates?: string[];         // raw dates found inside the log file
  error?: string;              // free-text error message from the backend
};

// Top-level response shape from POST /api/upload.
type UploadResponse = {
  success?: boolean;
  filesProcessed?: number;
  error?: string;              // general error unrelated to a specific file
  fileErrors?: FileValidationError[];
  aiAnalyzerOptIn?: boolean;
};

// Per-file result returned by POST /api/upload/detect-dates.
// The backend tries all three fields; we prefer detectedEndDates, then
// logDates, then the legacy single detectedEndDate field.
type DetectDatesFileResult = {
  uploadId?: string;
  fileName?: string;
  detectedEndDate?: string;    // legacy single-date field
  detectedEndDates?: string[]; // preferred: array of candidate end dates
  logDates?: string[];         // raw dates parsed from the log body
  error?: string;
};

// Top-level response shape from POST /api/upload/detect-dates.
type DetectDatesResponse = {
  success?: boolean;
  files?: DetectDatesFileResult[];
  error?: string;
};

// Subset of the analytics context used here. All fields are optional because
// the upload page can be rendered outside the dashboard context (e.g. during
// auth checks) where the full context may not be available.
type AnalyticsBridge = Partial<{
  setIsAiAccepted: (value: boolean) => void;
  refreshAnalyticsData: () => Promise<void>;
  setPendingUploadSuccess: (value: boolean) => void;
}>;

// One row in the file list. Each uploaded file gets its own UploadRow so the
// user can review and optionally adjust the auto-detected end date per file.
type UploadRow = {
  uploadId: string;        // stable key derived from name + size + lastModified
  file: File;              // the raw File object used in FormData payloads
  fileName: string;
  endDates: string[];      // date values in the input fields (index 0 = first field)
  detectedEndDates: string[]; // dates the backend detected from the log content
  error: string;           // per-row error message from the last failed upload
};

// A row is ready to submit as long as the date field is not blank.
// Correctness of the date is validated server-side; the frontend only blocks
// submission when there is nothing entered at all.
function isRowValid(row: UploadRow): boolean {
  return !!row.endDates[0]?.trim();
}

// Returns true when the file passes the MIME type or extension allow-list.
// Checking both handles cases where the browser reports an empty MIME type.
function isAcceptedFile(file: File) {
  const fileName = file.name.toLowerCase();
  return (
    ACCEPTED_TYPES.includes(file.type) ||
    ACCEPTED_EXTENSIONS.some((ext) => fileName.endsWith(ext))
  );
}

// Produces a stable identifier for a File so we can detect duplicates across
// multiple file-picker interactions without relying on object identity.
function getUploadId(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

// Deduplicates an array of strings, filtering out any null/undefined values.
function uniqueStrings(values: Array<string | undefined | null>) {
  return Array.from(new Set(values.filter(Boolean) as string[]));
}

// Builds a human-readable error message from a backend FileValidationError.
// The backend may return a specific expected date, a list of acceptable dates,
// or just the raw log dates it found — we surface whichever is most useful.
function buildRowErrorMessage(fileError: FileValidationError) {
  const fileName = fileError.fileName || "A file";
  const expectedDate = fileError.expectedEndDate;
  const expectedDates = fileError.expectedEndDates?.filter(Boolean) || [];
  const logDates = fileError.logDates?.filter(Boolean) || [];

  if (fileError.error) {
    return `${fileName}: ${fileError.error}`;
  }

  if (expectedDates.length > 1) {
    return `${fileName}: expected one of ${expectedDates.join(", ")}.`;
  }

  if (expectedDate) {
    return `${fileName}: expected end date ${expectedDate}.`;
  }

  if (logDates.length > 1) {
    return `${fileName}: detected multiple log dates (${logDates.join(", ")}).`;
  }

  return `${fileName}: invalid log date data.`;
}

// Builds a human-readable error message from a DetectDatesFileResult when
// the detect-dates endpoint could not determine an end date for a file.
function buildDetectErrorMessage(fileResult: DetectDatesFileResult) {
  const fileName = fileResult.fileName || "A file";
  const logDates = fileResult.logDates?.filter(Boolean) || [];

  if (fileResult.error) {
    return `${fileName}: ${fileResult.error}`;
  }

  if (logDates.length > 0) {
    return `${fileName}: found log dates (${logDates.join(", ")}) but could not choose an end date.`;
  }

  return `${fileName}: could not detect an end date from the uploaded log.`;
}

export function InputFile() {
  // True while the final upload POST is in-flight.
  const [loading, setLoading] = useState(false);
  // True while the detect-dates POST is in-flight (auto-detection on file add).
  const [detectingDates, setDetectingDates] = useState(false);
  // Stays true until the auth check resolves; renders a loading state instead
  // of the form so unauthenticated users are redirected before seeing the UI.
  const [checkingAuth, setCheckingAuth] = useState(true);
  // One entry per selected file. This is the single source of truth for the
  // file list, detected dates, and the user's date input values.
  const [rows, setRows] = useState<UploadRow[]>([]);
  // Whether the user has opted in to the AI Analyzer feature.
  const [isChecked, setIsChecked] = useState(false);

  // Provides callbacks to update the analytics dashboard after a successful
  // upload without requiring a full page reload.
  const analytics = useAiAnalytics() as AnalyticsBridge;
  // Ref to the hidden file input so we can reset its value after each change,
  // allowing the same file to be re-added if removed and re-selected.
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const router = useRouter();

  // On mount, verify the session is still valid. If the cookie has expired the
  // user is redirected to login before the form is ever rendered.
  useEffect(() => {
    const checkAuth = async () => {
      try {
        await axios.get("/api/auth/me", {
          withCredentials: true,
        });
        setCheckingAuth(false);
      } catch {
        router.replace("/login?redirect=/upload");
      }
    };

    checkAuth();
  }, [router]);

  // Derives a "N file(s) selected" label from the row count. useMemo avoids
  // recalculating the string on every render unrelated to rows.length.
  const selectedFileCountLabel = useMemo(() => {
    return `${rows.length} file${rows.length === 1 ? "" : "s"} selected`;
  }, [rows.length]);

  // True when at least one row has a blank date field. Used to keep the submit
  // button disabled until every file has a date entered (auto-filled or manual).
  const hasInvalidDate = useMemo(() => {
    return rows.some((row) => !isRowValid(row));
  }, [rows]);

  // Whenever a new file is added whose end date hasn't been detected yet,
  // silently call the detect-dates endpoint so the date field auto-fills
  // without the user needing to click anything. The `silent` flag suppresses
  // toast notifications so the background call is invisible on success.
  useEffect(() => {
    const hasUndetectedRow = rows.some(
      (row) => row.detectedEndDates.length === 0,
    );
    if (!hasUndetectedRow) return;
    if (loading || detectingDates) return;

    handleAutofillEndDates({ silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.length]);

  // Builds the fileConfigs JSON blob sent alongside the file binaries so the
  // backend can match each file to its user-supplied end date(s).
  const buildFileConfigsPayload = (targetRows: UploadRow[]) => {
    return targetRows.map((row) => ({
      uploadId: row.uploadId,
      fileName: row.fileName,
      endDates: row.endDates.map((d) => d.trim()).filter(Boolean),
    }));
  };

  // Handles the file picker's change event. Validates each file type, then
  // merges new files into the rows array (skipping exact duplicates).
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);

    if (files.length === 0) return;

    // Reject the whole batch if any single file has an unsupported type,
    // rather than silently ignoring it and confusing the user.
    const invalidFile = files.find((file) => !isAcceptedFile(file));
    if (invalidFile) {
      toast.error("Only TXT and PDF files are allowed.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setRows((prev) => {
      const merged = [...prev];

      for (const file of files) {
        const uploadId = getUploadId(file);

        // Skip files that are already in the list to prevent duplicates.
        // We check both uploadId and the raw file properties for safety.
        const exists = merged.some(
          (row) =>
            row.uploadId === uploadId ||
            (row.file.name === file.name &&
              row.file.size === file.size &&
              row.file.lastModified === file.lastModified),
        );

        if (!exists) {
          merged.push({
            uploadId,
            file,
            fileName: file.name,
            endDates: [],        // will be auto-filled by detect-dates
            detectedEndDates: [],
            error: "",
          });
        }
      }

      return merged;
    });

    // Reset the input value so selecting the same file again after removing it
    // triggers a new change event instead of being silently ignored.
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Removes a single file from the list by its uploadId.
  const removeFile = (uploadIdToRemove: string) => {
    setRows((prev) => prev.filter((row) => row.uploadId !== uploadIdToRemove));
  };

  // Updates a single date input field for a given row. `index` is always 0
  // because each file currently has one date field. Clearing the error on
  // change ensures stale backend error messages don't persist after edits.
  const updateEndDateAt = (uploadId: string, index: number, value: string) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.uploadId !== uploadId) return row;
        const nextEndDates = [...row.endDates];
        nextEndDates[index] = value;
        return { ...row, endDates: nextEndDates, error: "" };
      }),
    );
  };

  // Clears all form state back to its initial values after a successful upload.
  const resetForm = () => {
    setRows([]);
    setIsChecked(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Sends all current files to /api/upload/detect-dates and auto-fills the
  // date field for each file whose end date the backend can determine.
  // Called automatically (silent=true) when files are added, and can also
  // be called explicitly by the user if detection needs to be re-run.
  const handleAutofillEndDates = async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;

    if (loading || detectingDates) return;

    if (rows.length === 0) {
      if (!silent) toast.error("Add at least one file first.");
      return;
    }

    try {
      setDetectingDates(true);

      // Send all files together so the backend can process them in one pass.
      const formData = new FormData();

      for (const row of rows) {
        formData.append("files", row.file);
      }

      // fileConfigs tells the backend which uploadId/fileName to associate with
      // each file binary so results can be matched back to the correct row.
      formData.append(
        "fileConfigs",
        JSON.stringify(
          rows.map((row) => ({
            uploadId: row.uploadId,
            fileName: row.fileName,
          })),
        ),
      );

      const response = await axios.post<DetectDatesResponse>(
        "/api/upload/detect-dates",
        formData,
        {
          withCredentials: true,
          headers: {
            "Content-Type": "multipart/form-data",
          },
        },
      );

      const detectedFiles = response.data.files ?? [];

      // Build a lookup map keyed by both uploadId and fileName so we can find
      // the right result even if only one of the two identifiers is present.
      const detectedMap = new Map<string, DetectDatesFileResult>();

      for (const fileResult of detectedFiles) {
        for (const key of uniqueStrings([
          fileResult.uploadId,
          fileResult.fileName,
        ])) {
          detectedMap.set(key, fileResult);
        }
      }

      // Normalises the three possible date fields the backend may return into
      // a single string array. Newer responses use detectedEndDates; older
      // ones use the single detectedEndDate field.
      const extractDates = (fr: DetectDatesFileResult): string[] => {
        if (fr.detectedEndDates?.length)
          return uniqueStrings(fr.detectedEndDates);
        if (fr.logDates?.length) return uniqueStrings(fr.logDates);
        if (fr.detectedEndDate) return [fr.detectedEndDate];
        return [];
      };

      const detectedCount = detectedFiles.filter(
        (file) => extractDates(file).length > 0,
      ).length;

      setRows((prev) =>
        prev.map((row) => {
          const fileResult =
            detectedMap.get(row.uploadId) || detectedMap.get(row.fileName);

          if (!fileResult) return row;

          const newDetected = extractDates(fileResult);

          // Auto-fill with the first detected date if the user hasn't typed
          // anything yet. If they've already entered a value, leave it alone
          // so manual edits aren't overwritten on re-detection.
          const nextEndDates = row.endDates[0] ? row.endDates : [newDetected[0] ?? ""];

          return {
            ...row,
            detectedEndDates:
              newDetected.length > 0 ? newDetected : row.detectedEndDates,
            endDates: nextEndDates,
            error: fileResult.error ? buildDetectErrorMessage(fileResult) : "",
          };
        }),
      );

      // Only show success/failure toasts when the call was user-initiated.
      // Silent (auto) calls skip toasts to avoid noise on every file add.
      if (detectedCount > 0) {
        if (!silent) {
          toast.success(
            `Autofilled end date${detectedCount === 1 ? "" : "s"} for ${detectedCount} file${detectedCount === 1 ? "" : "s"} ✅`,
          );
        }
      } else if (!silent) {
        toast.error("Could not detect end dates from the uploaded logs.");
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        const responseData = err.response?.data as
          | DetectDatesResponse
          | undefined;

        if (status === 401) {
          router.replace("/login?redirect=/upload");
          return;
        }

        if (responseData?.error) {
          toast.error(responseData.error);
          return;
        }
      }

      if (!silent) {
        toast.error("Could not autofill end dates.");
      }
    } finally {
      setDetectingDates(false);
    }
  };

  // Handles the form submission. Builds a multipart/form-data payload
  // containing all file binaries, their configured end dates, and the AI
  // opt-in flag, then POSTs to /api/upload.
  const onSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (loading || detectingDates) return;

    if (rows.length === 0) {
      toast.error("At least one file is required.");
      return;
    }

    try {
      setLoading(true);

      const formData = new FormData();

      for (const row of rows) {
        formData.append("files", row.file);
      }

      // fileConfigs carries the end dates alongside the file binaries so the
      // backend can validate each file against the date the user supplied.
      formData.append(
        "fileConfigs",
        JSON.stringify(buildFileConfigsPayload(rows)),
      );
      formData.append("aiAnalyzerOptIn", String(isChecked));

      const response = await axios.post<UploadResponse>(
        "/api/upload",
        formData,
        {
          withCredentials: true,
          headers: {
            "Content-Type": "multipart/form-data",
          },
        },
      );

      const responseData = response.data;
      const filesProcessed = responseData.filesProcessed ?? rows.length;

      // Sync the AI opt-in preference and signal to the dashboard that fresh
      // data is available, then refresh analytics without a full page reload.
      analytics.setIsAiAccepted?.(isChecked);
      analytics.setPendingUploadSuccess?.(true);

      if (analytics.refreshAnalyticsData) {
        await analytics.refreshAnalyticsData();
      }

      toast.success(
        `${filesProcessed} log${
          filesProcessed === 1 ? "" : "s"
        } uploaded successfully ✅`,
      );

      resetForm();

      router.push("/dashboard");
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        const responseData = err.response?.data as UploadResponse | undefined;

        if (status === 401) {
          router.replace("/login?redirect=/upload");
          return;
        }

        // When the backend returns per-file validation errors, update each row
        // with the corrected expected dates so the user can fix and resubmit.
        if (responseData?.fileErrors?.length) {
          const errorMap = new Map<string, FileValidationError>();

          for (const fileError of responseData.fileErrors) {
            for (const key of uniqueStrings([
              fileError.uploadId,
              fileError.fileName,
            ])) {
              errorMap.set(key, fileError);
            }
          }

          setRows((prev) =>
            prev.map((row) => {
              const fileError =
                errorMap.get(row.uploadId) || errorMap.get(row.fileName);

              if (!fileError) return row;

              // Merge expectedEndDate and expectedEndDates into one array so
              // either format from the backend is handled consistently.
              const nextExpectedDates = uniqueStrings([
                fileError.expectedEndDate,
                ...(fileError.expectedEndDates || []),
              ]);

              return {
                ...row,
                detectedEndDates:
                  nextExpectedDates.length > 0
                    ? nextExpectedDates
                    : row.detectedEndDates,
                endDates: row.endDates.length === 1 ? row.endDates : [""],
                error: buildRowErrorMessage(fileError),
              };
            }),
          );

          const firstMessage =
            responseData.fileErrors.length === 1
              ? buildRowErrorMessage(responseData.fileErrors[0])
              : "Some files have incorrect dates. Check the suggested dates and try again.";

          toast.error(firstMessage);
          return;
        }

        if (responseData?.error) {
          toast.error(responseData.error);
          return;
        }
      }

      toast.error("Upload failed.");
    } finally {
      setLoading(false);
    }
  };

  // Show a placeholder while the auth check is in-flight so the form never
  // flashes before an unauthenticated user is redirected to login.
  if (checkingAuth) {
    return (
      <div className="w-full max-w-sm">
        <div className="rounded-xl border p-4 text-sm text-muted-foreground">
          Checking access...
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl space-y-4">
      <form onSubmit={onSubmit} className="space-y-4">

        {/* File picker — accepts .txt and .pdf only, supports multi-select */}
        <Field>
          <FieldLabel htmlFor="inputFile">Upload Documents</FieldLabel>
          <Input
            id="inputFile"
            type="file"
            accept=".txt,.pdf"
            multiple
            className="cursor-pointer"
            onChange={handleFileChange}
            ref={fileInputRef}
          />
          <FieldDescription>
            You can upload multiple files at once. The end date is automatically
            detected from each log and pre-filled for you.
          </FieldDescription>
        </Field>

        {/* File list — rendered once at least one file has been selected */}
        {rows.length > 0 && (
          <div className="space-y-3 rounded-xl border p-4">
            <p className="font-medium">{selectedFileCountLabel}</p>

            <div className="space-y-4">
              {rows.map((row) => (
                <div
                  key={row.uploadId}
                  className="space-y-3 rounded-xl border p-4"
                >
                  {/* Row header: file name + detection status badge + Remove button */}
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="break-words font-medium">{row.fileName}</p>

                      {/* Show a "detecting" message while the request is in-flight,
                          then swap to a green badge once dates have been found. */}
                      {detectingDates ? (
                        <p className="text-sm text-muted-foreground">
                          Detecting end date from log...
                        </p>
                      ) : row.detectedEndDates.length > 0 ? (
                        <p className="mt-1 inline-block rounded-md border border-green-500/40 bg-green-500/10 px-2 py-0.5 text-sm font-medium text-green-700 dark:text-green-400">
                          ✓ End date auto-detected
                        </p>
                      ) : null}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => removeFile(row.uploadId)}
                      disabled={loading || detectingDates}
                    >
                      Remove
                    </Button>
                  </div>

                  {/* Date input — always shown so the user can enter a date
                      manually even if auto-detection fails. The value is
                      pre-filled by handleAutofillEndDates and remains editable. */}
                  <Field>
                    <FieldLabel htmlFor={`end-${row.uploadId}-0`}>
                      Assignment End Date
                    </FieldLabel>
                    <Input
                      id={`end-${row.uploadId}-0`}
                      type="date"
                      value={row.endDates[0] ?? ""}
                      onChange={(e) =>
                        updateEndDateAt(row.uploadId, 0, e.target.value)
                      }
                    />
                    <FieldDescription>
                      Auto-detected from your log. You can adjust this date if needed.
                    </FieldDescription>
                  </Field>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI Analyzer opt-in toggle — preference is forwarded to the analytics
            context immediately so the dashboard reflects the choice in real time */}
        <div className="flex flex-row items-center gap-2">
          <Switch
            checked={isChecked}
            onCheckedChange={(checked) => {
              setIsChecked(checked);
              analytics.setIsAiAccepted?.(checked);
            }}
          />
          <span>Opt in for AI Analyzer</span>
        </div>

        {/* Submit button — disabled while uploading, detecting dates, or when
            no files are selected / any date field is still blank */}
        <Button
          type="submit"
          disabled={
            loading || detectingDates || rows.length === 0 || hasInvalidDate
          }
          className="w-full cursor-pointer"
        >
          {loading ? "Uploading..." : "Upload"}
        </Button>
      </form>
    </div>
  );
}
