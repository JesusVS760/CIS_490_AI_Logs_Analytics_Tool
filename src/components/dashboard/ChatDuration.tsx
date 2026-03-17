"use client";

import { TimerIcon } from "lucide-react";
import React, { useEffect, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

type Session = {
  id: number;
  startedAt: string;
  endedAt: string;
};

const ChatDuration = () => {
  const [chartData, setChartData] = useState<any>(null);
  const [sessionsLength, setSessionsLength] = useState(0);
  const [averageTime, setAverageTime] = useState(0); // in hours

  useEffect(() => {
    async function fetchSessions() {
      const res = await fetch("/api/sessions");
      const sessions: Session[] = await res.json();
      setSessionsLength(sessions.length);

      const buckets = {
        "0–5": 0,
        "5–15": 0,
        "15–30": 0,
        "30–60": 0,
        "60+": 0,
      };

      let totalMinutes = 0;
      let validSessions = 0;

      sessions.forEach((session) => {
        if (!session.startedAt || !session.endedAt) return;

        const start = new Date(session.startedAt).getTime();
        const end = new Date(session.endedAt).getTime();

        const minutes = (end - start) / (1000 * 60);

        totalMinutes += minutes;
        validSessions++;

        if (minutes <= 5) buckets["0–5"]++;
        else if (minutes <= 15) buckets["5–15"]++;
        else if (minutes <= 30) buckets["15–30"]++;
        else if (minutes <= 60) buckets["30–60"]++;
        else buckets["60+"]++;
      });

      setAverageTime(validSessions > 0 ? totalMinutes / validSessions / 60 : 0);

      setChartData({
        labels: Object.keys(buckets),
        datasets: [
          {
            label: "Number of Sessions",
            data: Object.values(buckets),
            backgroundColor: [
              "#FF6384", // 0–5
              "#36A2EB", // 5–15
              "#FFCE56", // 15–30
              "#4BC0C0", // 30–60
              "#9966FF", // 60+
            ],
          },
        ],
      });
    }

    fetchSessions();
  }, []);

  return (
    <div className="rounded-2xl border border-gray-100 p-6 shadow-sm w-full flex flex-col h-full">
      <h1 className="flex items-center gap-2 font-bold text-lg mb-4">
        Chat Duration <TimerIcon size={18} />
      </h1>

      <div className="mt-auto">
        <div className="mb-4 text-sm text-muted-foreground">
          <div>Total Sessions: {sessionsLength}</div>
          <div>Average Time: {averageTime.toFixed(2)} hrs</div>
        </div>

        {chartData && (
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
        )}
      </div>
    </div>
  );
};

export default ChatDuration;
