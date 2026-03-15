import axios from "axios";
import React, { useEffect, useState } from "react";

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

ChartJS.register(
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
);

const TrafficPerDayCard = () => {
  const [sessions, setSessions] = useState<Session[]>([]);

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const { data } = await axios.get("/api/sessions");

        // Keep only first AI-Tutor message as startedAt
        const processed: Session[] = data.map((s: Session) => {
          const messages = Array.isArray(s.messages) ? s.messages : [];
          const firstAI = messages.find(
            (m) => m.role === "ai_tutor" && m.timestamp,
          );
          return { ...s, startedAt: firstAI?.timestamp ?? null };
        });

        setSessions(processed);
      } catch (error) {
        console.error(error);
      }
    };
    fetchSessions();
  }, []);

  const days = Array.from({ length: 31 }, (_, i) => i + 1);

  // Count sessions where AI-Tutor first message happened on that day
  const countsPerDay = days.map(
    (day) =>
      sessions.filter((s) => {
        if (!s.startedAt) return false;
        const date = new Date(s.startedAt);
        return date.getDate() === day;
      }).length,
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
    <div
      style={{ width: "800px" }}
      className="rounded-2xl border border-gray-100 p-6 shadow-sm bg-white dark:bg-zinc-900"
    >
      <h1 className="flex items-center gap-2 font-bold text-lg">
        AI Tutor Traffic Per Day <LineChart />
      </h1>
      <Line data={data} />
    </div>
  );
};

export default TrafficPerDayCard;
