//This component will group students using the AI by week
//Uses a set for each Student, this way each student is only counted once per week

"use client";

import React, { useMemo } from "react";
import { Message } from "@/types";

type UniqueUsersCardProps = {
  messages: Message[];
};

type WeeklyData = {
  weekStart: string;
  weekEnd: string;
  count: number;
};

const getStudentKey = (message: Message): string | null => {
  const msg = message as Record<string, unknown>;

  const possibleIds = [
    msg.studentId,
    msg.userId,
    msg.email,
    msg.username,
    msg.userName,
    msg.senderId,
    msg.senderEmail,
    msg.studentEmail,
    msg.studentName,
  ];

  for (const value of possibleIds) {
    if (typeof value === "string" && value.trim() !== "") {
      return value.trim().toLowerCase();
    }

    if (typeof value === "number") {
      return String(value);
    }
  }

  return null;
};

const getMessageDate = (message: Message): Date | null => {
  const msg = message as Record<string, unknown>;

  const rawDate =
    msg.createdAt ??
    msg.timestamp ??
    msg.sentAt ??
    msg.date;

  if (typeof rawDate !== "string" && typeof rawDate !== "number") {
    return null;
  }

  const parsed = new Date(rawDate);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
};

const getWeekStart = (date: Date) => {
  const d = new Date(date);
  const day = d.getDay(); // Sunday = 0
  const diff = day === 0 ? -6 : 1 - day; // make Monday the first day
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

const addDays = (date: Date, days: number) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

const toDateKey = (date: Date) => {
  return date.toISOString().slice(0, 10);
};

const formatLabel = (dateString: string) => {
  const date = new Date(`${dateString}T00:00:00`);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
};

const buildWeeklyUniqueUsers = (messages: Message[]): WeeklyData[] => {
  const weeklyMap = new Map<string, Set<string>>();

  for (const message of messages) {
    const studentKey = getStudentKey(message);
    const messageDate = getMessageDate(message);

    if (!studentKey || !messageDate) {
      continue;
    }

    const weekStart = getWeekStart(messageDate);
    const weekKey = toDateKey(weekStart);

    if (!weeklyMap.has(weekKey)) {
      weeklyMap.set(weekKey, new Set());
    }

    weeklyMap.get(weekKey)!.add(studentKey);
  }

  return Array.from(weeklyMap.entries())
    .map(([weekStart, users]) => {
      const end = addDays(new Date(`${weekStart}T00:00:00`), 6);

      return {
        weekStart,
        weekEnd: toDateKey(end),
        count: users.size,
      };
    })
    .sort((a, b) => new Date(b.weekStart).getTime() - new Date(a.weekStart).getTime());
};

const UniqueUsersCard = ({ messages }: UniqueUsersCardProps) => {
  const weeklyData = useMemo(() => buildWeeklyUniqueUsers(messages), [messages]);

  const currentWeekStart = toDateKey(getWeekStart(new Date()));
  const currentWeek = weeklyData.find((week) => week.weekStart === currentWeekStart);
  const currentWeekCount = currentWeek?.count ?? 0;

  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm dark:bg-zinc-900">
      <div className="mb-4">
        <h2 className="text-xl font-semibold">Unique Students Per Week</h2>
        <p className="text-sm text-muted-foreground">
          Counts each student once per week, even if they send multiple messages.
        </p>
      </div>

      <div className="mb-6 rounded-xl border p-4">
        <p className="text-sm text-muted-foreground">Current Week</p>
        <p className="text-3xl font-bold">{currentWeekCount}</p>
      </div>

      <div className="space-y-3">
        {weeklyData.length === 0 ? (
          <p className="text-sm text-muted-foreground">No log data found.</p>
        ) : (
          weeklyData.slice(0, 6).map((week) => (
            <div
              key={week.weekStart}
              className="flex items-center justify-between rounded-lg border px-4 py-3"
            >
              <span className="text-sm">
                {formatLabel(week.weekStart)} - {formatLabel(week.weekEnd)}
              </span>
              <span className="font-semibold">{week.count}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default UniqueUsersCard;