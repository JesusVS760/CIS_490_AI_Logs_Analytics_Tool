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
const inputFileSchema = z.object({
  inputFile: z
    .any()
    .refine((files) => files?.length === 1, "File is required")
    .refine(
      (files) => ACCEPTED_TYPES.includes(files?.[0]?.type),
      "Only PDF, DOC, and DOCX files are allowed"
    ),
});

type InputFormData = z.infer<typeof inputFileSchema>;

export function InputFile() {
  const [loading, setLoading] = useState(false);

  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<InputFormData>({
    resolver: zodResolver(inputFileSchema),
    mode: "onChange",
  });

  const onSubmit = async (data: InputFormData) => {
    try {
      setLoading(true);

      const formData = new FormData();
      formData.append("file", data.inputFile[0]);

      await axios.post("/api/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      toast("Successful Upload ✅");
      router.push("./dashboard");
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Field className="w-full max-w-sm">
        <FieldLabel htmlFor="inputFile">Upload Documents</FieldLabel>

        <Input
          id="inputFile"
          type="file"
          accept=".txt,.pdf"
          className="cursor-pointer"
          {...register("inputFile")}
        />

        {errors.inputFile && (
          <p className="text-red-500 text-sm mt-1">
            {errors.inputFile.message as string}
          </p>
        )}

        <Button
          type="submit"
          disabled={!isValid || loading}
          className="cursor-pointer"
        >
          {loading ? "Uploading..." : "Upload"}
        </Button>

        <FieldDescription>Select a transcript to upload.</FieldDescription>
      </Field>
    </form>
  );
}
