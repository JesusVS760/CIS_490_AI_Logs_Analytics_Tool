"use client";
import TranscriptUpload from "@/components/upload/TranscriptUpload";
import { useState } from "react";

export default function DashboardPage() {
  const [showUpload, setShowUpload] = useState(false);

  return (
    <div className="flex items-center justify-center h-full flex-1 grow">
      {showUpload ? <TranscriptUpload /> : <h1>dashboard</h1>}
    </div>
  );
}
