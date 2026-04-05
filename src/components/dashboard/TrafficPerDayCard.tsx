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
  Legend
);

type Assignment = {
  id: number;
  name: string;
};

type SessionWithAssignment = Session & {
  assignment_id?: number;
  assignmentId?: number;
};

const TrafficPerDayCard = () => {
  const [sessions, setSessions] = useState<SessionWithAssignment[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  const { selectedAssignment } = useDashboardAssignmentFilter();

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
              (message) => message.role === "ai_tutor" && message.timestamp
            );

            return {
              ...session,
              startedAt: firstAI?.timestamp ?? null,
            };
          }
        );

        setSessions(Array.isArray(processed) ? processed : []);
        setAssignments(
          Array.isArray(assignmentsRes.data) ? assignmentsRes.data : []
        );
      } catch (error) {
        console.error("Failed to load traffic-per-day analytics:", error);
        setSessions([]);
        setAssignments([]);
      }
    };

    fetchData();
  }, []);

  const assignmentNameById = useMemo(() => {
    const map = new Map<number, string>();

    assignments.forEach((assignment) => {
      map.set(assignment.id, assignment.name);
    });

    return map;
  }, [assignments]);

  const filteredSessions = useMemo(() => {
    if (selectedAssignment === "all") return sessions;

    return sessions.filter((session) => {
      const assignmentId = Number(
        session.assignmentId ?? session.assignment_id
      );

      if (Number.isNaN(assignmentId)) return false;

      return assignmentNameById.get(assignmentId) === selectedAssignment;
    });
  }, [selectedAssignment, sessions, assignmentNameById]);

  const days = Array.from({ length: 31 }, (_, i) => i + 1);

  const countsPerDay = useMemo(
    () =>
      days.map(
        (day) =>
          filteredSessions.filter((session) => {
            if (!session.startedAt) return false;
            const date = new Date(session.startedAt);
            return !Number.isNaN(date.getTime()) && date.getDate() === day;
          }).length
      ),
    [days, filteredSessions]
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
              ticks: {
                stepSize: 1,
                precision: 0,
              },
            },
          },
        }}
      />
    </div>
  );
};

export default TrafficPerDayCard;
