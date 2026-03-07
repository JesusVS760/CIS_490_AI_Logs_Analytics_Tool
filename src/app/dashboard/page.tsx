"use client";
import AnalyticsDashboard from "@/components/dashboard/AnalyticsDashboard";
import TranscriptUpload from "@/components/upload/TranscriptUpload";
import CountTracker from "@/lib/CountTracker";
import phraseCountTracker from "@/lib/CountTracker";
import axios from "axios";
import { useEffect, useState } from "react";

export default function DashboardPage() {
  const [hasSessions, setHasSessions] = useState<boolean | null>(null);

  useEffect(() => {
    const checkUploadData = async () => {
      try {
        const response = await axios.get("./api/sessions");
        console.log("Response", response);
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

  // useEffect(() => {
  //   const fetchMessages = async () => {
  //     try {
  //       const response = await axios.get("./api/messages");
  //       const messages = response.data;
  //       // console.log("messages", messages);
  //       CountTracker(messages);
  //     } catch (error) {
  //       console.error("failed to fetch", error);
  //     }
  //   };
  //   fetchMessages();
  // }, []);

  return (
    <>
      <div>
        {hasSessions ? (
          <AnalyticsDashboard />
        ) : (
          <div className="flex justify-center items-center min-h-screen">
            <TranscriptUpload />
          </div>
        )}
      </div>
    </>
  );
}
