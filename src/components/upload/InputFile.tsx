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
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

const ACCEPTED_TYPES = ["text/plain", "application/pdf"];
const UPLOAD_DRAFT_KEY = "uploadFormDraft";

const inputFileSchema = z
  .object({
    assignmentName: z
      .string()
      .max(100, "Assignment name is too long")
      .optional()
      .or(z.literal("")),

    startDate: z.string().optional().or(z.literal("")),

    endDate: z.string().min(1, "End date is required"),

    inputFile: z
      .any()
      .refine((files) => files?.length === 1, "File is required")
      .refine(
        (files) => ACCEPTED_TYPES.includes(files?.[0]?.type),
        "Only TXT and PDF files are allowed"
      ),
  })
  .refine(
    (data) => {
      if (!data.startDate || !data.endDate) return true;
      return new Date(data.startDate) <= new Date(data.endDate);
    },
    {
      message: "End date must be after the start date",
      path: ["endDate"],
    }
  );

type InputFormData = z.infer<typeof inputFileSchema>;

export function InputFile() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const lastDateToastRef = useRef<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    reset,
    watch,
    setValue,
  } = useForm<InputFormData>({
    resolver: zodResolver(inputFileSchema),
    mode: "onChange",
    defaultValues: {
      assignmentName: "",
      startDate: "",
      endDate: "",
    },
  });

  const assignmentNameValue = watch("assignmentName");
  const startDateValue = watch("startDate");
  const endDateValue = watch("endDate");

  useEffect(() => {
    const savedDraft = sessionStorage.getItem(UPLOAD_DRAFT_KEY);

    if (!savedDraft) return;

    try {
      const parsed = JSON.parse(savedDraft) as {
        assignmentName?: string;
        startDate?: string;
        endDate?: string;
      };

      if (parsed.assignmentName) {
        setValue("assignmentName", parsed.assignmentName, {
          shouldValidate: true,
        });
      }

      if (parsed.startDate) {
        setValue("startDate", parsed.startDate, {
          shouldValidate: true,
        });
      }

      if (parsed.endDate) {
        setValue("endDate", parsed.endDate, {
          shouldValidate: true,
        });
      }
    } catch {
      sessionStorage.removeItem(UPLOAD_DRAFT_KEY);
    }
  }, [setValue]);

  useEffect(() => {
    if (!startDateValue || !endDateValue) {
      lastDateToastRef.current = null;
      return;
    }

    if (new Date(startDateValue) > new Date(endDateValue)) {
      const message = "End date must be after the start date";
      if (lastDateToastRef.current !== message) {
        toast.error(message);
        lastDateToastRef.current = message;
      }
    } else {
      lastDateToastRef.current = null;
    }
  }, [startDateValue, endDateValue]);

  const saveDraft = () => {
    sessionStorage.setItem(
      UPLOAD_DRAFT_KEY,
      JSON.stringify({
        assignmentName: assignmentNameValue ?? "",
        startDate: startDateValue ?? "",
        endDate: endDateValue ?? "",
      })
    );
  };

  const clearDraft = () => {
    sessionStorage.removeItem(UPLOAD_DRAFT_KEY);
  };

  const onSubmit = async (data: InputFormData) => {
    try {
      setLoading(true);

      try {
        await axios.get("/api/auth/me");
      } catch (authErr) {
        if (axios.isAxiosError(authErr) && authErr.response?.status === 401) {
          saveDraft();
          toast.info("Please sign in first. You'll return to the upload page.");
          router.push("/login?redirect=/upload");
          return;
        }

        throw authErr;
      }

      const formData = new FormData();
      formData.append("file", data.inputFile[0]);

      if (data.assignmentName?.trim()) {
        formData.append("assignmentName", data.assignmentName.trim());
      }

      if (data.startDate) {
        formData.append("startDate", data.startDate);
      }

      formData.append("endDate", data.endDate);

      const response = await axios.post("/api/upload", formData);

      clearDraft();
      toast.success("Successful Upload ✅");
      reset();
      router.push("/dashboard");

      return response.data;
    } catch (err) {
      console.error("Upload failed:", err);

      if (axios.isAxiosError(err)) {
        const backendMessage =
          typeof err.response?.data?.error === "string"
            ? err.response.data.error
            : null;

        if (err.response?.status === 400 && backendMessage) {
          toast.error(backendMessage);
          return;
        }

        if (err.response?.status === 401) {
          saveDraft();
          toast.info("Please sign in first. You'll return to the upload page.");
          router.push("/login?redirect=/upload");
          return;
        }

        if (backendMessage) {
          toast.error(backendMessage);
          return;
        }
      }

      toast.error("Upload failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm space-y-4">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Field>
          <FieldLabel htmlFor="assignmentName">
            Assignment Name <span className="text-muted-foreground">(optional)</span>
          </FieldLabel>
          <Input
            id="assignmentName"
            type="text"
            placeholder="Leave blank to use log info"
            {...register("assignmentName")}
          />
          {errors.assignmentName && (
            <p className="mt-1 text-sm text-red-500">
              {errors.assignmentName.message}
            </p>
          )}
        </Field>

        <Field>
          <FieldLabel htmlFor="startDate">
            Assignment Start Date <span className="text-muted-foreground">(optional)</span>
          </FieldLabel>
          <Input id="startDate" type="date" {...register("startDate")} />
          {errors.startDate && (
            <p className="mt-1 text-sm text-red-500">
              {errors.startDate.message}
            </p>
          )}
        </Field>

        <Field>
          <FieldLabel htmlFor="endDate">Assignment End Date</FieldLabel>
          <Input id="endDate" type="date" {...register("endDate")} />
          {errors.endDate && (
            <p className="mt-1 text-sm text-red-500">
              {errors.endDate.message}
            </p>
          )}
        </Field>

        <Field>
          <FieldLabel htmlFor="inputFile">Upload Documents</FieldLabel>
          <Input
            id="inputFile"
            type="file"
            accept=".txt,.pdf"
            className="cursor-pointer"
            {...register("inputFile")}
          />
          {errors.inputFile && (
            <p className="mt-1 text-sm text-red-500">
              {errors.inputFile.message as string}
            </p>
          )}
          <FieldDescription>
            Select a transcript file to upload. If assignment name or start date
            are blank, use the logs for that information.
          </FieldDescription>
        </Field>

        <Button
          type="submit"
          disabled={!isValid || loading}
          className="w-full cursor-pointer"
        >
          {loading ? "Uploading..." : "Upload"}
        </Button>
      </form>
    </div>
  );
}