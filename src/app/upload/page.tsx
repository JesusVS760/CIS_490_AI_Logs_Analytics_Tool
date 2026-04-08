import { requireAuthPage } from "@/lib/requireAuthPage";
import TranscriptUpload from "@/components/upload/TranscriptUpload";

export default async function UploadPage() {
  await requireAuthPage();

  return (
    <div className="flex items-center justify-center h-full flex-1 grow">
      <TranscriptUpload />
    </div>
  );
}