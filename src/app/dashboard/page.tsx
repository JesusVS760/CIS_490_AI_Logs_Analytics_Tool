"use client";
import AnalyticsDashboard from "@/components/dashboard/AnalyticsDashboard";
import TranscriptUpload from "@/components/upload/TranscriptUpload";
import { useState } from "react";

export default function DashboardPage() {
  const [showUpload, setShowUpload] = useState(false);

  return (
    <>
      <div>{showUpload ? <TranscriptUpload /> : <AnalyticsDashboard />}</div>
    </>
  );
}
