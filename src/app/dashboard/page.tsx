"use client";
import TranscriptUpload from "@/components/upload/TranscriptUpload";
import { useState } from "react";

export default function DashboardPage() {
  const [showUpload, setShowUpload] = useState(false);

  return (
    <>
      <div>{showUpload ? <TranscriptUpload /> : <h1>dashboard</h1>}</div>
    </>
  );
}
