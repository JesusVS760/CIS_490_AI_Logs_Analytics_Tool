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
      console.log(res.data);
      setMessages(res.data);
    } catch (err) {
      console.error("Failed to fetch messages:", err);
    }
  };

  useEffect(() => {
    fetchMessages();

    const interval = setInterval(() => {
      fetchMessages(); // fetch every 5 seconds
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-85">
      <ChatDuration />
      <UniqueUsersCard />
      <div className="mt-8">
        <WordCloudCard messages={messages} />
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
