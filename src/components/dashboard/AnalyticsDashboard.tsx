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
<<<<<<< HEAD
=======
import MessagesPerConversation from "./MessagesPerConversation";
>>>>>>> 5e44c29113f10a996e0dc31c94d77b7468ca5c66

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
        <TopQuestionCard />
        <TodaysTrafficCard />
        <TimeOfDayCard />
      </section>

      <ChatDuration />
      <WordCloudCard messages={messages} />
      <WorkedDatesDueDateCard />
      <UniqueUsersCard messages={messages} />
<<<<<<< HEAD
=======
      <WordCloudCard messages={messages} /> 
      <MessagesPerConversation messages={messages} />
>>>>>>> 5e44c29113f10a996e0dc31c94d77b7468ca5c66
    </div>
  );
};

export default AnalyticsDashboard;
