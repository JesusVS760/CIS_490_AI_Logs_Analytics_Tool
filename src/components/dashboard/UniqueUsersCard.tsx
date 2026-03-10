
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

const getAssignmentKey = (message: Message): { key: string; label: string } | null => {
  const msg = message as Record<string, unknown>;

  const possibleAssignments = [
    msg.assignmentId,
    msg.assignmentName,
    msg.assignmentTitle,
    msg.assignment,
    msg.title,
    msg.taskName,
    msg.taskId,
  ];

  for (const value of possibleAssignments) {
    if (typeof value === "string" && value.trim() !== "") {
      return {
        key: value.trim().toLowerCase(),
        label: value.trim(),
      };
    }

    if (typeof value === "number") {
      return {
        key: String(value),
        label: String(value),
      };
    }
  }

  return null;
};

const buildAssignmentUniqueUsers = (messages: Message[]): AssignmentData[] => {
  const assignmentMap = new Map<string, { label: string; users: Set<string> }>();

  for (const message of messages) {
    const studentKey = getStudentKey(message);
    const assignmentInfo = getAssignmentKey(message);

    if (!studentKey || !assignmentInfo) {
      continue;
    }

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

const UniqueUsersCard = ({ messages }: UniqueUsersCardProps) => {
  const assignmentData = useMemo(
    () => buildAssignmentUniqueUsers(messages),
    [messages]
  );

  const topAssignment = assignmentData[0];
  const topAssignmentCount = topAssignment?.count ?? 0;

  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm dark:bg-zinc-900">
      <div className="mb-4">
        <h2 className="text-xl font-semibold">Unique Students Per Assignment</h2>
        <p className="text-sm text-muted-foreground">
          Counts each student once per assignment, even if they send multiple messages.
        </p>
      </div>

      <div className="mb-6 rounded-xl border p-4">
        <p className="text-sm text-muted-foreground">Top Assignment</p>
        <p className="text-lg font-semibold">
          {topAssignment?.assignmentLabel ?? "No assignment found"}
        </p>
        <p className="text-3xl font-bold">{topAssignmentCount}</p>
      </div>

      <div className="space-y-3">
        {assignmentData.length === 0 ? (
          <p className="text-sm text-muted-foreground">No log data found.</p>
        ) : (
          assignmentData.slice(0, 6).map((assignment) => (
            <div
              key={assignment.assignmentKey}
              className="flex items-center justify-between rounded-lg border px-4 py-3"
            >
              <span className="text-sm">{assignment.assignmentLabel}</span>
              <span className="font-semibold">{assignment.count}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default UniqueUsersCard;