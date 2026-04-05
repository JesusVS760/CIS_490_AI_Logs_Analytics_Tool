"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Message } from "@/types";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from "chart.js";
import { MessageSquareText } from "lucide-react";
import { useDashboardAssignmentFilter } from "@/components/dashboard/DashboardAssignmentFilterContext";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

function getPath(obj: unknown, path: (string | number)[]) {
  let cur: any = obj;
  for (const key of path) {
    if (cur == null) return undefined;
    cur = cur[key as any];
  }
  return cur;
}

function pickFirstId(
  obj: unknown,
  paths: (string | number)[][]
): string | null {
  for (const p of paths) {
    const v = getPath(obj, p);
    if (typeof v === "string" && v.trim() !== "") return v.trim();
    if (typeof v === "number") return String(v);
  }
  return null;
}

const getAssignmentLabel = (message: Message): string | null => {
  const msg = message as any;

  return (
    pickFirstId(msg, [
      ["assignmentName"],
      ["assignmentTitle"],
      ["assignment"],
      ["title"],
      ["taskName"],
      ["assignment", "name"],
      ["session", "assignmentName"],
      ["session", "assignment", "name"],
      ["metadata", "assignmentName"],
    ]) ?? null
  );
};

const getStudentKey = (message: Message): string | null => {
  const msg = message as any;

  const id = pickFirstId(msg, [
    ["studentId"],
    ["student_id"],
    ["userId"],
    ["user_id"],
    ["email"],
    ["username"],
    ["userName"],
    ["senderId"],
    ["sender_id"],
    ["senderEmail"],
    ["sender_email"],
    ["studentEmail"],
    ["student_email"],
    ["studentName"],
    ["student_name"],
    ["user", "id"],
    ["user", "email"],
    ["student", "id"],
    ["student", "email"],
    ["sender", "id"],
    ["sender", "email"],
  ]);

  return id ? id.toLowerCase() : null;
};

const getStudentLabel = (message: Message, fallbackKey: string): string => {
  const msg = message as any;

  return (
    pickFirstId(msg, [
      ["studentName"],
      ["student_name"],
      ["userName"],
      ["user_name"],
      ["username"],
      ["email"],
      ["studentEmail"],
      ["student_email"],
      ["senderEmail"],
      ["sender_email"],
      ["user", "name"],
      ["user", "email"],
      ["student", "name"],
      ["student", "email"],
      ["sender", "name"],
      ["sender", "email"],
    ]) ?? fallbackKey
  );
};

const getConversationKey = (message: Message): string | null => {
  const msg = message as any;

  return (
    pickFirstId(msg, [
      ["conversationId"],
      ["conversationID"],
      ["conversation_id"],
      ["threadId"],
      ["threadID"],
      ["thread_id"],
      ["chatId"],
      ["chatID"],
      ["chat_id"],
      ["sessionId"],
      ["sessionID"],
      ["session_id"],
      ["conversation", "id"],
      ["thread", "id"],
      ["chat", "id"],
      ["session", "id"],
      ["metadata", "conversationId"],
      ["metadata", "conversation_id"],
      ["metadata", "threadId"],
      ["metadata", "thread_id"],
      ["metadata", "sessionId"],
      ["metadata", "session_id"],
      ["context", "conversationId"],
      ["context", "conversation_id"],
      ["context", "sessionId"],
      ["context", "session_id"],
    ]) ?? null
  );
};

type StudentOption = {
  key: string;
  label: string;
};

