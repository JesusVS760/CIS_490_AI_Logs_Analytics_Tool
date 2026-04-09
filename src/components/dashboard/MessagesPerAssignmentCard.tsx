"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import { BarChart3 } from "lucide-react";
import axios from "axios";
import { Message } from "@/types";

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

const MessagesPerAssignmentCard = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadMessages = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await axios.get("/api/messages", {
          withCredentials: true,
          params: { t: Date.now() },
        });

        setMessages(Array.isArray(response.data) ? response.data : []);
      } catch (err) {
        setError("Could not load assignment message data");
        setMessages([]);
      } finally {
        setLoading(false);
      }
    };

    loadMessages();
  }, []);

  const assignmentData = useMemo(() => {
    const counts = new Map<string, number>();

    messages.forEach((message) => {
      const assignmentLabel = message.assignmentName;
      counts.set(assignmentLabel, (counts.get(assignmentLabel) ?? 0) + 1);
    });

    return Array.from(counts.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);
  }, [messages]);

  const chartData = useMemo(() => {
    return {
      labels: assignmentData.map((item) => item.label),
      datasets: [
        {
          label: "Number of Messages",
          data: assignmentData.map((item) => item.count),
          backgroundColor: [
            "#FF6384",
            "#36A2EB",
            "#FFCE56",
            "#4BC0C0",
            "#9966FF",
            "#FF9F40",
            "#8DD17E",
            "#C9CBCF",
          ],
        },
      ],
    };
  }, [assignmentData]);

  const totalAssignments = assignmentData.length;
  const totalMessagesAcrossAssignments = assignmentData.reduce(
    (sum, item) => sum + item.count,
    0
  );

  return (
    <div className="w-full rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:bg-zinc-900">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-lg font-bold">
          Messages Per Homework <BarChart3 size={18} />
        </h1>
      </div>

      {loading && <p>Loading assignment message data...</p>}
      {error && <p className="text-red-500">{error}</p>}

      {!loading && !error && (
        <>
          <div className="mb-4 text-sm text-muted-foreground">
            <div>Total Homework: {totalAssignments}</div>
            <div>
              Total Messages Counted Across Homework:{" "}
              {totalMessagesAcrossAssignments}
            </div>
          </div>

          {assignmentData.length === 0 ? (
            <p>No assignment message data available.</p>
          ) : (
            <Bar
              data={chartData}
              options={{
                responsive: true,
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    callbacks: {
                      label: (context) => `Messages: ${context.parsed.y}`,
                    },
                  },
                },
                scales: {
                  x: {
                    title: {
                      display: true,
                      text: "Homework",
                    },
                  },
                  y: {
                    beginAtZero: true,
                    ticks: {
                      precision: 0,
                    },
                    title: {
                      display: true,
                      text: "Number of Messages",
                    },
                  },
                },
              }}
            />
          )}
        </>
      )}
    </div>
  );
};

export default MessagesPerAssignmentCard;
