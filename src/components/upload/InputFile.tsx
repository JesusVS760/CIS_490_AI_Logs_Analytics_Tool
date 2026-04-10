"use client";

import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import axios from "axios";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useAiAnalytics } from "@/app/dashboard/DashboardClient";
import { Switch } from "../ui/switch";

const ACCEPTED_TYPES = ["text/plain", "application/pdf"];
const ACCEPTED_EXTENSIONS = [".txt", ".pdf"];

type FileValidationError = {
  uploadId?: string;
  fileName?: string;
  expectedEndDate?: string;
  expectedEndDates?: string[];
  logDates?: string[];
  error?: string;
};

type UploadResponse = {
  success?: boolean;
  filesProcessed?: number;
  error?: string;
  fileErrors?: FileValidationError[];
  aiAnalyzerOptIn?: boolean;
};
//added detectedEndDates?: string[];.
type DetectDatesFileResult = {
  uploadId?: string;
  fileName?: string;
  detectedEndDate?: string;
  detectedEndDates?: string[];
  logDates?: string[];
  error?: string;
};

type DetectDatesResponse = {
  success?: boolean;
  files?: DetectDatesFileResult[];
  error?: string;
};

type AnalyticsBridge = Partial<{
  setIsAiAccepted: (value: boolean) => void;
  refreshAnalyticsData: () => Promise<void>;
  setPendingUploadSuccess: (value: boolean) => void;
}>;

type UploadRow = {
  uploadId: string;
  file: File;
  fileName: string;
  endDates: string[];
  detectedEndDates: string[];
  error: string;
};

// A row is valid when the user has filled every slot with a date
// that belongs to this log's detected set, with no duplicates.
// A row is valid when the user has entered a single date that exists
// in this log's detected set.
function isRowValid(row: UploadRow): boolean {
  if (row.detectedEndDates.length === 0) return false;
  const entered = row.endDates[0];
  if (!entered) return false;
  return row.detectedEndDates.includes(entered);
}
function isAcceptedFile(file: File) {
  const fileName = file.name.toLowerCase();
  return (
    ACCEPTED_TYPES.includes(file.type) ||
    ACCEPTED_EXTENSIONS.some((ext) => fileName.endsWith(ext))
  );
}

