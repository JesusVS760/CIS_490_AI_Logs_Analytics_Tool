//Way its setup currently, AnalyticsDashboard will upload the log messages and passes
//them to UniqueUsersCard
//Will render AnalyticsDashboard as normally

"use client";

import { useEffect, useState } from "react";
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

const AnalyticsDashboard = () => {
  const [messages, setMessages] = useState<Message[]>([]);

  const fetchMessages = async () => {
    try {
      const res = await axios.get("/api/messages");
      setMessages(res.data);
    } catch (err) {
      console.error("Failed to fetch messages:", err);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, []);

  return (
    <div className="w-full space-y-8 px-4 py-6">
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-3">
          <TopQuestionCard messages={messages} />
          <TodaysTrafficCard messages={messages} />
        </div>
        <div className="flex items-stretch p-2">
          <MessagesPerConversation />
        </div>
        <div className="flex items-stretch p-2">
          <ChatDuration />
        </div>
        <div className="flex items-stretch p-2">
          <WordCloudCard messages={messages} />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <UniqueUsersCard messages={messages} />
        <WorkedDatesDueDateCard />
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <TrafficPerDayCard />
        <TimeOfDayCard />
      </section>
    </div>
  );
};

export default AnalyticsDashboard;
