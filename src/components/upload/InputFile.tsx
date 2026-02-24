import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function InputFile() {
  return (
    <Field className="w-full max-w-sm">
      <FieldLabel htmlFor="picture">Upload Documents</FieldLabel>
      <Input id="picture" type="file" />
      <FieldDescription>Select a transcript to upload.</FieldDescription>
    </Field>
  );
}
