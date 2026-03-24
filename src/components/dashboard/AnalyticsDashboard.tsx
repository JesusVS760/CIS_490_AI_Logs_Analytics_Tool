//Way its setup currently, AnalyticsDashboard will upload the log messages and passes
//them to UniqueUsersCard
//Will render AnalyticsDashboard as normally

"use client";

import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import ChatDuration from "./ChatDuration";
import UniqueUsersCard from "./UniqueUsersCard";
import { Message } from "@/types";
import { WordCloudCard } from "./WordCloud";
import TopQuestionCard from "./TopQuestionCard";
import TodaysTrafficCard from "./TodaysTrafficCard";
import TimeOfDayCard from "./TimeOfDayCard";
import WorkedDatesDueDateCard from "./WorkedDatesDueDateCard";
import MessagesPerConversation from "./MessagesPerConversation";
import TrafficPerDayCard from "./TrafficPerDayCard";
import UniqueStudentTotalMsgCard from "./UniqueStudentTotalMsgCard";
import MessagesPerAssignmentCard from "./MessagesPerAssignmentCard";


const AnalyticsDashboard = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await axios.get("/api/messages", {
        params: {
          t: Date.now(),
        },
      });

      setMessages(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to fetch messages:", err);
      setMessages([]);
    }
  }, []);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages, refreshKey]);

  useEffect(() => {
    const handleLogsUploaded = () => {
      setRefreshKey((prev) => prev + 1);
    };

    window.addEventListener("logs-uploaded", handleLogsUploaded);

    const uploadedAt = sessionStorage.getItem("logs-uploaded-at");
    if (uploadedAt) {
      setRefreshKey((prev) => prev + 1);
      sessionStorage.removeItem("logs-uploaded-at");
    }

    return () => {
      window.removeEventListener("logs-uploaded", handleLogsUploaded);
    };
  }, []);

  return (
    <div key={refreshKey} className="w-full space-y-8 px-4 py-6">
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-4">
        <div className="flex flex-col gap-3">
          <TopQuestionCard messages={messages} />
          <TodaysTrafficCard messages={messages} />
        </div>

        <div className="flex items-stretch">
          <MessagesPerConversation />
        </div>

        <div className="flex items-stretch">
          <ChatDuration />
        </div>

        <div className="flex items-stretch">
          <WordCloudCard messages={messages} />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6">
        <UniqueUsersCard messages={messages} />
        <UniqueStudentTotalMsgCard messages={messages} />
        <WorkedDatesDueDateCard />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <TrafficPerDayCard />
        <TimeOfDayCard />
      </section>
    </div>
  );
};

export default AnalyticsDashboard;