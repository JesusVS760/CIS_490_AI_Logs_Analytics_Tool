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
    <div className="w-full space-y-8">
      <section className="grid max-w-4xl grid-cols-1 gap-6 lg:grid-cols-3">
        <TopQuestionCard messages={messages} />
        <TodaysTrafficCard messages={messages} />
      </section>

      <ChatDuration />

      <WorkedDatesDueDateCard />
      <UniqueUsersCard messages={messages} />
      <WordCloudCard messages={messages} />
      <MessagesPerConversation />
      <TimeOfDayCard />
      <TrafficPerDayCard />
    </div>
  );
};

export default AnalyticsDashboard;