function getUploadId(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

function uniqueStrings(values: Array<string | undefined | null>) {
  return Array.from(new Set(values.filter(Boolean) as string[]));
}

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
  const [loading, setLoading] = useState(false);
  const [detectingDates, setDetectingDates] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [rows, setRows] = useState<UploadRow[]>([]);
  const [generalError, setGeneralError] = useState("");
  const [isChecked, setIsChecked] = useState(false);

  const analytics = useAiAnalytics() as AnalyticsBridge;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const router = useRouter();

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

  const selectedFileCountLabel = useMemo(() => {
    return `${rows.length} file${rows.length === 1 ? "" : "s"} selected`;
  }, [rows.length]);


  //Returns true if any row has both a detected date and a user-typed date that differ
  //exactly the same condition the red badge uses
  //useMemo is wrapped so it only recomputes when rows changes, not on every render
 // A row is invalid if the user hasn't entered a date yet, or the entered
  // date doesn't match the date detected from the log. Both cases block
  // submission.
  // blank is also flagged anmd catches empty strins 
  const hasInvalidDate = useMemo(() => {
    return rows.some((row) => !isRowValid(row));
  }, [rows]);

  // Whenever rows are added that don't yet have a detected date, quietly
  // ask the backend to detect one so we can show the correct date to the
  // user right away.
  useEffect(() => {
    const hasUndetectedRow = rows.some((row) => row.detectedEndDates.length === 0);
    if (!hasUndetectedRow) return;
    if (loading || detectingDates) return;

    handleAutofillEndDates({ silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.length]);

 const buildFileConfigsPayload = (targetRows: UploadRow[]) => {
    return targetRows.map((row) => ({
      uploadId: row.uploadId,
      fileName: row.fileName,
      endDates: row.endDates.map((d) => d.trim()).filter(Boolean),
    }));
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);

    if (files.length === 0) return;

    const invalidFile = files.find((file) => !isAcceptedFile(file));
    if (invalidFile) {
      toast.error("Only TXT and PDF files are allowed.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setGeneralError("");

    setRows((prev) => {
      const merged = [...prev];

      for (const file of files) {
        const uploadId = getUploadId(file);

        const exists = merged.some(
          (row) =>
            row.uploadId === uploadId ||
            (row.file.name === file.name &&
              row.file.size === file.size &&
              row.file.lastModified === file.lastModified)
        );

        if (!exists) {
          merged.push({
            uploadId,
            file,
            fileName: file.name,
            endDates: [],
            detectedEndDates: [],
            error: "",
          });
        }
      }

      return merged;
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeFile = (uploadIdToRemove: string) => {
    setRows((prev) => prev.filter((row) => row.uploadId !== uploadIdToRemove));
  };

 


// add blur handler 
const updateEndDateAt = (uploadId: string, index: number, value: string) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.uploadId !== uploadId) return row;
        const nextEndDates = [...row.endDates];
        nextEndDates[index] = value;
        return { ...row, endDates: nextEndDates, error: "" };
      })
    );
  };
  

  const resetForm = () => {
    setRows([]);
    setGeneralError("");
    setIsChecked(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  //Function reused for auto-detection on file add, without toasts 
  const handleAutofillEndDates = async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;

    if (loading || detectingDates) return;

    if (rows.length === 0) {
      if (!silent) toast.error("Add at least one file first.");
      return;
    }

    try {
      setDetectingDates(true);
      setGeneralError("");

      const formData = new FormData();

      for (const row of rows) {
        formData.append("files", row.file);
      }

      formData.append(
        "fileConfigs",
        JSON.stringify(
          rows.map((row) => ({
            uploadId: row.uploadId,
            fileName: row.fileName,
          }))
        )
      );

      const response = await axios.post<DetectDatesResponse>(
        "/api/upload/detect-dates",
        formData,
        {
          withCredentials: true,
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      const detectedFiles = response.data.files ?? [];
      const detectedMap = new Map<string, DetectDatesFileResult>();

      for (const fileResult of detectedFiles) {
        for (const key of uniqueStrings([
          fileResult.uploadId,
          fileResult.fileName,
        ])) {
          detectedMap.set(key, fileResult);
        }
      }

      // Prefer detectedEndDates array; fall back to logDates, then
      // wrap the single detectedEndDate for backward compat.
      const extractDates = (fr: DetectDatesFileResult): string[] => {
        if (fr.detectedEndDates?.length) return uniqueStrings(fr.detectedEndDates);
        if (fr.logDates?.length) return uniqueStrings(fr.logDates);
        if (fr.detectedEndDate) return [fr.detectedEndDate];
        return [];
      };

      const detectedCount = detectedFiles.filter(
        (file) => extractDates(file).length > 0
      ).length;

      setRows((prev) =>
        prev.map((row) => {
          const fileResult =
            detectedMap.get(row.uploadId) || detectedMap.get(row.fileName);

          if (!fileResult) return row;

          const newDetected = extractDates(fileResult);

          // Create empty input slots matching the number of detected dates.
          // If slot count is unchanged and user already typed values, keep them.
        // One input slot — the user picks which detected date to use.
          const nextEndDates =
            row.endDates.length === 1 ? row.endDates : [""];;

          return {
            ...row,
            detectedEndDates: newDetected.length > 0 ? newDetected : row.detectedEndDates,
            endDates: nextEndDates,
            error: fileResult.error ? buildDetectErrorMessage(fileResult) : "",
          };
        })
      );

      //Sucess and error toasts 
      if (detectedCount > 0) {
        if (!silent) {
          toast.success(
            `Autofilled end date${detectedCount === 1 ? "" : "s"} for ${detectedCount} file${detectedCount === 1 ? "" : "s"} ✅`
          );
        }
      } else if (!silent) {
        toast.error("Could not detect end dates from the uploaded logs.");
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        const responseData = err.response?.data as DetectDatesResponse | undefined;

        if (status === 401) {
          router.replace("/login?redirect=/upload");
          return;
        }

        if (responseData?.error) {
          setGeneralError(responseData.error);
          toast.error(responseData.error);
          return;
        }
      }

      if (!silent) {
        setGeneralError("Could not autofill end dates.");
        toast.error("Could not autofill end dates.");
      }
    } finally {
      setDetectingDates(false);
    }
  };
// Handles upload, builds multipart/form-data request, and posts to /api/upload.

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (loading || detectingDates) return;

    setGeneralError("");

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

      formData.append(
        "fileConfigs",
        JSON.stringify(buildFileConfigsPayload(rows))
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
        }
      );

      const responseData = response.data;
      const filesProcessed = responseData.filesProcessed ?? rows.length;

      analytics.setIsAiAccepted?.(isChecked);
      analytics.setPendingUploadSuccess?.(true);

      if (analytics.refreshAnalyticsData) {
        await analytics.refreshAnalyticsData();
      }

      toast.success(
        `${filesProcessed} log${
          filesProcessed === 1 ? "" : "s"
        } uploaded successfully ✅`
      );

      resetForm();

      router.replace(`/dashboard?refresh=${Date.now()}`);
      router.refresh();
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        const responseData = err.response?.data as UploadResponse | undefined;

        if (status === 401) {
          router.replace("/login?redirect=/upload");
          return;
        }
        //Rewritten to submit the error handler to auto-correct 
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
               endDates:
                  row.endDates.length === 1 ? row.endDates : [""],
                error: buildRowErrorMessage(fileError),
              };
            })
          );

          const firstMessage =
            responseData.fileErrors.length === 1
              ? buildRowErrorMessage(responseData.fileErrors[0])
              : "Some files have incorrect dates. Check the suggested dates and try again.";

          setGeneralError(firstMessage);
          toast.error(firstMessage);
          return;
        }

        if (responseData?.error) {
          setGeneralError(responseData.error);
          toast.error(responseData.error);
          return;
        }
      }

      setGeneralError("Upload failed.");
      toast.error("Upload failed.");
    } finally {
      setLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="w-full max-w-sm">
        <div className="rounded-xl border p-4 text-sm text-muted-foreground">
          Checking access...
        </div>
      </div>
    );
  }
