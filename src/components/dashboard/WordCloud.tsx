import { countTracker } from "@/lib/countTracker";
import { randomColor } from "@/lib/utils";
import { Message } from "@/types";
import axios from "axios";
import { Bold, Bubbles, Text } from "lucide-react";
import { useEffect, useState } from "react";

type WordCloudCardProps = {
  messages: Message[];
};

export const WordCloudCard: React.FC<WordCloudCardProps> = ({ messages }) => {
  const [words, setWords] = useState<{ text: string; value: number }[]>([]);

  // const { isAiAccepted } = useAiAnalytics();

  // useEffect(() => {
  //   let frequencies: Record<string, number> = { "": 0 };

  //   if (isAiAccepted) {
  //     frequencies = countTracker(messages);
  //   } else {
  //     try {
  //       frequencies = axios.post("./api/analytics/chat-duration", messages);
  //     } catch (error) {
  //       console.log("error: ", error);
  //     }
  //   }

  //   console.log(frequencies);
  //   const wordArray = Object.entries(frequencies)
  //     .map(([text, value]) => ({ text, value }))
  //     .sort((a, b) => b.value - a.value)
  //     .slice(0, 12);
  //   setWords(wordArray);
  // }, [messages]);

  const maxCount = Math.max(...words.map((w) => w.value), 1);

  return (
    <div className="bg-white p-6 rounded-2xl shadow-md w-full">
      <h1 className="font-bold text-lg mb-4 flex gap-2 items-center ">
        Top Student Phrases <Bubbles size={18} />
      </h1>
      <div className="flex flex-wrap justify-center gap-2">
        {words.map((w, idx) => {
          const size = 40 + (w.value / maxCount) * 60;

          const fontSize = Math.min(size / 2.8, size / (w.text.length * 0.6));

          // small random shift between -6px and +6px
          const offsetX = (Math.random() - 1) * 12;
          const offsetY = (Math.random() - 1) * 12;

          return (
            <span
              key={idx}
              style={{
                width: `${size}px`,
                height: `${size}px`,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: `${fontSize}px`,
                fontWeight: "bold",
                boxShadow: "0 2px 6px rgba(0,0,0,0.6)",
                color: "white",
                backgroundColor: randomColor(),
                borderRadius: "50%",
                margin: "6px",
                whiteSpace: "nowrap",
                transform: `translate(${offsetX}px, ${offsetY}px)`,
              }}
            >
              {w.text}
            </span>
          );
        })}
      </div>
    </div>
  );
};
