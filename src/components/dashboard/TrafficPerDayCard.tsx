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
import { Session } from "@/types";
import { LineChart } from "lucide-react";
import { useDashboardAssignmentFilter } from "@/components/dashboard/DashboardAssignmentFilterContext";

ChartJS.register(
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
);

type SessionWithAssignment = Session & {
  assignment_id?: number | string;
  assignmentId?: number | string;
  assignmentName?: string;
};

const TrafficPerDayCard = () => {
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
              startedAt: firstAI?.timestamp ?? null,
            };
          },
        );

        setSessions(Array.isArray(processed) ? processed : []);
      } catch (error) {
        console.error("Failed to load traffic-per-day analytics:", error);
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

  const days = Array.from({ length: 31 }, (_, i) => i + 1);

  const countsPerDay = useMemo(
    () =>
      days.map(
        (day) =>
          filteredSessions.filter((session) => {
            if (!session.startedAt) return false;
            const date = new Date(session.startedAt);
            return !Number.isNaN(date.getTime()) && date.getDate() === day;
          }).length,
      ),
    [days, filteredSessions],
  );

  const data = {
    labels: days,
    datasets: [
      {
        label: "AI-Tutor Usage",
        data: countsPerDay,
        tension: 0.4,
        fill: false,
        borderColor: "rgb(75, 192, 192)",
        backgroundColor: "rgba(79,70,229,0.1)",
      },
    ],
  };

  return (
    <div className="rounded-2xl border border-gray-200 p-6 shadow-md bg-white dark:bg-zinc-900 w-full">
      <div className="mb-4">
        <h1 className="flex items-center gap-2 font-bold text-lg">
          AI Tutor Traffic Per Day <LineChart size={18} />
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Viewing:{" "}
          {selectedAssignment === "all"
            ? "All Assignments"
            : selectedAssignment}
        </p>
      </div>

      <Line
        data={data}
        options={{
          responsive: true,
          scales: {
            y: {
              beginAtZero: true,
              ticks: { stepSize: 1, precision: 0 },
            },
          },
        }}
      />
    </div>
  );
};

export default TrafficPerDayCard;
