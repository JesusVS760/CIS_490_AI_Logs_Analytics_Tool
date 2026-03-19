"use client";
import AnalyticsDashboard from "@/components/dashboard/AnalyticsDashboard";
import TranscriptUpload from "@/components/upload/TranscriptUpload";
import axios from "axios";
import { createContext, useContext, useEffect, useState } from "react";

export const AiAnalyticsContext = createContext<any>({
  isAiAccepted: false,
  setIsAiAccepted: () => {},
});
export const useAiAnalytics = () => useContext(AiAnalyticsContext);

export default function DashboardPage() {
  const [hasSessions, setHasSessions] = useState<boolean | null>(null);
  const [isAiAccepted, setIsAiAccepted] = useState<boolean>(false);

  useEffect(() => {
    const checkUploadData = async () => {
      try {
        const response = await axios.get("/api/sessions");
        const sessions = response.data;

        if (sessions && sessions.length > 0) {
          setHasSessions(true);
        } else {
          setHasSessions(false);
        }
      } catch (error) {
        console.error("failed to fetch", error);
        setHasSessions(false);
      }
    };
    checkUploadData();
  }, []);

  return (
    <AiAnalyticsContext.Provider value={{ isAiAccepted, setIsAiAccepted }}>
      <div>
        {hasSessions ? (
          <AnalyticsDashboard />
        ) : (
          <div className="flex justify-center items-center min-h-screen">
            <TranscriptUpload />
          </div>
        )}
      </div>
    </AiAnalyticsContext.Provider>
  );
}
