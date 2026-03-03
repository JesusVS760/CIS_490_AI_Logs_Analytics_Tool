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

  useEffect(() => {
    async function fetchSessions() {
      const res = await fetch("/api/sessions");
      const sessions: Session[] = await res.json();
      console.log(sessions);

      const buckets = {
        "0–5": 0,
        "5–15": 0,
        "15–30": 0,
        "30–60": 0,
        "60+": 0,
      };

      sessions.forEach((session) => {
        if (!session.startedAt || !session.endedAt) return;

        const start = new Date(session.startedAt).getTime();
        const end = new Date(session.endedAt).getTime();

        const minutes = (end - start) / (1000 * 60);

        if (minutes <= 5) buckets["0–5"]++;
        else if (minutes <= 15) buckets["5–15"]++;
        else if (minutes <= 30) buckets["15–30"]++;
        else if (minutes <= 60) buckets["30–60"]++;
        else buckets["60+"]++;
      });

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
    <div className="bg-white p-6 rounded-2xl shadow-md">
      <h1 className="flex gap-2 font-bold text-lg mb-4">
        Chat Duration <TimerIcon size={18} />
      </h1>

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
  );
};

export default ChatDuration;
