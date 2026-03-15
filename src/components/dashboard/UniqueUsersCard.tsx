//note: in buildStudentAnalytics, use assignment keys for uniqueness instead of labels
//this way differently-caused labels do not count as separate assignments 

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

type StudentData = {
  studentKey: string;
  studentLabel: string;
  messageCount: number;
  assignmentsCount: number;
  assignments: string[];
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

const getStudentLabel = (message: Message): string | null => {
  const msg = message as Record<string, unknown>;

  return getNestedString(msg, [
    ["studentName"],
    ["username"],
    ["userName"],
    ["email"],
    ["studentEmail"],
    ["studentId"],
    ["studentAnonymousId"],
    ["userId"],
    ["senderEmail"],
    ["senderId"],
    ["student", "name"],
    ["student", "email"],
    ["student", "id"],
    ["student", "anonymousId"],
    ["session", "student", "name"],
    ["session", "studentEmail"],
    ["session", "student", "email"],
    ["session", "student", "id"],
  ]);
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

const buildStudentAnalytics = (messages: Message[]): StudentData[] => {
  const studentMap = new Map<
    string,
    {
      label: string;
      messageCount: number;
      assignments: Set<string>;
    }
  >();

  for (const message of messages) {
    const studentKey = getStudentKey(message);
    if (!studentKey) continue;

    const studentLabel = getStudentLabel(message) ?? studentKey;
    const assignmentInfo = getAssignmentKey(message);

    if (!studentMap.has(studentKey)) {
      studentMap.set(studentKey, {
        label: studentLabel,
        messageCount: 0,
        assignments: new Set<string>(),
      });
    }

    const current = studentMap.get(studentKey)!;
    current.messageCount += 1;

    if (assignmentInfo) {
      current.assignments.add(assignmentInfo.label);
    }
  }

  return Array.from(studentMap.entries())
    .map(([studentKey, data]) => ({
      studentKey,
      studentLabel: data.label,
      messageCount: data.messageCount,
      assignmentsCount: data.assignments.size,
      assignments: Array.from(data.assignments),
    }))
    .sort((a, b) => {
      if (b.messageCount !== a.messageCount) {
        return b.messageCount - a.messageCount;
      }
      return b.assignmentsCount - a.assignmentsCount;
    });
};

const UniqueUsersCard = ({ messages }: UniqueUsersCardProps) => {
  const assignmentData = useMemo(
    () => buildAssignmentUniqueUsers(messages),
    [messages]
  );

  const studentData = useMemo(() => buildStudentAnalytics(messages), [messages]);

  const overallUniqueUsers = studentData.length;
  const totalAssignments = assignmentData.length;
  const totalMessages = messages.length;

  const topAssignment = assignmentData[0];
  const topStudentByMessages = studentData[0];

  const topStudentByAssignments = [...studentData].sort((a, b) => {
    if (b.assignmentsCount !== a.assignmentsCount) {
      return b.assignmentsCount - a.assignmentsCount;
    }
    return b.messageCount - a.messageCount;
  })[0];

  const averageUsersPerAssignment =
    totalAssignments > 0
      ? assignmentData.reduce((sum, item) => sum + item.count, 0) /
        totalAssignments
      : 0;

  const averageMessagesPerStudent =
    overallUniqueUsers > 0 ? totalMessages / overallUniqueUsers : 0;

  const repeatStudents = studentData.filter(
    (student) => student.messageCount > 1
  ).length;

  const oneTimeStudents = studentData.filter(
    (student) => student.messageCount === 1
  ).length;

  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm dark:bg-zinc-900">
      <div className="mb-5">
        <h2 className="text-xl font-semibold">Unique Student Insights</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          This section explains student participation in plain language.
        </p>
      </div>

      <div className="mb-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border p-4">
          <p className="text-sm font-medium">Students in the logs</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {overallUniqueUsers} different student
            {overallUniqueUsers === 1 ? " appears" : "s appear"} in the uploaded
            data.
          </p>
        </div>

        <div className="rounded-xl border p-4">
          <p className="text-sm font-medium">Messages recorded</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {totalMessages} total message
            {totalMessages === 1 ? "" : "s"} were found across all logs.
          </p>
        </div>

        <div className="rounded-xl border p-4">
          <p className="text-sm font-medium">Assignments tracked</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {totalAssignments} assignment
            {totalAssignments === 1 ? "" : "s"} had usable student activity.
          </p>
        </div>

        <div className="rounded-xl border p-4">
          <p className="text-sm font-medium">Average student activity</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Each student sent about {averageMessagesPerStudent.toFixed(1)}{" "}
            message
            {Number(averageMessagesPerStudent.toFixed(1)) === 1 ? "" : "s"} on
            average.
          </p>
        </div>
      </div>

      <div className="mb-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border p-4">
          <p className="text-sm font-medium">Most active student</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {topStudentByMessages
              ? `${topStudentByMessages.studentLabel} sent ${topStudentByMessages.messageCount} message${
                  topStudentByMessages.messageCount === 1 ? "" : "s"
                }.`
              : "No student data found."}
          </p>
        </div>

        <div className="rounded-xl border p-4">
          <p className="text-sm font-medium">Most assignments worked on</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {topStudentByAssignments
              ? `${topStudentByAssignments.studentLabel} appeared in ${topStudentByAssignments.assignmentsCount} assignment${
                  topStudentByAssignments.assignmentsCount === 1 ? "" : "s"
                }.`
              : "No student data found."}
          </p>
        </div>

        <div className="rounded-xl border p-4">
          <p className="text-sm font-medium">Widest assignment reach</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {topAssignment
              ? `${topAssignment.assignmentLabel} had ${topAssignment.count} unique student${
                  topAssignment.count === 1 ? "" : "s"
                }.`
              : "No assignment data found."}
          </p>
        </div>

        <div className="rounded-xl border p-4">
          <p className="text-sm font-medium">Return usage</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {repeatStudents} repeat student
            {repeatStudents === 1 ? "" : "s"} and {oneTimeStudents} one-time
            student{oneTimeStudents === 1 ? "" : "s"} were found.
          </p>
        </div>
      </div>

      <div className="rounded-xl border p-4">
        <h3 className="text-base font-semibold">Participation Summary</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Each assignment had an average of{" "}
          <span className="font-medium text-foreground">
            {averageUsersPerAssignment.toFixed(1)} unique students
          </span>
          . The most active student was{" "}
          <span className="font-medium text-foreground">
            {topStudentByMessages?.studentLabel ?? "N/A"}
          </span>
          , and the assignment with the widest reach was{" "}
          <span className="font-medium text-foreground">
            {topAssignment?.assignmentLabel ?? "N/A"}
          </span>
          .
        </p>
      </div>
    </div>
  );
};

export default UniqueUsersCard;