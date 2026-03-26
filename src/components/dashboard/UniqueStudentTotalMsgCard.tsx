//studentAnonymousId as a fallback
//shortened long anonymous ids to labels like Student abc12345
"use client";

import React, { useMemo, useState } from "react";
import { Message } from "@/types";

type UniqueStudentTotalMsgCardProps = {
  messages: Message[];
};

function getNestedString(
  obj: Record<string, unknown>,
  paths: string[][]
): string | null {
  for (const path of paths) {
    let current: unknown = obj;

    for (const key of path) {
      if (!current || typeof current !== "object") {
        current = null;
        break;
      }
      current = (current as Record<string, unknown>)[key];
    }

    if (typeof current === "string" && current.trim()) {
      return current.trim();
    }
  }

  return null;
}

function getStudentLabel(message: Message): string {
  const m = message as Record<string, unknown>;

  const value =
    getNestedString(m, [
      ["studentName"],
      ["studentEmail"],
      ["studentAnonymousId"],
      ["student", "name"],
      ["student", "email"],
      ["student", "anonymousId"],
      ["user", "name"],
      ["user", "email"],
    ]) ?? "";

  if (!value) return "Unknown Student";

  if (value.includes("@")) {
    return value.split("@")[0];
  }

  if (value.length > 12) {
    return `Student ${value.slice(0, 8)}`;
  }

  return value;
}

function getLogLabel(message: Message): string {
  const m = message as Record<string, unknown>;

  const value =
    getNestedString(m, [
      ["fileName"],
      ["sourceFileName"],
      ["transcriptFileName"],
      ["uploadFileName"],
      ["logFileName"],
      ["assignmentName"],
      ["assignment", "name"],
      ["session", "fileName"],
      ["session", "sourceFileName"],
      ["session", "assignmentName"],
      ["metadata", "fileName"],
      ["metadata", "sourceFileName"],
      ["metadata", "assignmentName"],
      ["uploadId"],
      ["session", "uploadId"],
      ["metadata", "uploadId"],
    ]) ?? "Unknown Log";

  return value;
}

export default function UniqueStudentTotalMsgCard({
  messages,
}: UniqueStudentTotalMsgCardProps) {
  const [selectedLog, setSelectedLog] = useState("ALL");

  const logOptions = useMemo(() => {
    const uniqueLogs = Array.from(
      new Set(messages.map((message) => getLogLabel(message)))
    ).sort((a, b) => a.localeCompare(b));

    return ["ALL", ...uniqueLogs];
  }, [messages]);

  const filteredMessages = useMemo(() => {
    if (selectedLog === "ALL") return messages;
    return messages.filter((message) => getLogLabel(message) === selectedLog);
  }, [messages, selectedLog]);

  const chartData = useMemo(() => {
    const counts = new Map<string, number>();

    for (const message of filteredMessages) {
      const student = getStudentLabel(message);
      counts.set(student, (counts.get(student) || 0) + 1);
    }

    return Array.from(counts.entries())
      .map(([student, totalMessages]) => ({
        student,
        totalMessages,
      }))
      .sort((a, b) => b.totalMessages - a.totalMessages);
  }, [filteredMessages]);

  const maxMessages = Math.max(
    ...chartData.map((item) => item.totalMessages),
    1
  );

  return (
    <section className="rounded-lg border bg-white p-6 shadow-sm">
      <div className="mb-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Messages per Student
            </h2>
            <p className="mt-1 text-[11px] text-slate-600">
              Based on uploaded transcript log data.
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              Labels are shortened anonymous ids like Student abc12345.
            </p>
          </div>

          <div className="w-full md:w-[260px]">
            <label
              htmlFor="log-filter"
              className="mb-1 block text-[11px] font-medium text-slate-700"
            >
              Select log source
            </label>
            <select
              id="log-filter"
              value={selectedLog}
              onChange={(e) => setSelectedLog(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500"
            >
              {logOptions.map((log) => (
                <option key={log} value={log}>
                  {log === "ALL" ? "All Logs" : log}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {chartData.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">
          No student message data available for the selected log.
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
