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
  assignment_id?: number;
  assignmentId?: number;
  messages?: { role: string; timestamp: string; content?: string }[];
};

const TimeOfDayCard = () => {
  const [sessions, setSessions] = useState<SessionWithAssignment[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState("all");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [sessionsRes, assignmentsRes] = await Promise.all([
          axios.get("/api/sessions"),
          axios.get("/api/assignments"),
        ]);

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

        setSessions(processed);
        setAssignments(assignmentsRes.data);
      } catch (error) {
        console.error("Failed to load time-of-day analytics:", error);
      }
    };

    fetchData();
  }, []);

  const assignmentOptions = useMemo(() => {
    const idsInSessions = new Set<number>();

    sessions.forEach((session) => {
      const assignmentId = Number(
        session.assignmentId ?? session.assignment_id,
      );

      if (!Number.isNaN(assignmentId)) {
        idsInSessions.add(assignmentId);
      }
    });

    return assignments
      .filter((assignment) => idsInSessions.has(assignment.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [assignments, sessions]);

  const filteredSessions = useMemo(() => {
    if (selectedAssignment === "all") return sessions;

    return sessions.filter((session) => {
      const assignmentId = String(
        session.assignmentId ?? session.assignment_id,
      );
      return assignmentId === selectedAssignment;
    });
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

  const selectedAssignmentLabel =
    selectedAssignment === "all"
      ? "All Assignments"
      : (assignmentOptions.find(
          (assignment) => String(assignment.id) === selectedAssignment,
        )?.name ?? `Assignment ${selectedAssignment}`);

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
    <div
      style={{ width: "800px" }}
      className="rounded-2xl border border-gray-200 bg-white p-6 shadow-md dark:bg-zinc-900"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-bold">
            AI Tutor Traffic By Hour <LineChart />
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Viewing: {selectedAssignmentLabel}
          </p>
        </div>

        <select
          value={selectedAssignment}
          onChange={(e) => setSelectedAssignment(e.target.value)}
          className="rounded-xl border px-4 py-2 text-sm bg-transparent"
        >
          <option value="all">All Assignments</option>
          {assignmentOptions.map((assignment) => (
            <option key={assignment.id} value={String(assignment.id)}>
              {assignment.name}
            </option>
          ))}
        </select>
      </div>

      <Line
        data={chartData}
        options={{
          responsive: true,
          plugins: {
            legend: {
              display: true,
            },
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                precision: 0,
              },
              title: {
                display: true,
                text: "Sessions",
              },
            },
            x: {
              title: {
                display: true,
                text: "Hour of Day",
              },
            },
          },
        }}
      />
    </div>
  );
};

export default TimeOfDayCard;
