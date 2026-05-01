import { Cloud } from "lucide-react";
import { useMemo } from "react";
import { Message } from "@/types";
import { useDashboardAssignmentFilter } from "@/components/dashboard/DashboardAssignmentFilterContext";

type TopQuestionCardProps = {
  messages: Message[];
};

type TopQuestionResult = {
  question: string;
  count: number;
};

type NormalizedQuestionEntry = {
  original: string;
  normalized: string;
};

const getAssignmentLabel = (message: Message): string | null => {
  const msg = message as Record<string, unknown>;

  const possibleValues = [
    msg.assignmentName,
    msg.assignmentTitle,
    msg.assignment,
    (msg.session as Record<string, unknown> | undefined)?.assignmentName,
    (msg.assignment as Record<string, unknown> | undefined)?.name,
  ];

  for (const value of possibleValues) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
};

const cleanText = (text: string) =>
  text
    .replace(/^[\s>*-]+/, "")
    .replace(/^\d+[\).\s-]+/, "")
    .replace(/\s+/g, " ")
    .trim();

const codeLikePattern =
  /(#include|using namespace|std::|cout\s*<<|cin\s*>>|printf\s*\(|scanf\s*\(|int\s+main\s*\(|\breturn\s+\d+;|^\s*[{};])/i;

const questionStarterPattern =
  /^(how|what|why|when|where|which|who|can|could|should|is|are|do|does|did|will|would|am)\b/i;

const helpSeekingPattern =
  /\b(help|please help|need help|i need help|stuck|confused|dont understand|don't understand|check my work|look at my code|fix this|fix my code|debug|error|why isnt|why isn't|how do i|how can i)\b/i;

const isCodeLikeLine = (text: string) => codeLikePattern.test(text);

const hasEnoughNaturalLanguage = (text: string) => {
  const words = text.split(/\s+/).filter(Boolean);
  const letterCount = (text.match(/[a-z]/gi) ?? []).length;
  return words.length >= 2 && letterCount >= 5;
};

const isLikelyNaturalLanguageQuestion = (text: string) => {
  const cleaned = cleanText(text);

  if (cleaned.length < 6 || !cleaned.endsWith("?")) {
    return false;
  }

  if (isCodeLikeLine(cleaned)) {
    return false;
  }

  return hasEnoughNaturalLanguage(cleaned);
};

const isLikelyQuestionLikeStatement = (text: string) => {
  const cleaned = cleanText(text);

  if (cleaned.length < 6) {
    return false;
  }

  if (isCodeLikeLine(cleaned)) {
    return false;
  }

  if (!hasEnoughNaturalLanguage(cleaned)) {
    return false;
  }

  return (
    questionStarterPattern.test(cleaned) || helpSeekingPattern.test(cleaned)
  );
};

const extractQuestionCandidates = (content: string): string[] => {
  const sanitized = content.replace(/```[\s\S]*?```/g, " ");

  return sanitized
    .split("\n")
    .map((line) => cleanText(line))
    .filter((line) => isLikelyNaturalLanguageQuestion(line));
};

const getFallbackCandidates = (content: string): string[] => {
  const sanitized = content.replace(/```[\s\S]*?```/g, " ");

  return sanitized
    .split("\n")
    .map((line) => cleanText(line))
    .filter((line) => isLikelyQuestionLikeStatement(line));
};

const fillerWords = new Set([
  "a",
  "an",
  "the",
  "i",
  "am",
  "im",
  "i'm",
  "supposed",
  "to",
  "this",
  "that",
  "my",
  "your",
  "please",
]);

const normalizeQuestionText = (text: string) => {
  return cleanText(text)
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\bhow\s+am\s+i\s+supposed\s+to\b/g, "how do i")
    .replace(/\bhow\s+can\s+i\b/g, "how do i")
    .replace(/\bhow\s+do\s+i\s+go\s+about\b/g, "how do i")
    .replace(/\bfixing\b/g, "fix")
    .replace(/\bfixed\b/g, "fix")
    .replace(/\bbeginning\b/g, "begin")
    .replace(/\bstarting\b/g, "begin")
    .split(/\s+/)
    .filter(Boolean)
    .filter((word) => !fillerWords.has(word))
    .join(" ");
};

const toNormalizedEntries = (items: string[]): NormalizedQuestionEntry[] =>
  items
    .map((item) => ({
      original: item,
      normalized: normalizeQuestionText(item),
    }))
    .filter((item) => item.normalized.length > 0);

const pickTopText = (items: string[]): [string, number] | null => {
  const normalizedItems = toNormalizedEntries(items);
  const counts = new Map<string, number>();
  const displayByNormalized = new Map<string, string>();
  const firstSeenOrder: string[] = [];

  normalizedItems.forEach(({ original, normalized }) => {
    if (!counts.has(normalized)) {
      counts.set(normalized, 1);
      displayByNormalized.set(normalized, original);
      firstSeenOrder.push(normalized);
    } else {
      counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
    }
  });

  const ranked = Array.from(counts.entries()).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return firstSeenOrder.indexOf(a[0]) - firstSeenOrder.indexOf(b[0]);
  });

  if (ranked.length === 0) {
    return null;
  }

  const [normalizedQuestion, count] = ranked[0];
  return [displayByNormalized.get(normalizedQuestion) ?? normalizedQuestion, count];
};

const getTopQuestion = (messages: Message[]): TopQuestionResult => {
  const studentMessages = messages.filter(
    (message) =>
      message.role === "student" &&
      typeof message.content === "string" &&
      message.content.trim().length > 0
  );

  const questionCandidates: string[] = [];

  studentMessages.forEach((message) => {
    questionCandidates.push(...extractQuestionCandidates(message.content));
  });

  if (questionCandidates.length > 0) {
    const top = pickTopText(questionCandidates);
    if (top) {
      const [question, count] = top;
      return { question, count };
    }
  }

  const fallbackCandidates: string[] = [];

  studentMessages.forEach((message) => {
    fallbackCandidates.push(...getFallbackCandidates(message.content));
  });

  if (fallbackCandidates.length > 0) {
    const top = pickTopText(fallbackCandidates);
    if (top) {
      const [question, count] = top;
      return { question, count };
    }
  }

  return { question: "No student message data available.", count: 0 };
};

const TopQuestionCard = ({ messages }: TopQuestionCardProps) => {
  const { selectedAssignment } = useDashboardAssignmentFilter();

  const filteredMessages = useMemo(() => {
    if (selectedAssignment === "all") return messages;

    return messages.filter(
      (message) => getAssignmentLabel(message) === selectedAssignment
    );
  }, [messages, selectedAssignment]);

  const topQuestion = useMemo(
    () => getTopQuestion(filteredMessages),
    [filteredMessages]
  );

  return (
    <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4 shadow-sm w-full">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                Top Question
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Viewing:{" "}
                {selectedAssignment === "all"
                  ? "All Assignments"
                  : selectedAssignment}
              </p>
            </div>
          </div>

          <p className="mt-4 text-lg font-medium text-slate-800">
            {topQuestion.question}
          </p>
          <p className="mt-6 text-sm text-slate-600">Times asked</p>
          <p className="text-4xl font-bold text-slate-900">
            {topQuestion.count}
          </p>
        </div>

        <div className="rounded-full bg-white/80 p-3 text-sky-700">
          <Cloud size={24} />
        </div>
      </div>
    </div>
  );
};

export default TopQuestionCard;
