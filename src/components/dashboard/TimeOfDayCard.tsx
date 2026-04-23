import axios from "axios";
import React, { useEffect, useMemo, useState } from "react";
import {
  Chart as ChartJS,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { LineChart } from "lucide-react";
import { Session } from "@/types";
import { useDashboardAssignmentFilter } from "@/components/dashboard/DashboardAssignmentFilterContext";

ChartJS.register(
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
);

type Assignment = {
  id: number;
  name: string;
};

type SessionWithAssignment = Session & {
  assignment_id?: number | string;
  assignmentId?: number | string;
  assignmentName?: string;
  messages?: { role: string; timestamp: string; content?: string }[];
};

const TimeOfDayCard = () => {
  const [sessions, setSessions] = useState<SessionWithAssignment[]>([]);
  const { selectedAssignment } = useDashboardAssignmentFilter();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const sessionsRes = await axios.get("/api/sessions");

        const processed: SessionWithAssignment[] = sessionsRes.data.map(
          (session: SessionWithAssignment) => {
            const messages = Array.isArray(session.messages)
              ? session.messages
              : [];
            const firstAI = messages.find(
              (message) => message.role === "ai_tutor" && message.timestamp,
            );

            return {
              ...session,
              startedAt: firstAI?.timestamp ?? session.startedAt ?? null,
            };
          },
        );

        setSessions(Array.isArray(processed) ? processed : []);
      } catch (error) {
        console.error("Failed to load time-of-day analytics:", error);
        setSessions([]);
      }
    };

    fetchData();
  }, []);

  // Filter by assignmentName directly — avoids id type mismatch entirely
  const filteredSessions = useMemo(() => {
    if (selectedAssignment === "all") return sessions;
    return sessions.filter(
      (session) => session.assignmentName === selectedAssignment,
    );
  }, [selectedAssignment, sessions]);

  const hourLabels = Array.from({ length: 24 }, (_, hour) => {
    const suffix = hour < 12 ? "AM" : "PM";
    const displayHour = hour % 12 === 0 ? 12 : hour % 12;
    return `${displayHour} ${suffix}`;
  });

  const countsPerHour = useMemo(() => {
    const counts = Array.from({ length: 24 }, () => 0);

    filteredSessions.forEach((session) => {
      if (!session.startedAt) return;
      const date = new Date(session.startedAt);
      if (Number.isNaN(date.getTime())) return;
      const hour = date.getHours();
      counts[hour] += 1;
    });

    return counts;
  }, [filteredSessions]);

  const chartData = {
    labels: hourLabels,
    datasets: [
      {
        label: "AI Tutor Usage by Hour",
        data: countsPerHour,
        tension: 0.4,
        fill: false,
        borderColor: "rgb(75, 192, 192)",
        backgroundColor: "rgba(79,70,229,0.1)",
        pointRadius: 4,
        pointHoverRadius: 6,
      },
    ],
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-md dark:bg-zinc-900 w-full">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-bold">
            AI Tutor Traffic By Hour <LineChart />
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Viewing:{" "}
            {selectedAssignment === "all"
              ? "All Assignments"
              : selectedAssignment}
          </p>
        </div>
      </div>

      <Line
        data={chartData}
        options={{
          responsive: true,
          plugins: {
            legend: { display: true },
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: { precision: 0 },
              title: { display: true, text: "Sessions" },
            },
            x: {
              title: { display: true, text: "Hour of Day" },
            },
          },
        }}
      />
    </div>
  );
};

export default TimeOfDayCard;
