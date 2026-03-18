"use client";

import React, { useMemo } from "react";
import { Message } from "@/types";

type UniqueStudentTotalMsgCardProps = {
  messages: Message[];
};

function getStudentLabel(message: Message): string {
  const m = message as Record<string, unknown>;

  const directName =
    typeof m.studentName === "string" ? m.studentName : null;

  const directEmail =
    typeof m.studentEmail === "string" ? m.studentEmail : null;

  const studentObj =
    m.student && typeof m.student === "object"
      ? (m.student as Record<string, unknown>)
      : null;

  const nestedName =
    studentObj && typeof studentObj.name === "string"
      ? (studentObj.name as string)
      : null;

  const nestedEmail =
    studentObj && typeof studentObj.email === "string"
      ? (studentObj.email as string)
      : null;

  const value = directName || nestedName || directEmail || nestedEmail;

  if (!value) return "Unknown Student";

  if (value.includes("@")) {
    return value.split("@")[0];
  }

  return value;
}

export default function UniqueStudentTotalMsgCard({
  messages,
}: UniqueStudentTotalMsgCardProps) {
  const chartData = useMemo(() => {
    const counts = new Map<string, number>();

    for (const message of messages) {
      const student = getStudentLabel(message);
      counts.set(student, (counts.get(student) || 0) + 1);
    }

    return Array.from(counts.entries())
      .map(([student, totalMessages]) => ({
        student,
        totalMessages,
      }))
      .sort((a, b) => b.totalMessages - a.totalMessages);
  }, [messages]);

  const maxMessages = Math.max(...chartData.map((item) => item.totalMessages), 1);

  return (
    <section className="rounded-2xl border bg-white p-6 shadow-sm">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-slate-900">
          Total Messages per Unique Student
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Based on uploaded transcript log data.
        </p>
      </div>

      {chartData.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          No student message data available yet.
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-end justify-between text-xs font-medium text-slate-500">
            <span>X-axis: Unique Students</span>
            <span>Y-axis: Total Messages</span>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[700px]">
              <div className="flex h-[320px] items-end gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                {chartData.map((item) => {
                  const heightPercent = (item.totalMessages / maxMessages) * 100;

                  return (
                    <div
                      key={item.student}
                      className="flex min-w-[70px] flex-1 flex-col items-center justify-end"
                    >
                      <span className="mb-2 text-xs font-semibold text-slate-700">
                        {item.totalMessages}
                      </span>

                      <div className="flex h-[240px] items-end">
                        <div
                          className="w-12 rounded-t-lg bg-slate-800 transition-all duration-300"
                          style={{ height: `${Math.max(heightPercent, 6)}%` }}
                          title={`${item.student}: ${item.totalMessages} messages`}
                        />
                      </div>

                      <span className="mt-3 w-full break-words text-center text-xs text-slate-600">
                        {item.student}
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