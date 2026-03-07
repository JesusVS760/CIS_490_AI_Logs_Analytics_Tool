"use client";

import React, { useEffect, useState } from "react";
import { Message } from "@/types";
import CountTracker from "@/lib/CountTracker";

type WordData = {
  text: string;
  value: number;
};

type WordCloudCardProps = {
  messages: Message[];
};

const WordCloudCard: React.FC<WordCloudCardProps> = ({ messages }) => {
  const [words, setWords] = useState<WordData[]>([]);

  useEffect(() => {
    const frequencies = CountTracker(messages);
    const wordArray = Object.entries(frequencies).map(([text, value]) => ({
      text,
      value,
    }));
    setWords(wordArray);
  }, [messages]);

  // Determine font size scaling
  const maxCount = Math.max(...words.map((w) => w.value), 1);

  return (
    <div className="bg-white p-6 rounded-2xl shadow-md w-[400px]">
      <h1 className="font-bold text-lg mb-4">Top Student Phrases</h1>
      <div className="flex flex-wrap gap-2">
        {words.map((w, idx) => {
          const fontSize = 12 + (w.value / maxCount) * 24; // min 12px, max 36px
          return (
            <span
              key={idx}
              style={{ fontSize }}
              className="inline-block text-gray-800"
            >
              {w.text}
            </span>
          );
        })}
      </div>
    </div>
  );
};

export default WordCloudCard;
