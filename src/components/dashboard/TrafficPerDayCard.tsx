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
  assignmentName?: string;
  assignmentDueDate?: string; // REQUIRED
};

const WINDOW_DAYS = 30; // Last 30 days + Due Day = 31 days total

const TrafficPerDayCard = () => {
  const [sessions, setSessions] = useState<SessionWithAssignment[]>([]);
  const { selectedAssignment } = useDashboardAssignmentFilter();

  /*
  -----------------------------------------
  FETCH SESSIONS
  -----------------------------------------
  */

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

        setSessions(processed);
      } catch (error) {
        console.error("Failed to load traffic-per-day analytics:", error);
        setSessions([]);
      }
    };

    fetchData();
  }, []);

  /*
  -----------------------------------------
  FILTER BY ASSIGNMENT
  -----------------------------------------
  */

  const filteredSessions = useMemo(() => {
    if (selectedAssignment === "all") return sessions;

    return sessions.filter(
      (session) => session.assignmentName === selectedAssignment,
    );
  }, [selectedAssignment, sessions]);

  /*
  -----------------------------------------
  CREATE DAY LABELS
  30 ... 1 ... 0
  -----------------------------------------
  */

  const daysRemainingLabels = useMemo(() => {
    return Array.from({ length: WINDOW_DAYS + 1 }, (_, i) => WINDOW_DAYS - i);
  }, []);

  /*
  -----------------------------------------
  COUNT TRAFFIC PER DAY REMAINING
  -----------------------------------------
  */

  const countsPerDayRemaining = useMemo(() => {
    return daysRemainingLabels.map((daysRemaining) => {
      return filteredSessions.filter((session) => {
        if (!session.startedAt) return false;
        if (!session.assignmentDueDate) return false;

        const sessionDate = new Date(session.startedAt);
        const dueDate = new Date(session.assignmentDueDate);
        console.log(dueDate);

        if (
          Number.isNaN(sessionDate.getTime()) ||
          Number.isNaN(dueDate.getTime())
        )
          return false;

        const diffMs = dueDate.getTime() - sessionDate.getTime();

        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        // Only include last 31 days
        if (diffDays < 0 || diffDays > WINDOW_DAYS) return false;

        return diffDays === daysRemaining;
      }).length;
    });
  }, [filteredSessions, daysRemainingLabels]);

  const data = {
    labels: daysRemainingLabels.map((d) => (d === 0 ? "Due" : d.toString())),
    datasets: [
      {
        label: "AI-Tutor Usage",
        data: countsPerDayRemaining,
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
          AI Tutor Traffic Before Due Date
          <LineChart size={18} />
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
              ticks: {
                stepSize: 1,
                precision: 0,
              },
            },
            x: {
              title: {
                display: true,
                text: "Days Remaining Until Due Date",
              },
            },
          },
        }}
      />
    </div>
  );
};

export default TrafficPerDayCard;
