import { Cloud } from "lucide-react";
import { useMemo } from "react";
import { Message } from "@/types";

type TopQuestionCardProps = {
  messages: Message[];
};

type TopQuestionResult = {
  question: string;
  count: number;
};

const normalizeKey = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const extractQuestionCandidates = (content: string): string[] => {
  const matches = content.match(/[^?\n]*\?/g) ?? [];
  return matches
    .map((q) => q.trim())
    .filter((q) => q.length >= 6);
};

const getTopQuestion = (messages: Message[]): TopQuestionResult => {
  const counts = new Map<string, { count: number; display: string }>();

  messages.forEach((message) => {
    if (!message?.content) return;

    const candidates = extractQuestionCandidates(message.content);

    candidates.forEach((candidate) => {
      const key = normalizeKey(candidate);
      if (!key) return;

      const existing = counts.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        counts.set(key, { count: 1, display: candidate });
      }
    });
  });

  if (counts.size === 0) {
    return { question: "No questions found yet.", count: 0 };
  }

  const ranked = Array.from(counts.values()).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.display.localeCompare(b.display);
  });

  const top = ranked[0];

  if (top.count <= 1) {
    return { question: "No Repeated Question Yet!", count: 1 };
  }

  return { question: top.display, count: top.count };
};

const TopQuestionCard = ({ messages }: TopQuestionCardProps) => {
  const topQuestion = useMemo(() => getTopQuestion(messages), [messages]);

  return (
    <div className="rounded-2xl border border-sky-200 bg-sky-50 p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Top Question</h2>
          <p className="mt-4 text-lg font-medium text-slate-800">
            {topQuestion.question}
          </p>
          <p className="mt-6 text-sm text-slate-600">Times asked</p>
          <p className="text-4xl font-bold text-slate-900">{topQuestion.count}</p>
        </div>
        <div className="rounded-full bg-white/80 p-3 text-sky-700">
          <Cloud size={24} />
        </div>
      </div>
    </div>
  );
};

export default TopQuestionCard;
