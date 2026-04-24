"use client";

import React, { useMemo } from "react";
import { Message } from "@/types";
import { useDashboardAssignmentFilter } from "@/components/dashboard/DashboardAssignmentFilterContext";

export default function UniqueStudentTotalMsgCard({
  messages,
}: {
  messages: Message[];
}) {
  const { selectedAssignment } = useDashboardAssignmentFilter();

  const filteredMessages = useMemo(() => {
    if (selectedAssignment === "all") return messages;
    return messages.filter((m) => m.assignmentName === selectedAssignment);
  }, [messages, selectedAssignment]);

  const { chartData, idToDisplay } = useMemo(() => {
    const counts = new Map<string, number>();

    for (const m of filteredMessages) {
      const student = String(m.studentId);
      counts.set(student, (counts.get(student) ?? 0) + 1);
    }

    const allIds = Array.from(counts.keys())
      .map(Number)
      .sort((a, b) => a - b);
    const idToDisplay = new Map(allIds.map((id, i) => [String(id), i + 1]));

    const chartData = Array.from(counts.entries())
      .map(([student, totalMessages]) => ({ student, totalMessages }))
      .sort((a, b) => b.totalMessages - a.totalMessages);

    return { chartData, idToDisplay };
  }, [filteredMessages]);

  const maxMessages = Math.max(
    ...chartData.map((item) => item.totalMessages),
    1,
  );

  return (
    <section className="rounded-2xl border border-gray-100 p-6 shadow-sm w-full bg-white dark:bg-zinc-900">
      <div className="mb-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="flex items-center gap-2 font-bold text-lg">
              Messages Per Student
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Based on uploaded transcript log data.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Viewing:{" "}
              {selectedAssignment === "all"
                ? "All Assignments"
                : selectedAssignment}
            </p>
          </div>
        </div>
      </div>

      {chartData.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">
          No student message data available for the selected assignment.
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-end justify-between mt-1 text-md text-foreground">
            <span>Students</span>
            <span>Total Messages</span>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[500px]">
              <div className="flex h-[210px] items-end gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
                {chartData.map((item) => {
                  const heightPercent =
                    (item.totalMessages / maxMessages) * 100;

                  return (
                    <div
                      key={item.student}
                      className="flex min-w-[48px] flex-1 flex-col items-center justify-end"
                    >
                      <span className="mb-1 text-[10px] font-semibold text-slate-700">
                        {item.totalMessages}
                      </span>

                      <div className="flex h-[145px] items-end">
                        <div
                          className="w-8 rounded-t-md bg-slate-800 transition-all duration-300"
                          style={{
                            height: `${Math.max(heightPercent, 6)}%`,
                          }}
                          title={`Student ${idToDisplay.get(item.student)}: ${item.totalMessages} messages`}
                        />
                      </div>

                      <span className="mt-2 w-full break-words text-center text-[10px] text-slate-600">
                        Student: {idToDisplay.get(item.student)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
