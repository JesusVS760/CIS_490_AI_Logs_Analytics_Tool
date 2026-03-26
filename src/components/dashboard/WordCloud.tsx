import { useAiAnalytics } from "@/app/dashboard/page";
import { countTracker } from "@/lib/countTracker";
import { randomColor } from "@/lib/utils";
import { Message } from "@/types";
import axios from "axios";
import { Bubbles } from "lucide-react";
import { useEffect, useState } from "react";

type WordCloudCardProps = {
  messages: Message[];
};

export const WordCloudCard: React.FC<WordCloudCardProps> = ({ messages }) => {
  const [words, setWords] = useState<{ text: string; value: number }[]>([]);
  const [loading, setLoading] = useState(false);

  const { isAiAccepted } = useAiAnalytics();
  console.log("current value of ai: ", isAiAccepted);

  let frequencies: Record<string, number> = {};

  useEffect(() => {
    const loadFrequencies = async () => {
      setLoading(true);

      if (isAiAccepted) {
        try {
          const payload = messages.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
          }));

          const response = await axios.post("/api/analytics/word-cloud", {
            messages: payload,
          });
          console.log("LLM response:", response.data);

          frequencies = response.data || {};
        } catch (error) {
          console.error("Word cloud fetch error:", error);
        } finally {
          setLoading(false);
        }
      } else {
        frequencies = countTracker(messages);
      }
      const wordArray = Object.entries(frequencies)
        .map(([text, value]) => ({
          text,
          value: typeof value === "number" ? value : Number(value) || 0,
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);

      setWords(wordArray);
      setLoading(false);
    };

    loadFrequencies();
  }, [messages, isAiAccepted]);

  const maxCount = Math.max(...words.map((w) => w.value), 1);

  return (
    <div className="rounded-2xl border border-gray-100 p-6 shadow-sm w-full bg-white dark:bg-zinc-900">
      <h1 className="font-bold text-lg mb-4 flex gap-2 items-center">
        Top Student Phrases <Bubbles size={18} />
      </h1>

      {loading ? (
        <div className="flex items-center justify-center gap-3 animate-pulse">
          <h1 className="font-bold text-xl">Loading...</h1>
        </div>
      ) : (
        <div className="flex flex-wrap justify-center gap-2">
          {words.map((w, idx) => {
            const size = 40 + (w.value / maxCount) * 60;
            const fontSize = Math.min(size / 2.8, size / (w.text.length * 0.6));
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
      )}
    </div>
  );
};
