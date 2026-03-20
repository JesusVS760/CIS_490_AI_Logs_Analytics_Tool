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
import { useEffect, useRef, useState } from "react";
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

type DetectFileResult = {
  uploadId?: string;
  fileName?: string;
  detectedEndDate?: string;
  suggestedEndDates?: string[];
  detectedStartDate?: string;
};

type UploadResponse = {
  success?: boolean;
  filesProcessed?: number;
  error?: string;
  fileErrors?: FileValidationError[];
  files?: DetectFileResult[];
  aiAnalyzerOptIn?: boolean;
};

type SelectedUpload = {
  id: string;
  file: File;
  endDate: string;
  detectedEndDate: string;
  suggestedEndDates: string[];
};

function isAcceptedFile(file: File) {
  const fileName = file.name.toLowerCase();
  return (
    ACCEPTED_TYPES.includes(file.type) ||
    ACCEPTED_EXTENSIONS.some((ext) => fileName.endsWith(ext))
  );
}

function buildFileId(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

function uniqueSortedDates(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter(Boolean) as string[])).sort();
}

export function InputFile() {
  const [loading, setLoading] = useState(false);
  const [detectingDates, setDetectingDates] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [assignmentName, setAssignmentName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<SelectedUpload[]>([]);
  const [fileEndDateErrors, setFileEndDateErrors] = useState<
    Record<string, string>
  >({});
  const [aiAnalyzerOptIn, setAiAnalyzerOptIn] = useState(false);

  const { isAiAccepted, setIsAiAccepted } = useAiAnalytics();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const router = useRouter();

  useEffect(() => {
    setAiAnalyzerOptIn(Boolean(isAiAccepted));
  }, [isAiAccepted]);

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

  const handleAiAnalyzerToggle = (checked: boolean) => {
    const nextValue = Boolean(checked);
    setAiAnalyzerOptIn(nextValue);
    setIsAiAccepted(nextValue);
  };

  const clearFileError = (fileId: string) => {
    setFileEndDateErrors((prev) => {
      if (!prev[fileId]) return prev;
      const next = { ...prev };
      delete next[fileId];
      return next;
    });
  };

  const applyDetectionResults = (
    detectedFiles: DetectFileResult[],
    fileErrors: FileValidationError[] = []
  ) => {
    const nextErrors: Record<string, string> = {};

    setSelectedFiles((prev) =>
      prev.map((item) => {
        const detected =
          detectedFiles.find(
            (file) =>
              file.uploadId === item.id || file.fileName === item.file.name
          ) ?? null;

        const matchingError =
          fileErrors.find(
            (fileError) =>
              fileError.uploadId === item.id ||
              fileError.fileName === item.file.name
          ) ?? null;

        if (matchingError?.error) {
          nextErrors[item.id] = matchingError.error;
        }

        if (!detected) {
          return item;
        }

        const detectedSuggestions = uniqueSortedDates([
          ...(detected.suggestedEndDates || []),
          detected.detectedEndDate,
        ]);

        return {
          ...item,
          endDate: item.endDate || detected.detectedEndDate || "",
          detectedEndDate: detected.detectedEndDate || item.detectedEndDate,
          suggestedEndDates:
            detectedSuggestions.length > 0
              ? detectedSuggestions
              : item.suggestedEndDates,
        };
      })
    );

    setFileEndDateErrors(nextErrors);
  };

  const detectDatesFromLogs = async (filesToCheck: SelectedUpload[]) => {
    if (filesToCheck.length === 0) {
      return;
    }

    try {
      setDetectingDates(true);

      const formData = new FormData();

      for (const item of filesToCheck) {
        formData.append("files", item.file);
      }

      formData.append("detectDatesOnly", "true");

      if (assignmentName.trim()) {
        formData.append("assignmentName", assignmentName.trim());
      }

      if (startDate) {
        formData.append("startDate", startDate);
      }

      formData.append("aiAnalyzerOptIn", String(aiAnalyzerOptIn));

      const response = await axios.post("/api/upload", formData, {
        withCredentials: true,
      });

      const responseData = response.data as UploadResponse;
      const detectedFiles = Array.isArray(responseData.files)
        ? responseData.files
        : [];
      const fileErrors = Array.isArray(responseData.fileErrors)
        ? responseData.fileErrors
        : [];

      applyDetectionResults(detectedFiles, fileErrors);

      if (detectedFiles.length > 0) {
        toast.success("Detected end dates from the logs");
      } else if (fileErrors.length > 0) {
        toast.error("Could not detect dates for one or more files");
      } else {
        toast.error("No dates were detected");
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        const responseData = err.response?.data as UploadResponse | undefined;

        if (status === 401) {
          router.replace("/login?redirect=/upload");
          return;
        }

        if (responseData?.fileErrors?.length || responseData?.files?.length) {
          applyDetectionResults(
            responseData.files ?? [],
            responseData.fileErrors ?? []
          );
          toast.error(responseData.error || "Some files need attention");
          return;
        }

        if (responseData?.error) {
          toast.error(responseData.error);
          return;
        }
      }

      toast.error("Could not detect dates from logs");
    } finally {
      setDetectingDates(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);

    if (files.length === 0) return;

    const invalidFile = files.find((file) => !isAcceptedFile(file));
    if (invalidFile) {
      toast.error("Only TXT and PDF files are allowed");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const existingIds = new Set(selectedFiles.map((item) => item.id));

    const newItems: SelectedUpload[] = files
      .filter((file) => !existingIds.has(buildFileId(file)))
      .map((file) => ({
        id: buildFileId(file),
        file,
        endDate: "",
        detectedEndDate: "",
        suggestedEndDates: [],
      }));

    const nextFiles = [...selectedFiles, ...newItems];
    setSelectedFiles(nextFiles);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    if (newItems.length > 0) {
      await detectDatesFromLogs(nextFiles);
    }
  };

  const removeFile = (idToRemove: string) => {
    setSelectedFiles((prev) => prev.filter((item) => item.id !== idToRemove));
    clearFileError(idToRemove);
  };

  const updateFileEndDate = (id: string, value: string) => {
    setSelectedFiles((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              endDate: value,
            }
          : item
      )
    );

    clearFileError(id);
  };

  const applySuggestedDateToFile = (fileId: string, date: string) => {
    updateFileEndDate(fileId, date);
  };

  const autofillDetectedDates = () => {
    let applied = 0;

    setSelectedFiles((prev) =>
      prev.map((item) => {
        const fallbackSuggestion =
          item.suggestedEndDates[item.suggestedEndDates.length - 1] ?? "";
        const detectedDate = item.detectedEndDate || fallbackSuggestion;

        if (!detectedDate) {
          return item;
        }

        applied += 1;

        return {
          ...item,
          endDate: detectedDate,
        };
      })
    );

    setFileEndDateErrors({});

    if (applied === 0) {
      toast.error("No detected dates are available yet");
      return;
    }

    toast.success(
      `Autofilled ${applied} file${applied === 1 ? "" : "s"} with detected dates`
    );
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFileEndDateErrors({});

    if (selectedFiles.length === 0) {
      toast.error("At least one file is required");
      return;
    }

    const missingEndDates = selectedFiles.filter((item) => !item.endDate);

    if (missingEndDates.length > 0) {
      const nextErrors: Record<string, string> = {};

      for (const item of missingEndDates) {
        nextErrors[item.id] =
          "No end date is set for this file. Use the detected date or choose one of the suggested log dates.";
      }

      setFileEndDateErrors(nextErrors);
      toast.error("Each file needs an end date before upload");
      return;
    }

    if (startDate) {
      const invalidDateOrder = selectedFiles.filter(
        (item) => new Date(startDate) > new Date(item.endDate)
      );

      if (invalidDateOrder.length > 0) {
        const nextErrors: Record<string, string> = {};

        for (const item of invalidDateOrder) {
          nextErrors[item.id] = "End date must be after the start date";
        }

        setFileEndDateErrors(nextErrors);
        toast.error("One or more end dates are before the start date");
        return;
      }
    }

    try {
      setLoading(true);

      const formData = new FormData();

      for (const item of selectedFiles) {
        formData.append("files", item.file);
      }

      formData.append(
        "fileConfigs",
        JSON.stringify(
          selectedFiles.map((item) => ({
            uploadId: item.id,
            fileName: item.file.name,
            endDate: item.endDate,
          }))
        )
      );

      if (assignmentName.trim()) {
        formData.append("assignmentName", assignmentName.trim());
      }

      if (startDate) {
        formData.append("startDate", startDate);
      }

      formData.append("aiAnalyzerOptIn", String(aiAnalyzerOptIn));

      const response = await axios.post("/api/upload", formData, {
        withCredentials: true,
      });

      const responseData = response.data as UploadResponse;
      const filesProcessed = responseData.filesProcessed ?? selectedFiles.length;

      if (typeof responseData.aiAnalyzerOptIn === "boolean") {
        setAiAnalyzerOptIn(responseData.aiAnalyzerOptIn);
        setIsAiAccepted(responseData.aiAnalyzerOptIn);
      } else {
        setIsAiAccepted(aiAnalyzerOptIn);
      }

      toast.success(
        `${filesProcessed} log${filesProcessed === 1 ? "" : "s"} uploaded successfully ✅`
      );

      setAssignmentName("");
      setStartDate("");
      setSelectedFiles([]);
      setFileEndDateErrors({});

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      if (typeof window !== "undefined") {
        sessionStorage.setItem("logs-uploaded-at", String(Date.now()));
        window.dispatchEvent(new Event("logs-uploaded"));
      }

      router.push("/dashboard");
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
          const nextErrors: Record<string, string> = {};

          setSelectedFiles((prev) =>
            prev.map((item) => {
              const matchingError =
                responseData.fileErrors?.find(
                  (fileError) =>
                    fileError.uploadId === item.id ||
                    fileError.fileName === item.file.name
                ) ?? null;

              if (!matchingError) {
                return item;
              }

              const suggestions = uniqueSortedDates([
                ...(matchingError.expectedEndDates || []),
                matchingError.expectedEndDate,
                ...(matchingError.logDates || []),
              ]);

              nextErrors[item.id] =
                matchingError.error || "Invalid data for this file";

              return {
                ...item,
                detectedEndDate:
                  item.detectedEndDate ||
                  matchingError.expectedEndDate ||
                  item.detectedEndDate,
                suggestedEndDates:
                  suggestions.length > 0 ? suggestions : item.suggestedEndDates,
              };
            })
          );

          setFileEndDateErrors(nextErrors);
          toast.error("Please review the highlighted file dates");
          return;
        }

        if (responseData?.error) {
          toast.error(responseData.error);
          return;
        }
      }

      toast.error("Upload failed");
    } finally {
      setLoading(false);
    }
  };

  const hasDetectedDates = selectedFiles.some(
    (item) => item.detectedEndDate || item.suggestedEndDates.length > 0
  );

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
    <div className="w-full max-w-sm space-y-4">
      <form onSubmit={onSubmit} className="space-y-4">
        <Field>
          <FieldLabel htmlFor="assignmentName">
            Assignment Name{" "}
            <span className="text-muted-foreground">(optional)</span>
          </FieldLabel>
          <Input
            id="assignmentName"
            type="text"
            placeholder="Leave blank to use log info"
            value={assignmentName}
            onChange={(e) => setAssignmentName(e.target.value)}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="startDate">
            Assignment Start Date{" "}
            <span className="text-muted-foreground">(optional)</span>
          </FieldLabel>
          <Input
            id="startDate"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </Field>

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
            End dates are detected from the logs automatically after you select
            files.
          </FieldDescription>

          {selectedFiles.length > 0 && (
            <div className="mt-2 rounded-xl border p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">
                  {selectedFiles.length} file
                  {selectedFiles.length === 1 ? "" : "s"} selected
                </p>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => detectDatesFromLogs(selectedFiles)}
                  disabled={detectingDates || loading}
                >
                  {detectingDates ? "Detecting..." : "Redetect Dates"}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={autofillDetectedDates}
                  disabled={!hasDetectedDates || detectingDates || loading}
                >
                  Autofill Detected Dates
                </Button>
              </div>

              <div className="mt-3 space-y-3">
                {selectedFiles.map((item) => (
                  <div key={item.id} className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium">
                        {item.file.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeFile(item.id)}
                        className="text-sm text-red-500 hover:underline"
                      >
                        Remove
                      </button>
                    </div>

                    {item.detectedEndDate && (
                      <p className="text-xs text-muted-foreground">
                        Detected from log: {item.detectedEndDate}
                      </p>
                    )}

                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">
                        End date for this file
                      </label>
                      <Input
                        type="date"
                        value={item.endDate}
                        onChange={(e) =>
                          updateFileEndDate(item.id, e.target.value)
                        }
                        className={
                          fileEndDateErrors[item.id]
                            ? "border-red-500 focus-visible:ring-red-500"
                            : ""
                        }
                      />
                      {fileEndDateErrors[item.id] && (
                        <p className="text-xs text-red-500">
                          {fileEndDateErrors[item.id]}
                        </p>
                      )}
                    </div>

                    {item.suggestedEndDates.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">
                          Dates found in this log:
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {item.suggestedEndDates.map((date) => (
                            <button
                              key={`${item.id}-${date}`}
                              type="button"
                              onClick={() =>
                                applySuggestedDateToFile(item.id, date)
                              }
                              className="rounded-full border px-3 py-1 text-xs hover:bg-muted"
                            >
                              Use {date}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </Field>

        <div className="flex flex-row items-center gap-2">
          <Switch
            checked={aiAnalyzerOptIn}
            onCheckedChange={handleAiAnalyzerToggle}
          />
          <span>Opt in for AI Analyzer</span>
        </div>

        <Button
          type="submit"
          disabled={loading || detectingDates || selectedFiles.length === 0}
          className="w-full cursor-pointer"
        >
          {loading ? "Uploading..." : "Upload"}
        </Button>
      </form>
    </div>
  );
}