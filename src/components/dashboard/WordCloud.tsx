import { useAiAnalytics } from "@/app/dashboard/DashboardClient";
import { useDashboardAssignmentFilter } from "@/components/dashboard/DashboardAssignmentFilterContext";
import { countTracker } from "@/lib/CountTracker";
import { randomColor } from "@/lib/utils";
import { Message } from "@/types";
import axios from "axios";
import { Bubbles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type WordCloudCardProps = {
  messages: Message[];
};

const getAssignmentLabel = (message: Message): string | null => {
  const msg = message as Record<string, unknown>;

  const possibleValues = [
    msg.assignmentName,
    msg.assignmentTitle,
    msg.assignment,
    msg.title,
    msg.taskName,
    (msg.assignment as Record<string, unknown> | undefined)?.name,
    (msg.session as Record<string, unknown> | undefined)?.assignmentName,
    (
      (msg.session as Record<string, unknown> | undefined)?.assignment as
        | Record<string, unknown>
        | undefined
    )?.name,
    (msg.metadata as Record<string, unknown> | undefined)?.assignmentName,
  ];

  for (const value of possibleValues) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
};

export const WordCloudCard: React.FC<WordCloudCardProps> = ({ messages }) => {
  const [words, setWords] = useState<{ text: string; value: number }[]>([]);
  const [loading, setLoading] = useState(false);

  const { isAiAccepted } = useAiAnalytics();
  const { selectedAssignment } = useDashboardAssignmentFilter();

  console.log("current value of ai: ", isAiAccepted);

  const filteredMessages = useMemo(() => {
    if (selectedAssignment === "all") return messages;

    return messages.filter(
      (message) => getAssignmentLabel(message) === selectedAssignment
    );
  }, [messages, selectedAssignment]);

  useEffect(() => {
    const loadFrequencies = async () => {
      setLoading(true);

      let frequencies: Record<string, number> = {};

      if (filteredMessages.length === 0) {
        setWords([]);
        setLoading(false);
        return;
      }

      if (isAiAccepted) {
        try {
          const payload = filteredMessages.map((message) => ({
            id: message.id,
            role: message.role,
            content: message.content,
          }));

          const response = await axios.post("/api/analytics/word-cloud", {
            messages: payload,
          });

          console.log("LLM response:", response.data);
          frequencies = response.data || {};
        } catch (error) {
          console.error("Word cloud fetch error:", error);
          frequencies = countTracker(filteredMessages);
        } finally {
          setLoading(false);
        }
      } else {
        frequencies = countTracker(filteredMessages);
        setLoading(false);
      }

      const wordArray = Object.entries(frequencies)
        .map(([text, value]) => ({
          text,
          value: typeof value === "number" ? value : Number(value) || 0,
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);

      setWords(wordArray);
    };

    loadFrequencies();
  }, [filteredMessages, isAiAccepted]);

  const maxCount = Math.max(...words.map((word) => word.value), 1);

  return (
    <div className="rounded-2xl border border-gray-100 p-6 shadow-sm w-full bg-white dark:bg-zinc-900">
      <div className="mb-4">
        <h1 className="font-bold text-lg flex gap-2 items-center">
          Top Student Phrases <Bubbles size={18} />
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Viewing:{" "}
          {selectedAssignment === "all"
            ? "All Assignments"
            : selectedAssignment}
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-3 animate-pulse">
          <h1 className="font-bold text-xl">Loading...</h1>
        </div>
      ) : words.length === 0 ? (
        <div className="text-sm text-slate-500">
          No phrase data available for the selected assignment.
        </div>
      ) : (
        <div className="flex flex-wrap justify-center gap-2">
          {words.map((word, index) => {
            const size = 40 + (word.value / maxCount) * 60;
            const fontSize = Math.min(
              size / 2.8,
              size / (word.text.length * 0.6)
            );
            const offsetX = (Math.random() - 1) * 12;
            const offsetY = (Math.random() - 1) * 12;

            return (
              <span
                key={index}
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
                {word.text}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
};
