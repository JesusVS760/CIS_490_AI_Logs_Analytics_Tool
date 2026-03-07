import React, { useEffect, useState } from "react";
import ChatDuration from "./ChatDuration";
import UniqueUsersCard from "./UniqueUsersCard";
import axios from "axios";
import { Message } from "@/types";
import CountTracker from "@/lib/CountTracker";
import WordCloud from "./WordCloud";
import WordCloudCard from "./WordCloud";

const AnalyticsDashboard = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [wordCloudData, setWordCloudData] = useState<
    { text: string; value: number }[]
  >([]);

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const response = await axios.get("/api/messages");
        setMessages(response.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchMessages();
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      const frequencies = CountTracker(messages);
      const data = Object.entries(frequencies).map(([text, value]) => ({
        text,
        value,
      }));
      setWordCloudData(data);
    }
  }, [messages]);

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
