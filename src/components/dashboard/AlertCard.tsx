import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { InfoIcon } from "lucide-react";

export function AlertCard() {
  return (
    <div className="grid w-full max-w-md items-start gap-4">
      <Alert>
        <InfoIcon />
        <AlertTitle>New feature available</AlertTitle>
        <AlertDescription>
          We&apos;ve added dark mode support. You can enable it in your account
          settings.
        </AlertDescription>
      </Alert>
    </div>
  );
}
