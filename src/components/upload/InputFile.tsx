//the allowment to choose date of assignment is best ulitized in this section(s) as well as the API
//and database
// Added assignment name, startDate and endDate to the upload form and API.
// This allows us to better organize the data and also to utilize the date of assignment for analytics purposes.
// The predetermined course is used to simplify the process for the user, as they don't have to select a course when uploading a file.
// The automatic migration ensures that older databases that don't have a start_date column can still function properly without any issues.

"use client";

import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useAiAnalytics } from "@/app/dashboard/page";
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

type AnalyticsBridge = Partial<{
  setIsAiAccepted: (value: boolean) => void;
  refreshAnalyticsData: () => Promise<void>;
  setPendingUploadSuccess: (value: boolean) => void;
}>;

type UploadRow = {
  uploadId: string;
  file: File;
  fileName: string;
  assignmentName: string;
  startDate: string;
  endDate: string;
  error: string;
};

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

export function InputFile() {
  const [loading, setLoading] = useState(false);
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

  const buildFileConfigsPayload = (targetRows: UploadRow[]) => {
    return targetRows.map((row) => ({
      uploadId: row.uploadId,
      fileName: row.fileName,
      assignmentName: row.assignmentName.trim() || undefined,
      startDate: row.startDate || undefined,
      endDate: row.endDate || undefined,
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);

    if (files.length === 0) return;

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
            assignmentName: "",
            startDate: "",
            endDate: "",
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

  const updateRow = (
    uploadId: string,
    field: "assignmentName" | "startDate" | "endDate",
    value: string
  ) => {
    setRows((prev) =>
      prev.map((row) =>
        row.uploadId === uploadId
          ? {
              ...row,
              [field]: value,
              error:
                field === "startDate" || field === "endDate" ? "" : row.error,
            }
          : row
      )
    );
  };

  const resetForm = () => {
    setRows([]);
    setGeneralError("");
    setIsChecked(false);
    analytics.setIsAiAccepted?.(false);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (loading) return;

    setGeneralError("");

    if (rows.length === 0) {
      toast.error("At least one file is required.");
      return;
    }

    const clientSideIssues = rows
      .map((row) => {
        if (
          row.startDate &&
          row.endDate &&
          new Date(row.startDate) > new Date(row.endDate)
        ) {
          return {
            uploadId: row.uploadId,
            message: `${row.fileName}: end date must be after the start date.`,
          };
        }
        return null;
      })
      .filter(Boolean) as Array<{ uploadId: string; message: string }>;

    if (clientSideIssues.length > 0) {
      const issueMap = new Map(
        clientSideIssues.map((item) => [item.uploadId, item.message])
      );

      setRows((prev) =>
        prev.map((row) => ({
          ...row,
          error: issueMap.get(row.uploadId) || row.error,
        }))
      );

      toast.error(clientSideIssues[0].message);
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

      const response = await axios.post<UploadResponse>("/api/upload", formData, {
        withCredentials: true,
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      const responseData = response.data;
      const filesProcessed = responseData.filesProcessed ?? rows.length;

      analytics.setIsAiAccepted?.(isChecked);
      analytics.setPendingUploadSuccess?.(true);

      if (analytics.refreshAnalyticsData) {
        await analytics.refreshAnalyticsData();
      }

      toast.success(
        `${filesProcessed} log${filesProcessed === 1 ? "" : "s"} uploaded successfully ✅`
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

        if (responseData?.fileErrors?.length) {
          const errorMap = new Map<string, FileValidationError>();

          for (const fileError of responseData.fileErrors) {
            const key = fileError.uploadId || fileError.fileName || "";
            if (key) errorMap.set(key, fileError);
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

              const nextEndDate =
                nextExpectedDates.length === 1
                  ? nextExpectedDates[0]
                  : row.endDate;

              return {
                ...row,
                endDate: nextEndDate,
                error: buildRowErrorMessage(fileError),
              };
            })
          );

          const firstMessage =
            responseData.fileErrors.length === 1
              ? `${buildRowErrorMessage(
                  responseData.fileErrors[0]
                )} Please enter the correct date based on the uploaded log.`
              : "Some files have incorrect dates. Please enter the correct dates based on the uploaded logs.";

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
            You can upload multiple files at once. Leave start/end dates blank to
            use the dates found in the uploaded logs. If you type a date and it
            does not match the log, you will be prompted to enter the correct
            date from the uploaded log.
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
                  className="rounded-xl border p-4 space-y-3"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-medium break-words">{row.fileName}</p>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => removeFile(row.uploadId)}
                      disabled={loading}
                    >
                      Remove
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                    <Field>
                      <FieldLabel htmlFor={`assignment-${row.uploadId}`}>
                        Assignment Name
                      </FieldLabel>
                      <Input
                        id={`assignment-${row.uploadId}`}
                        type="text"
                        value={row.assignmentName}
                        placeholder="Optional"
                        onChange={(e) =>
                          updateRow(
                            row.uploadId,
                            "assignmentName",
                            e.target.value
                          )
                        }
                      />
                    </Field>

                    <Field>
                      <FieldLabel htmlFor={`start-${row.uploadId}`}>
                        Assignment Start Date
                      </FieldLabel>
                      <Input
                        id={`start-${row.uploadId}`}
                        type="date"
                        value={row.startDate}
                        onChange={(e) =>
                          updateRow(row.uploadId, "startDate", e.target.value)
                        }
                      />
                    </Field>

                    <Field>
                      <FieldLabel htmlFor={`end-${row.uploadId}`}>
                        Assignment End Date
                      </FieldLabel>
                      <Input
                        id={`end-${row.uploadId}`}
                        type="date"
                        value={row.endDate}
                        onChange={(e) =>
                          updateRow(row.uploadId, "endDate", e.target.value)
                        }
                        className={
                          row.error
                            ? "border-red-500 focus-visible:ring-red-500"
                            : ""
                        }
                      />
                    </Field>
                  </div>

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
          disabled={loading || rows.length === 0}
          className="w-full cursor-pointer"
        >
          {loading ? "Uploading..." : "Upload"}
        </Button>
      </form>
    </div>
  );
}