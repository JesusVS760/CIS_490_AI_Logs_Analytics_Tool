"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip as ChartTooltip,
  Legend,
} from "chart.js";
import { MessageSquareText, Info } from "lucide-react";
import { useDashboardAssignmentFilter } from "@/components/dashboard/DashboardAssignmentFilterContext";
import { Message } from "@/types";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";

ChartJS.register(CategoryScale, LinearScale, BarElement, ChartTooltip, Legend);

type StudentOption = {
  key: string;
  label: string;
};

// Builds the dropdown options for the student filter.
// Receives idToDisplay so labels match the sequential numbers shown on the charts.
// filteredMessages is used so only students relevant to the current assignment appear.
function buildStudentOptions(
  filteredMessages: Message[],
  idToDisplay: Map<string, number>
): StudentOption[] {
  // Collect unique student IDs present in the current filtered view.
  const keys = new Set<string>();
  for (const m of filteredMessages) {
    keys.add(String(m.studentId));
  }

  return Array.from(keys)
    // Label each student with their global display number, not their raw ID.
    .map((key) => ({ key, label: `Student ${idToDisplay.get(key) ?? key}` }))
    // Sort numerically by display number so the list appears in order.
    .sort((a, b) => {
      const na = idToDisplay.get(a.key) ?? Infinity;
      const nb = idToDisplay.get(b.key) ?? Infinity;
      return na - nb;
    });
}

function buildConversationCounts(
  messages: Message[],
  selectedStudentKey: string
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
    return messages.filter(
      (m) => m.assignmentName === selectedAssignment
    );
  }, [messages, selectedAssignment]);

  // Build a stable display-number map from ALL messages so student numbers
  // stay consistent across assignment filters and match the chart labels.
  const idToDisplay = useMemo(() => {
    const allIds = Array.from(new Set(messages.map((m) => Number(m.studentId))))
      .sort((a, b) => a - b);
    return new Map(allIds.map((id, i) => [String(id), i + 1]));
  }, [messages]);

  const studentOptions = useMemo(
    () => buildStudentOptions(filteredMessages, idToDisplay),
    [filteredMessages, idToDisplay]
  );

  const conversationCounts = useMemo(
    () => buildConversationCounts(filteredMessages, selectedStudentKey),
    [filteredMessages, selectedStudentKey]
  );

  const buckets = useMemo(
    () => bucketize(conversationCounts),
    [conversationCounts]
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
      <div className="mb-4 flex justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="flex items-center gap-2 font-bold text-lg">
              Messages Per Conversation <MessageSquareText size={18} />
            </h1>

            <Tooltip>
              <TooltipTrigger asChild>
                <button className="text-slate-500 hover:text-black dark:hover:text-white">
                  <Info size={16} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Shows how many messages exist in each conversation. Data is
                grouped into ranges and can be filtered by student.
              </TooltipContent>
            </Tooltip>
          </div>

          <p className="text-sm">
            Assignment:{" "}
            {selectedAssignment === "all" ? "All" : selectedAssignment}
          </p>
        </div>

        <select
          value={selectedStudentKey}
          onChange={(e) => setSelectedStudentKey(e.target.value)}
          className="bg-white text-black dark:bg-zinc-800 dark:text-white"
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