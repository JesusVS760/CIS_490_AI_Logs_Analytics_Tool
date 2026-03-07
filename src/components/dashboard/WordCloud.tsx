import { countTracker } from "@/lib/CountTracker";
import { randomColor } from "@/lib/utils";
import { Message } from "@/types";
import { Bold, Text } from "lucide-react";
import { useEffect, useState } from "react";

type WordCloudCardProps = {
  messages: Message[];
};

export const WordCloudCard: React.FC<WordCloudCardProps> = ({ messages }) => {
  const [words, setWords] = useState<{ text: string; value: number }[]>([]);

  useEffect(() => {
    const frequencies = countTracker(messages);
    const wordArray = Object.entries(frequencies).map(([text, value]) => ({
      text,
      value,
    }));
    setWords(wordArray);
  }, [messages]);

  const maxCount = Math.max(...words.map((w) => w.value), 1);

  return (
    <div className="bg-white p-6 rounded-2xl shadow-md w-[400px]">
      <h1 className="font-bold text-lg mb-4 flex gap-2 items-center ">
        Top Student Phrases <Text size={18} />
      </h1>
      <div className="flex flex-wrap gap-2">
        {words.map((w, idx) => {
          const fontSize = 10 + (w.value / maxCount) * 16;

          return (
            <span
              key={idx}
              style={{ fontSize, fontWeight: "bold", color: randomColor() }}
              className="inline-block"
            >
              {w.text}
            </span>
          );
        })}
      </div>
    </div>
  );
};
