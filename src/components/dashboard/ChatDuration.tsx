"use client";

import { TimerIcon } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import axios from "axios";
import { useDashboardAssignmentFilter } from "@/components/dashboard/DashboardAssignmentFilterContext";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

type Assignment = {
  id: number;
  name: string;
};

type Session = {
  id: number;
  startedAt: string | null;
  endedAt: string | null;
  assignment_id?: number;
  assignmentId?: number;
};

const ChatDuration = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  const { selectedAssignment } = useDashboardAssignmentFilter();

  useEffect(() => {
    async function fetchData() {
      try {
        const [sessionsRes, assignmentsRes] = await Promise.all([
          axios.get("/api/sessions"),
          axios.get("/api/assignments"),
        ]);

        setSessions(
          Array.isArray(sessionsRes.data) ? sessionsRes.data : []
        );
        setAssignments(
          Array.isArray(assignmentsRes.data) ? assignmentsRes.data : []
        );
      } catch (error) {
        console.error("Failed to load chat duration analytics:", error);
        setSessions([]);
        setAssignments([]);
      }
    }

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
  }, [sessions, selectedAssignment, assignmentNameById]);

  const { chartData, sessionsLength, averageTime } = useMemo(() => {
    const buckets = {
      "0-5": 0,
      "6-15": 0,
      "16-30": 0,
      "31-60": 0,
      "60+": 0,
    };

    let totalMinutes = 0;
    let validSessions = 0;

    filteredSessions.forEach((session) => {
      if (!session.startedAt || !session.endedAt) return;

      const start = new Date(session.startedAt).getTime();
      const end = new Date(session.endedAt).getTime();

      if (Number.isNaN(start) || Number.isNaN(end)) return;

      const minutes = (end - start) / (1000 * 60);
      if (minutes < 0) return;

      totalMinutes += minutes;
      validSessions++;

      if (minutes <= 5) buckets["0-5"]++;
      else if (minutes <= 15) buckets["6-15"]++;
      else if (minutes <= 30) buckets["16-30"]++;
      else if (minutes <= 60) buckets["31-60"]++;
      else buckets["60+"]++;
    });

    return {
      sessionsLength: filteredSessions.length,
      averageTime: validSessions > 0 ? totalMinutes / validSessions / 60 : 0,
      chartData: {
        labels: Object.keys(buckets),
        datasets: [
          {
            label: "Number of Sessions",
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
      },
    };
  }, [filteredSessions]);

  return (
    <div className="rounded-2xl border border-gray-100 p-6 shadow-sm w-full bg-white dark:bg-zinc-900">
      <div className="mb-4">
        <h1 className="flex items-center gap-2 font-bold text-lg">
          Chat Duration <TimerIcon size={18} />
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Viewing:{" "}
          {selectedAssignment === "all"
            ? "All Assignments"
            : selectedAssignment}
        </p>
      </div>

      <div className="mt-auto">
        <div className="mb-4 text-sm text-muted-foreground">
          <div>Total Sessions: {sessionsLength}</div>
          <div>Average Time: {averageTime.toFixed(2)} hrs</div>
        </div>

        <Bar
          data={chartData}
          options={{
            responsive: true,
            plugins: {
              legend: {
                display: false,
              },
            },
            scales: {
              y: {
                beginAtZero: true,
              },
            },
          }}
        />
      </div>
    </div>
  );
};

export default ChatDuration;
