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
import { BookOpenCheck } from "lucide-react";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

type AssignmentUserCount = {
  assignmentId: number;
  assignmentName: string;
  userCount: number;
};

const AssignmentsUsersChart = () => {
  const [data, setData] = useState<AssignmentUserCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadAssignmentUserCounts = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch("/api/assignments/countPerAssignment");
        if (!res.ok) {
          throw new Error("Failed to fetch assignment user counts");
        }

        const json = await res.json();
        setData(Array.isArray(json) ? json : []);
      } catch (err) {
        setError("Could not load assignment user data");
      } finally {
        setLoading(false);
      }
    };

    loadAssignmentUserCounts();
  }, []);

  const chartData = useMemo(() => {
    return {
      labels: data.map((item) => item.assignmentName),
      datasets: [
        {
          label: "Number of Users",
          data: data.map((item) => item.userCount),
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
  }, [data]);

  const totalAssignments = data.length;
  const totalUsersAcrossAssignments = data.reduce(
    (sum, item) => sum + item.userCount,
    0,
  );

  return (
    <div className="w-full rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:bg-zinc-900">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-lg font-bold">
          Users Per Homework <BookOpenCheck size={18} />
        </h1>
      </div>

      {loading && <p>Loading assignment user counts...</p>}
      {error && <p className="text-red-500">{error}</p>}

      {!loading && !error && (
        <>
          <div className="mb-4 text-sm text-muted-foreground">
            <div>Total Homework: {totalAssignments}</div>
            <div>
              Total Users Counted Across Homework: {totalUsersAcrossAssignments}
            </div>
          </div>

          {data.length === 0 ? (
            <p>No assignment user data available.</p>
          ) : (
            <Bar
              data={chartData}
              options={{
                responsive: true,
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    callbacks: {
                      label: (context) => `Users: ${context.parsed.y}`,
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
                      text: "Number of Users",
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

export default AssignmentsUsersChart;