//* added in onBlur={() => handleEndDateBlur(row.uploadId) to trigger updateEndDate
  return (
    <div className="w-full max-w-5xl space-y-4">
      <form onSubmit={onSubmit} className="space-y-4">
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
  You can upload multiple files at once. The correct end date is detected
  from each log and shown in a badge — enter that date in the field below
  to enable upload.
</FieldDescription>
        </Field>

        {generalError && (
          <div className="rounded-xl border border-red-500/50 bg-red-500/5 p-3 text-sm text-red-600">
            {generalError}
          </div>
        )}

        {rows.length > 0 && (
          <div className="space-y-3 rounded-xl border p-4">
            <p className="font-medium">{selectedFileCountLabel}</p>

            <div className="space-y-4">
              {rows.map((row) => (
                <div
                  key={row.uploadId}
                  className="space-y-3 rounded-xl border p-4"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="break-words font-medium">{row.fileName}</p>
                      {row.detectedEndDates.length > 0 ? (
                        isRowValid(row) ? (
                          <p className="mt-1 inline-block rounded-md border border-green-500/40 bg-green-500/10 px-2 py-0.5 text-sm font-medium text-green-700 dark:text-green-400">
                            ✓ Correct end date{row.detectedEndDates.length === 1 ? "" : "s"}: {row.detectedEndDates.join(", ")}
                          </p>
                        ) : (
                          <p className="mt-1 inline-block rounded-md border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-sm font-medium text-red-700 dark:text-red-400">
                            ✗ Required end date{row.detectedEndDates.length === 1 ? "" : "s"} for this log: {row.detectedEndDates.join(", ")}
                          </p>
                        )
                      ) : detectingDates ? (
                        <p className="text-sm text-muted-foreground">
                          Detecting end dates from log...
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

                 {row.detectedEndDates.length > 0 && (
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
                        className={
                          row.endDates[0] && !row.detectedEndDates.includes(row.endDates[0])
                            ? "border-red-500/60 focus-visible:ring-red-500"
                            : ""
                        }
                      />
                      <FieldDescription>
                        {row.detectedEndDates.length > 1
                          ? "Required. Enter one of the dates shown in the badge above."
                          : "Required. Enter the date shown in the badge above."}
                      </FieldDescription>
                    </Field>
                  )}

                  {row.error && (
                    <FieldDescription className="text-red-500">
                      {row.error}
                    </FieldDescription>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

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

        <Button
          type="submit"
          disabled={
            loading || detectingDates || rows.length === 0 || hasInvalidDate
          }
          className="w-full cursor-pointer"
        >
          {loading
            ? "Uploading..."
            : hasInvalidDate
              ? "Enter the end date shown in the badge to upload"
              : "Upload"}
        </Button>
      </form>
    </div>
  );
}