function buildStudentOptions(messages: Message[]): StudentOption[] {
  const map = new Map<string, string>();

  for (const message of messages) {
    const key = getStudentKey(message);
    if (!key) continue;

    if (!map.has(key)) {
      map.set(key, getStudentLabel(message, key));
    }
  }

  return Array.from(map.entries())
    .map(([key, label]) => ({ key, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function buildConversationCounts(
  messages: Message[],
  selectedStudentKey: string
) {
  const conversationCounts = new Map<string, number>();

  messages.forEach((message, index) => {
    if (selectedStudentKey !== "all") {
      const studentKey = getStudentKey(message);
      if (studentKey !== selectedStudentKey) {
        return;
      }
    }

    const rawConversationKey = getConversationKey(message);
    const conversationKey = rawConversationKey
      ? rawConversationKey.trim().toLowerCase()
      : `__fallback_conversation_${index}`;

    conversationCounts.set(
      conversationKey,
      (conversationCounts.get(conversationKey) ?? 0) + 1
    );
  });

  return Array.from(conversationCounts.values());
}

function bucketizeConversationCounts(counts: number[]) {
  const buckets: Record<string, number> = {
    "0-5": 0,
    "6-15": 0,
    "16-30": 0,
    "31-60": 0,
    "60+": 0,
  };

  for (const count of counts) {
    if (count <= 5) buckets["0-5"] += 1;
    else if (count <= 15) buckets["6-15"] += 1;
    else if (count <= 30) buckets["16-30"] += 1;
    else if (count <= 60) buckets["31-60"] += 1;
    else buckets["60+"] += 1;
  }

  return buckets;
}

const MessagesPerConversation = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedStudentKey, setSelectedStudentKey] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { selectedAssignment } = useDashboardAssignmentFilter();

  useEffect(() => {
    const loadMessages = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch("/api/messages");
        if (!res.ok) throw new Error("Failed to fetch messages");

        const data = await res.json();
        setMessages(Array.isArray(data) ? data : []);
      } catch {
        setError("Could not load messages");
        setMessages([]);
      } finally {
        setLoading(false);
      }
    };

    loadMessages();
  }, []);

  const assignmentFilteredMessages = useMemo(() => {
    if (selectedAssignment === "all") return messages;

    return messages.filter(
      (message) => getAssignmentLabel(message) === selectedAssignment
    );
  }, [messages, selectedAssignment]);

  const studentOptions = useMemo(
    () => buildStudentOptions(assignmentFilteredMessages),
    [assignmentFilteredMessages]
  );

  useEffect(() => {
    if (
      selectedStudentKey !== "all" &&
      !studentOptions.some((option) => option.key === selectedStudentKey)
    ) {
      setSelectedStudentKey("all");
    }
  }, [selectedStudentKey, studentOptions]);

  const conversationCounts = useMemo(
    () =>
      buildConversationCounts(assignmentFilteredMessages, selectedStudentKey),
    [assignmentFilteredMessages, selectedStudentKey]
  );

  const buckets = useMemo(
    () => bucketizeConversationCounts(conversationCounts),
    [conversationCounts]
  );

  const chartData = useMemo(() => {
    const labels = Object.keys(buckets);
    const data = Object.values(buckets);

    return {
      labels,
      datasets: [
        {
          label: "Conversations",
          data,
          backgroundColor: [
            "#FF6384",
            "#36A2EB",
            "#FFCE56",
            "#4BC0C0",
            "#9966FF",
          ],
        },
      ],
    };
  }, [buckets]);

  const totalConversations = conversationCounts.length;
  const selectedStudentLabel =
    selectedStudentKey === "all"
      ? "All Students"
      : studentOptions.find((option) => option.key === selectedStudentKey)
          ?.label ?? "Selected Student";

  return (
    <div className="rounded-2xl border border-gray-100 p-6 shadow-sm w-full bg-white dark:bg-zinc-900">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-bold text-lg">
            Messages Per Conversation <MessageSquareText size={18} />
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Assignment:{" "}
            {selectedAssignment === "all"
              ? "All Assignments"
              : selectedAssignment}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Student: {selectedStudentLabel}
          </p>
        </div>

        <select
          value={selectedStudentKey}
          onChange={(e) => setSelectedStudentKey(e.target.value)}
          className="rounded-xl border px-4 py-2 text-sm bg-transparent"
        >
          <option value="all">All Students</option>
          {studentOptions.map((student) => (
            <option key={student.key} value={student.key}>
              {student.label}
            </option>
          ))}
        </select>
      </div>

      {loading && <p>Loading messages...</p>}
      {error && <p className="text-red-500">{error}</p>}

      {!loading && !error && (
        <>
          <div className="mb-4 text-sm text-muted-foreground">
            <div>Total Messages: {assignmentFilteredMessages.length}</div>
            <div>Total Conversations: {totalConversations}</div>
          </div>

          <Bar
            data={chartData}
            options={{
              responsive: true,
              plugins: {
                legend: { display: false },
              },
              scales: {
                y: {
                  beginAtZero: true,
                  ticks: { precision: 0 },
                },
              },
            }}
          />
        </>
      )}
    </div>
  );
};

export default MessagesPerConversation;
