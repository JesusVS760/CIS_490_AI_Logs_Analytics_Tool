import React, { useMemo } from "react";
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import { BarChart3 } from "lucide-react";
import { Message } from "@/types";

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

type MessagesPerAssignmentCardProps = {
  messages: Message[];
};

const getAssignmentLabel = (message: Message): string | null => {
  const msg = message as Record<string, unknown>;

  const possibleValues = [
    msg.assignmentName,
    msg.assignmentTitle,
    msg.assignment,
    msg.title,
    msg.taskName,
    (msg.assignment as Record<string, unknown> | undefined)?.name,
    (msg.session as Record<string, unknown> | undefined)?.assignmentName,
    (
      (msg.session as Record<string, unknown> | undefined)?.assignment as
        | Record<string, unknown>
        | undefined
    )?.name,
  ];

  for (const value of possibleValues) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
};

const MessagesPerAssignmentCard = ({
  messages,
}: MessagesPerAssignmentCardProps) => {
  const assignmentData = useMemo(() => {
    const counts = new Map<string, number>();

    messages.forEach((message) => {
      const assignmentLabel =
        getAssignmentLabel(message) ?? "Unknown Assignment";
      counts.set(assignmentLabel, (counts.get(assignmentLabel) ?? 0) + 1);
    });

    const sorted = Array.from(counts.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);

    return {
      labels: sorted.map((item) => item.label),
      counts: sorted.map((item) => item.count),
    };
  }, [messages]);

  const data = {
    labels: assignmentData.labels,
    datasets: [
      {
        label: "# of Messages",
        data: assignmentData.counts,
        backgroundColor: "rgba(59, 130, 246, 0.75)",
        borderColor: "rgb(37, 99, 235)",
        borderWidth: 1,
        borderRadius: 8,
      },
    ],
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-md w-full">
      <h1 className="mb-4 flex items-center gap-2 text-lg font-bold">
        Messages Per Assignment <BarChart3 size={18} />
      </h1>

      <Bar
        data={data}
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
                text: "Messages",
              },
            },
            x: {
              title: {
                display: true,
                text: "Assignment",
              },
            },
          },
        }}
      />
    </div>
  );
};

export default MessagesPerAssignmentCard;
