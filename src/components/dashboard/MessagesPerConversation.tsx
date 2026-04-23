"use client";

import React, { useEffect, useMemo, useState } from "react";
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
import { Message } from "@/types";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

type StudentOption = {
  key: string;
  label: string;
};

function buildStudentOptions(messages: Message[]): StudentOption[] {
  const map = new Map<string, string>();

  for (const m of messages) {
    const key = String(m.studentId);
    if (!map.has(key)) {
      map.set(key, `Student ${key}`);
    }
  }

  return Array.from(map.entries())
    .map(([key, label]) => ({ key, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function buildConversationCounts(
  messages: Message[],
  selectedStudentKey: string,
) {
  const counts = new Map<string, number>();

  for (const m of messages) {
    if (
      selectedStudentKey !== "all" &&
      String(m.studentId) !== selectedStudentKey
    ) {
      continue;
    }

    const key = String(m.sessionId);

    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return Array.from(counts.values());
}

function bucketize(counts: number[]) {
  const buckets: Record<string, number> = {
    "0-5": 0,
    "6-15": 0,
    "16-30": 0,
    "31-60": 0,
    "60+": 0,
  };

  for (const c of counts) {
    if (c <= 5) buckets["0-5"]++;
    else if (c <= 15) buckets["6-15"]++;
    else if (c <= 30) buckets["16-30"]++;
    else if (c <= 60) buckets["31-60"]++;
    else buckets["60+"]++;
  }

  return buckets;
}

export default function MessagesPerConversation() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedStudentKey, setSelectedStudentKey] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { selectedAssignment } = useDashboardAssignmentFilter();

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/messages");
        if (!res.ok) throw new Error();

        const data = await res.json();
        console.log("messages received", data);
        setMessages(Array.isArray(data) ? data : []);
      } catch {
        setError("Failed to load messages");
        setMessages([]);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const filteredMessages = useMemo(() => {
    if (selectedAssignment === "all") return messages;

    return messages.filter((m) => m.assignmentName === selectedAssignment);
  }, [messages, selectedAssignment]);

  const studentOptions = useMemo(
    () => buildStudentOptions(filteredMessages),
    [filteredMessages],
  );

  useEffect(() => {
    if (
      selectedStudentKey !== "all" &&
      !studentOptions.some((s) => s.key === selectedStudentKey)
    ) {
      setSelectedStudentKey("all");
    }
  }, [selectedStudentKey, studentOptions]);

  const conversationCounts = useMemo(
    () => buildConversationCounts(filteredMessages, selectedStudentKey),
    [filteredMessages, selectedStudentKey],
  );

  const buckets = useMemo(
    () => bucketize(conversationCounts),
    [conversationCounts],
  );

  const chartData = {
    labels: Object.keys(buckets),
    datasets: [
      {
        label: "Conversations",
        data: Object.values(buckets),
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

  const totalConversations = conversationCounts.length;
  return (
    <div className="rounded-2xl border border-gray-100 p-6 shadow-sm w-full bg-white dark:bg-zinc-900">
      <div className="mb-4 flex justify-between">
        <div>
          <h1 className="flex items-center gap-2 font-bold text-lg ">
            Messages Per Conversation <MessageSquareText size={18} />
          </h1>
          <p className="text-sm">
            Assignment:{" "}
            {selectedAssignment === "all" ? "All" : selectedAssignment}
          </p>
        </div>

        <select
          value={selectedStudentKey}
          onChange={(e) => setSelectedStudentKey(e.target.value)}
          //Dropdown menu with white background and black text, and dark mode support
          className="bg-white text-black dark:bg-zinc-800 dark:text-white dark:border-zinc-600"
        >
          <option value="all">All Students</option>
          {studentOptions.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {loading && <p>Loading...</p>}
      {error && <p>{error}</p>}

      {!loading && !error && (
        <>
          <div className="mb-4 text-sm">
            <div>Total Messages: {filteredMessages.length}</div>
            <div>Total Conversations: {totalConversations}</div>
          </div>

          <Bar
            data={chartData}
            options={{
              responsive: true,
              plugins: { legend: { display: false } },
            }}
          />
        </>
      )}
    </div>
  );
}
