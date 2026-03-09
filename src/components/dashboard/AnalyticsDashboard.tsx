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
      <ChatDuration />
      <UniqueUsersCard messages={messages} />
      <WordCloudCard messages={messages} />
    </div>
  );
};

export default AnalyticsDashboard;