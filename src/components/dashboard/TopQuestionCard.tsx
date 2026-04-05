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

const extractQuestionCandidates = (content: string): string[] => {
  const matches = content.match(/[^?\n]*\?/g) ?? [];

  return matches
    .map((question) => cleanText(question))
    .filter((question) => question.length >= 6);
};

const getFallbackCandidates = (content: string): string[] => {
  const cleaned = cleanText(content);

  if (!cleaned || cleaned.length < 6) {
    return [];
  }

  return [cleaned];
};

const pickTopText = (items: string[]) => {
  const counts = new Map<string, number>();
  const firstSeenOrder: string[] = [];

  items.forEach((item) => {
    if (!counts.has(item)) {
      counts.set(item, 1);
      firstSeenOrder.push(item);
    } else {
      counts.set(item, (counts.get(item) ?? 0) + 1);
    }
  });

  const ranked = Array.from(counts.entries()).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return firstSeenOrder.indexOf(a[0]) - firstSeenOrder.indexOf(b[0]);
  });

  return ranked[0];
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
    const [question, count] = pickTopText(questionCandidates);
    return { question, count };
  }

  const fallbackCandidates: string[] = [];

  studentMessages.forEach((message) => {
    fallbackCandidates.push(...getFallbackCandidates(message.content));
  });

  if (fallbackCandidates.length > 0) {
    const [question, count] = pickTopText(fallbackCandidates);
    return { question, count };
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
