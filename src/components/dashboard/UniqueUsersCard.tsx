
"use client";

import React, { useMemo } from "react";
import { Message } from "@/types";

type UniqueUsersCardProps = {
  messages: Message[];
};

type AssignmentData = {
  assignmentKey: string;
  assignmentLabel: string;
  count: number;
};

const getNestedString = (
  obj: Record<string, unknown>,
  paths: string[][]
): string | null => {
  for (const path of paths) {
    let current: unknown = obj;

    for (const key of path) {
      if (
        current &&
        typeof current === "object" &&
        key in (current as Record<string, unknown>)
      ) {
        current = (current as Record<string, unknown>)[key];
      } else {
        current = null;
        break;
      }
    }

    if (typeof current === "string" && current.trim() !== "") {
      return current.trim();
    }

    if (typeof current === "number") {
      return String(current);
    }
  }

  return null;
};

const getStudentKey = (message: Message): string | null => {
  const msg = message as Record<string, unknown>;

  const value = getNestedString(msg, [
    ["studentId"],
    ["studentAnonymousId"],
    ["userId"],
    ["email"],
    ["username"],
    ["userName"],
    ["senderId"],
    ["senderEmail"],
    ["studentEmail"],
    ["studentName"],
    ["student", "email"],
    ["student", "id"],
    ["student", "anonymous_id"],
    ["student", "anonymousId"],
    ["session", "studentEmail"],
    ["session", "student", "email"],
    ["session", "student", "id"],
    ["session", "student", "anonymous_id"],
    ["session", "student", "anonymousId"],
  ]);

  return value ? value.toLowerCase() : null;
};

const getAssignmentKey = (
  message: Message
): { key: string; label: string } | null => {
  const msg = message as Record<string, unknown>;

  const value = getNestedString(msg, [
    ["assignmentId"],
    ["assignmentName"],
    ["assignmentTitle"],
    ["assignment"],
    ["title"],
    ["taskName"],
    ["taskId"],
    ["assignment", "name"],
    ["assignment", "id"],
    ["session", "assignmentName"],
    ["session", "assignment", "name"],
    ["session", "assignment", "id"],
  ]);

  if (!value) return null;

  return {
    key: value.toLowerCase(),
    label: value,
  };
};

const buildAssignmentUniqueUsers = (messages: Message[]): AssignmentData[] => {
  const assignmentMap = new Map<string, { label: string; users: Set<string> }>();

  for (const message of messages) {
    const studentKey = getStudentKey(message);
    const assignmentInfo = getAssignmentKey(message);

    if (!studentKey || !assignmentInfo) continue;

    if (!assignmentMap.has(assignmentInfo.key)) {
      assignmentMap.set(assignmentInfo.key, {
        label: assignmentInfo.label,
        users: new Set(),
      });
    }

    assignmentMap.get(assignmentInfo.key)!.users.add(studentKey);
  }

  return Array.from(assignmentMap.entries())
    .map(([assignmentKey, data]) => ({
      assignmentKey,
      assignmentLabel: data.label,
      count: data.users.size,
    }))
    .sort((a, b) => b.count - a.count);
};

const buildOverallUniqueUsers = (messages: Message[]) => {
  const users = new Set<string>();

  for (const message of messages) {
    const studentKey = getStudentKey(message);
    if (studentKey) users.add(studentKey);
  }

  return users.size;
};

const UniqueUsersCard = ({ messages }: UniqueUsersCardProps) => {
  const assignmentData = useMemo(
    () => buildAssignmentUniqueUsers(messages),
    [messages]
  );

  const overallUniqueUsers = useMemo(
    () => buildOverallUniqueUsers(messages),
    [messages]
  );

  const topAssignment = assignmentData[0];
  const topAssignmentCount = topAssignment?.count ?? 0;
  const totalAssignments = assignmentData.length;

  const averageUsersPerAssignment =
    totalAssignments > 0
      ? assignmentData.reduce((sum, item) => sum + item.count, 0) /
        totalAssignments
      : 0;

  const maxCount = Math.max(...assignmentData.map((item) => item.count), 1);

  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm dark:bg-zinc-900">
      <div className="mb-5">
        <h2 className="text-xl font-semibold">Unique Students Per Assignment</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          This chart shows how many different students appeared in the logs for
          each assignment. A student is only counted once per assignment, even
          if they sent many messages.
        </p>
      </div>

      <div className="mb-6 grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border p-4">
          <p className="text-sm text-muted-foreground">Total Unique Students</p>
          <p className="mt-2 text-3xl font-bold">{overallUniqueUsers}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Distinct students found across all uploaded logs.
          </p>
        </div>

        <div className="rounded-xl border p-4">
          <p className="text-sm text-muted-foreground">Assignments Tracked</p>
          <p className="mt-2 text-3xl font-bold">{totalAssignments}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Assignments that contain usable student activity.
          </p>
        </div>

        <div className="rounded-xl border p-4">
          <p className="text-sm text-muted-foreground">Average Per Assignment</p>
          <p className="mt-2 text-3xl font-bold">
            {averageUsersPerAssignment.toFixed(1)}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Average number of unique students per assignment.
          </p>
        </div>
      </div>

      <div className="mb-6 rounded-xl border p-4">
        <p className="text-sm text-muted-foreground">Top Assignment</p>
        <p className="mt-1 text-lg font-semibold">
          {topAssignment?.assignmentLabel ?? "No assignment found"}
        </p>
        <p className="mt-2 text-3xl font-bold">{topAssignmentCount}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          This assignment had the highest number of distinct students in the
          uploaded logs.
        </p>
      </div>

      <div className="mb-3">
        <h3 className="text-base font-semibold">Bar Chart Breakdown</h3>
        <p className="text-sm text-muted-foreground">
          Longer bars mean more unique students worked on that assignment. This
          helps show which assignments had the broadest participation.
        </p>
      </div>

      <div className="space-y-4">
        {assignmentData.length === 0 ? (
          <p className="text-sm text-muted-foreground">No log data found.</p>
        ) : (
          assignmentData.slice(0, 8).map((assignment, index) => {
            const widthPercent = (assignment.count / maxCount) * 100;

            return (
              <div key={assignment.assignmentKey} className="space-y-2">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Rank #{index + 1}
                    </p>
                    <p className="text-sm font-medium">
                      {assignment.assignmentLabel}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">{assignment.count}</p>
                    <p className="text-xs text-muted-foreground">
                      unique students
                    </p>
                  </div>
                </div>

                <div className="h-4 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-zinc-900 transition-all dark:bg-zinc-200"
                    style={{ width: `${widthPercent}%` }}
                  />
                </div>

                <p className="text-xs text-muted-foreground">
                  {assignment.count === 1
                    ? "1 distinct student appeared in the logs for this assignment."
                    : `${assignment.count} distinct students appeared in the logs for this assignment.`}
                </p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default UniqueUsersCard;