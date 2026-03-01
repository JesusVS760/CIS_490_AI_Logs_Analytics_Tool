"use client";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button"; 
import { useState } from "react";

export function InputFile() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [formData, setFormData] = useState({});
  const [isError, setIsError] = useState(false);

  const handleChange = (e: any) => {
    setFormData(e.target.value);
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();

    // call to route
    try {
      const response = await fetch("https://api.example.com/data");
      if (!response) {
        setIsError(true);
      }
      const result = await response.json();

      console.log(result);
    } catch (error) {}
  };
  return (
    <form onSubmit={handleSubmit}>
      <Field className="w-full max-w-sm">
        <FieldLabel htmlFor="picture">Upload Documents</FieldLabel>
        <Input
          id="picture"
          type="file"
          className="cursor-pointer"
          onChange={handleChange}
        />
        <Button type="submit">Upload</Button>
        <FieldDescription>Select a transcript to upload.</FieldDescription>
      </Field>
    </form>
  );
}
