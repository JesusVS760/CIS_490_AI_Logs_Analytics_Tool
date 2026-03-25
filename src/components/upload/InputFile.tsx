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
  expectedEndDate?: string;
  error?: string;
  fileErrors?: FileValidationError[];
  aiAnalyzerOptIn?: boolean;
  files?: Array<{
    uploadId?: string;
    fileName?: string;
    detectedEndDate?: string;
    suggestedEndDates?: string[];
    detectedStartDate?: string;
    assignmentName?: string;
    startDate?: string;
    endDate?: string;
  }>;
};

type AnalyticsBridge = Partial<{
  setIsAiAccepted: (value: boolean) => void;
  refreshAnalyticsData: () => Promise<void>;
  setPendingUploadSuccess: (value: boolean) => void;
}>;

function isAcceptedFile(file: File) {
  const fileName = file.name.toLowerCase();
  return (
    ACCEPTED_TYPES.includes(file.type) ||
    ACCEPTED_EXTENSIONS.some((ext) => fileName.endsWith(ext))
  );
}

function uniqueStrings(values: Array<string | undefined | null>) {
  return Array.from(new Set(values.filter(Boolean) as string[]));
}

export function InputFile() {
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [assignmentName, setAssignmentName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [endDateError, setEndDateError] = useState("");
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
    return `${selectedFiles.length} file${selectedFiles.length === 1 ? "" : "s"} selected`;
  }, [selectedFiles]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);

    if (files.length === 0) return;

    const invalidFile = files.find((file) => !isAcceptedFile(file));
    if (invalidFile) {
      toast.error("Only TXT and PDF files are allowed.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setSelectedFiles((prev) => {
      const merged = [...prev];

      for (const file of files) {
        const exists = merged.some(
          (f) =>
            f.name === file.name &&
            f.size === file.size &&
            f.lastModified === file.lastModified
        );

        if (!exists) {
          merged.push(file);
        }
      }

      return merged;
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeFile = (indexToRemove: number) => {
    setSelectedFiles((prev) =>
      prev.filter((_, index) => index !== indexToRemove)
    );
  };

  const resetForm = () => {
    setAssignmentName("");
    setStartDate("");
    setEndDate("");
    setEndDateError("");
    setSelectedFiles([]);
    setIsChecked(false);
    analytics.setIsAiAccepted?.(false);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const buildFileErrorMessage = (fileErrors: FileValidationError[]) => {
    const lines = fileErrors.map((fileError) => {
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
        return `${fileName}: detected multiple log dates (${logDates.join(
          ", "
        )}).`;
      }

      return `${fileName}: invalid log date data.`;
    });

    return lines.join(" ");
  };

  const tryAutofillEndDateFromErrors = (fileErrors: FileValidationError[]) => {
    const singleExpectedDates = uniqueStrings([
      ...fileErrors.map((fileError) => fileError.expectedEndDate),
      ...fileErrors.flatMap((fileError) => fileError.expectedEndDates || []),
    ]);

    if (singleExpectedDates.length === 1) {
      const suggestedDate = singleExpectedDates[0];
      setEndDate(suggestedDate);
      return suggestedDate;
    }

    return "";
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (loading) return;

    setEndDateError("");

    if (selectedFiles.length === 0) {
      toast.error("At least one file is required.");
      return;
    }

    if (!endDate) {
      setEndDateError("Assignment end date is required.");
      toast.error("Assignment end date is required.");
      return;
    }

    if (startDate && new Date(startDate) > new Date(endDate)) {
      setEndDateError("End date must be after the start date.");
      toast.error("End date must be after the start date.");
      return;
    }

    try {
      setLoading(true);

      const formData = new FormData();

      for (const file of selectedFiles) {
        formData.append("files", file);
      }

      if (assignmentName.trim()) {
        formData.append("assignmentName", assignmentName.trim());
      }

      if (startDate) {
        formData.append("startDate", startDate);
      }

      formData.append("endDate", endDate);
      formData.append("aiAnalyzerOptIn", String(isChecked));

      const response = await axios.post<UploadResponse>("/api/upload", formData, {
        withCredentials: true,
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      const responseData = response.data;
      const filesProcessed = responseData.filesProcessed ?? selectedFiles.length;

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
          const suggestedDate = tryAutofillEndDateFromErrors(
            responseData.fileErrors
          );
          const combinedMessage = buildFileErrorMessage(responseData.fileErrors);

          if (suggestedDate) {
            const message = `${combinedMessage} Suggested date applied: ${suggestedDate}.`;
            setEndDateError(message);
            toast.error(message);
            return;
          }

          setEndDateError(combinedMessage);
          toast.error(combinedMessage);
          return;
        }

        if (responseData?.expectedEndDate) {
          const suggestedDate = responseData.expectedEndDate;
          const message = `Incorrect end date. Suggested date: ${suggestedDate}.`;

          setEndDate(suggestedDate);
          setEndDateError(message);
          toast.error(message);
          return;
        }

        if (responseData?.error) {
          if (responseData.error.toLowerCase().includes("end date")) {
            setEndDateError(responseData.error);
          }
          toast.error(responseData.error);
          return;
        }
      }

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
          <FieldLabel htmlFor="endDate">Assignment End Date</FieldLabel>
          <Input
            id="endDate"
            type="date"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              if (endDateError) setEndDateError("");
            }}
            className={
              endDateError ? "border-red-500 focus-visible:ring-red-500" : ""
            }
          />
          {endDateError && (
            <FieldDescription className="text-red-500">
              {endDateError}
            </FieldDescription>
          )}
          <FieldDescription>
            If you upload files from different assignments with different real
            due dates in one batch, upload those separately.
          </FieldDescription>
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
            Select multiple files at once, or keep adding files in separate
            picks before uploading.
          </FieldDescription>

          {selectedFiles.length > 0 && (
            <div className="mt-2 rounded-xl border p-3 text-sm">
              <p className="font-medium">{selectedFileCountLabel}</p>

              <ul className="mt-2 space-y-2 text-muted-foreground">
                {selectedFiles.map((file, index) => (
                  <li
                    key={`${file.name}-${file.size}-${file.lastModified}`}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="truncate">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      className="text-sm text-red-500 hover:underline"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Field>

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
          disabled={loading || selectedFiles.length === 0 || !endDate}
          className="w-full cursor-pointer"
        >
          {loading ? "Uploading..." : "Upload"}
        </Button>
      </form>
    </div>
  );
}

//check to upload to github, didnt work earlier