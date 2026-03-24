import { Cloud } from "lucide-react";
import { useMemo, useState } from "react";
import { Message } from "@/types";

type TopQuestionCardProps = {
  messages: Message[];
};

type TopQuestionResult = {
  question: string;
  count: number;
};

const getAssignmentLabel = (message: Message): string | null => {
  const msg = message as Record<string, unknown>;

  const possibleValues = [
    msg.assignmentName,
    msg.assignmentTitle,
    msg.assignment,
    (msg.session as Record<string, unknown> | undefined)?.assignmentName,
  ];

  for (const value of possibleValues) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
};

const normalizeKey = (text: string) =>
  text
    .toLowerCase()
    .replace(/^[\s>*-]+/, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const cleanQuestionForDisplay = (text: string) =>
  text
    .replace(/^[\s>*-]+/, "")
    .replace(/^\d+[\).\s-]+/, "")
    .replace(/\s+/g, " ")
    .trim();

const extractQuestionCandidates = (content: string): string[] => {
  const matches = content.match(/[^?\n]*\?/g) ?? [];

  return matches
    .map((question) => cleanQuestionForDisplay(question))
    .filter((question) => question.length >= 6);
};

const getTopQuestion = (messages: Message[]): TopQuestionResult => {
  const studentMessages = messages.filter(
    (message) => message.role === "student"
  );
  const sourceMessages =
    studentMessages.length > 0 ? studentMessages : messages;

  const counts = new Map<string, { count: number; display: string }>();
  const orderedQuestions: string[] = [];

  sourceMessages.forEach((message) => {
    if (!message?.content?.trim()) return;

    const candidates = extractQuestionCandidates(message.content);

    candidates.forEach((candidate) => {
      const key = normalizeKey(candidate);
      if (!key) return;

      const existing = counts.get(key);

      if (existing) {
        existing.count += 1;

        if (candidate.length < existing.display.length) {
          existing.display = candidate;
        }
      } else {
        counts.set(key, { count: 1, display: candidate });
        orderedQuestions.push(candidate);
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
    return {
      question: orderedQuestions[0] ?? "No questions found yet.",
      count: 1,
    };
  }

  return {
    question: top.display,
    count: top.count,
  };
};

const TopQuestionCard = ({ messages }: TopQuestionCardProps) => {
  const [selectedAssignment, setSelectedAssignment] = useState("all");

  const assignmentOptions = useMemo(() => {
    const labels = Array.from(
      new Set(
        messages
          .map((message) => getAssignmentLabel(message))
          .filter((value): value is string => Boolean(value))
      )
    );

    return labels.sort((a, b) => a.localeCompare(b));
  }, [messages]);

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
            <h2 className="text-xl font-semibold text-slate-900">
              Top Question
            </h2>

            <select
              value={selectedAssignment}
              onChange={(e) => setSelectedAssignment(e.target.value)}
              className="rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm text-slate-700"
            >
              <option value="all">All Assignments</option>
              {assignmentOptions.map((assignment) => (
                <option key={assignment} value={assignment}>
                  {assignment}
                </option>
              ))}
            </select>
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
