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
import { useState } from "react";
import axios from "axios";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

const ACCEPTED_TYPES = ["text/plain", "application/pdf"];

const inputFileSchema = z
  .object({
    assignmentName: z
      .string()
      .min(1, "Assignment name is required")
      .max(100, "Assignment name is too long"),

    startDate: z.string().min(1, "Start date is required"),

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

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    reset,
  } = useForm<InputFormData>({
    resolver: zodResolver(inputFileSchema),
    mode: "onChange",
    defaultValues: {
      assignmentName: "",
      startDate: "",
      endDate: "",
    },
  });

  const onSubmit = async (data: InputFormData) => {
    try {
      setLoading(true);

      const formData = new FormData();
      formData.append("file", data.inputFile[0]);
      formData.append("assignmentName", data.assignmentName);
      formData.append("startDate", data.startDate);
      formData.append("endDate", data.endDate);

      await axios.post("/api/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      toast("Successful Upload ✅");
      reset();
      router.push("/dashboard");
    } catch (err) {
      console.error(err);
      toast("Upload failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="w-full max-w-sm space-y-4">
      <Field>
        <FieldLabel htmlFor="assignmentName">Assignment Name</FieldLabel>
        <Input
          id="assignmentName"
          type="text"
          placeholder="Homework 1"
          {...register("assignmentName")}
        />
        {errors.assignmentName && (
          <p className="mt-1 text-sm text-red-500">
            {errors.assignmentName.message}
          </p>
        )}
      </Field>

      <Field>
        <FieldLabel htmlFor="startDate">Assignment Start Date</FieldLabel>
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
          Select a transcript file to upload.
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
  );
}