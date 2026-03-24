//studentAnonymousId as a fallback
//shortened long anonymous ids to labels like Student abc12345
"use client";

import React, { useMemo } from "react";
import { Message } from "@/types";

type UniqueStudentTotalMsgCardProps = {
  messages: Message[];
};

function getStudentLabel(message: Message): string {
  const m = message as Record<string, unknown>;

  const directName =
    typeof m.studentName === "string" ? m.studentName.trim() : null;

  const directEmail =
    typeof m.studentEmail === "string" ? m.studentEmail.trim() : null;

  const directAnonymousId =
    typeof m.studentAnonymousId === "string"
      ? m.studentAnonymousId.trim()
      : null;

  const studentObj =
    m.student && typeof m.student === "object"
      ? (m.student as Record<string, unknown>)
      : null;

  const nestedName =
    studentObj && typeof studentObj.name === "string"
      ? String(studentObj.name).trim()
      : null;

  const nestedEmail =
    studentObj && typeof studentObj.email === "string"
      ? String(studentObj.email).trim()
      : null;

  const value =
    directName ||
    nestedName ||
    directEmail ||
    nestedEmail ||
    directAnonymousId;

  if (!value) return "Unknown Student";

  if (value.includes("@")) {
    return value.split("@")[0];
  }

  if (value.length > 12) {
    return `Student ${value.slice(0, 8)}`;
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

  const maxMessages = Math.max(
    ...chartData.map((item) => item.totalMessages),
    1
  );

  return (
    <section className="rounded-lg border bg-white p-3 shadow-sm">
      <div className="mb-3">
        <h2 className="text-base font-semibold text-slate-900">
          Messages per Student
        </h2>
        <p className="mt-1 text-[11px] text-slate-600">
          Based on uploaded transcript log data.
        </p>
        <p className="mt-1 text-[11px] text-slate-500">
          “the labels are shortened anonymous ids like Student abc12345"
        </p>
      </div>

      {chartData.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">
          No student message data available yet.
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-end justify-between text-[10px] font-medium text-slate-500">
            <span>Students</span>
            <span>Total Messages</span>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[500px]">
              <div className="flex h-[210px] items-end gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
                {chartData.map((item) => {
                  const heightPercent = (item.totalMessages / maxMessages) * 100;

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
                          style={{ height: `${Math.max(heightPercent, 6)}%` }}
                          title={`${item.student}: ${item.totalMessages} messages`}
                        />
                      </div>

                      <span className="mt-2 w-full break-words text-center text-[10px] text-slate-600">
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