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
      (message) => getAssignmentLabel(message) === selectedAssignment,
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
        .slice(0, 8);

      setWords(wordArray);
    };

    loadFrequencies();
  }, [filteredMessages, isAiAccepted]);

  const maxCount = Math.max(...words.map((word) => word.value), 1);
  const minCount = Math.min(...words.map((word) => word.value), 0);

  const COLORS = [
    "#534AB7",
    "#0F6E56",
    "#185FA5",
    "#993556",
    "#D85A30",
    "#3B6D11",
    "#BA7517",
    "#A32D2D",
    "#1D9E75",
    "#7F77DD",
  ];

  const getSize = (value: number) => {
    const normalized = (value - minCount) / Math.max(maxCount - minCount, 1);
    return 52 + normalized * 64; // range: 52px to 116px
  };

  const getFontSize = (value: number, text: string) => {
    const size = getSize(value);
    const bySize = size / 3.2;
    const byLength = size / (text.length * 0.65);
    return Math.max(Math.min(bySize, byLength), 11); // never below 11px
  };

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
        <>
          <div className="flex flex-wrap justify-center items-center gap-3 py-2">
            {words.map((word, index) => {
              const size = getSize(word.value);
              const fontSize = getFontSize(word.value, word.text);
              const bg = COLORS[index % COLORS.length];

              return (
                <div
                  key={index}
                  style={{
                    width: `${size}px`,
                    height: `${size}px`,
                    backgroundColor: bg,
                    borderRadius: "50%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "8px",
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      fontSize: `${fontSize}px`,
                      fontWeight: 600,
                      color: "white",
                      textAlign: "center",
                      lineHeight: 1.2,
                      wordBreak: "break-word",
                      overflow: "hidden",
                      maxWidth: "90%",
                    }}
                  >
                    {word.text}
                  </span>
                  <span
                    style={{
                      fontSize: "10px",
                      color: "rgba(255,255,255,0.7)",
                      marginTop: "2px",
                    }}
                  >
                    {word.value}×
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
