
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

  const maxAssignmentCount = Math.max(
    ...assignmentData.map((item) => item.count),
    1
  );

  const maxStudentMessages = Math.max(
    ...studentData.map((student) => student.messageCount),
    1
  );

  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm dark:bg-zinc-900">
      <div className="mb-5">
        <h2 className="text-xl font-semibold">Unique Student Insights</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          This view shows not only how many different students appeared in the
          logs, but also which students were most active, which assignments had
          the broadest participation, and whether usage was concentrated among a
          few students or spread across many.
        </p>
      </div>

      <div className="mb-6 grid gap-3 md:grid-cols-4">
        <div className="rounded-xl border p-4">
          <p className="text-sm text-muted-foreground">Total Unique Students</p>
          <p className="mt-2 text-3xl font-bold">{overallUniqueUsers}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Distinct students found across all uploaded logs.
          </p>
        </div>

        <div className="rounded-xl border p-4">
          <p className="text-sm text-muted-foreground">Total Messages</p>
          <p className="mt-2 text-3xl font-bold">{totalMessages}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Total student activity records included in this dataset.
          </p>
        </div>

        <div className="rounded-xl border p-4">
          <p className="text-sm text-muted-foreground">Assignments Tracked</p>
          <p className="mt-2 text-3xl font-bold">{totalAssignments}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Assignments with usable student activity.
          </p>
        </div>

        <div className="rounded-xl border p-4">
          <p className="text-sm text-muted-foreground">
            Avg. Messages Per Student
          </p>
          <p className="mt-2 text-3xl font-bold">
            {averageMessagesPerStudent.toFixed(1)}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Average level of activity per unique student.
          </p>
        </div>
      </div>

      <div className="mb-6 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border p-4">
          <p className="text-sm text-muted-foreground">
            Most Active Student
          </p>
          <p className="mt-1 text-lg font-semibold">
            {topStudentByMessages?.studentLabel ?? "No student found"}
          </p>
          <p className="mt-2 text-3xl font-bold">
            {topStudentByMessages?.messageCount ?? 0}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Highest total number of messages in the uploaded logs.
          </p>
          {topStudentByMessages && (
            <p className="mt-2 text-xs text-muted-foreground">
              Also appeared in {topStudentByMessages.assignmentsCount} assignment
              {topStudentByMessages.assignmentsCount === 1 ? "" : "s"}.
            </p>
          )}
        </div>

        <div className="rounded-xl border p-4">
          <p className="text-sm text-muted-foreground">
            Broadest Assignment Coverage
          </p>
          <p className="mt-1 text-lg font-semibold">
            {topStudentByAssignments?.studentLabel ?? "No student found"}
          </p>
          <p className="mt-2 text-3xl font-bold">
            {topStudentByAssignments?.assignmentsCount ?? 0}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Student who appeared across the most assignments.
          </p>
          {topStudentByAssignments && (
            <p className="mt-2 text-xs text-muted-foreground">
              Contributed {topStudentByAssignments.messageCount} total message
              {topStudentByAssignments.messageCount === 1 ? "" : "s"}.
            </p>
          )}
        </div>
      </div>

      <div className="mb-6 grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border p-4">
          <p className="text-sm text-muted-foreground">Top Assignment</p>
          <p className="mt-1 text-lg font-semibold">
            {topAssignment?.assignmentLabel ?? "No assignment found"}
          </p>
          <p className="mt-2 text-3xl font-bold">{topAssignment?.count ?? 0}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Assignment with the highest number of distinct students.
          </p>
        </div>

        <div className="rounded-xl border p-4">
          <p className="text-sm text-muted-foreground">Repeat Students</p>
          <p className="mt-2 text-3xl font-bold">{repeatStudents}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Students who appeared more than once in the logs.
          </p>
        </div>

        <div className="rounded-xl border p-4">
          <p className="text-sm text-muted-foreground">One-Time Students</p>
          <p className="mt-2 text-3xl font-bold">{oneTimeStudents}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Students who appeared only once in the logs.
          </p>
        </div>
      </div>

      <div className="mb-6 rounded-xl border p-4">
        <h3 className="text-base font-semibold">Participation Summary</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          On average, each assignment had{" "}
          <span className="font-medium text-foreground">
            {averageUsersPerAssignment.toFixed(1)}
          </span>{" "}
          unique students. The most active student was{" "}
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

      <div className="mb-3">
        <h3 className="text-base font-semibold">Top Students by Usage</h3>
        <p className="text-sm text-muted-foreground">
          This ranking shows which students used the system the most based on
          total message count. It also shows how many different assignments each
          student appeared in.
        </p>
      </div>

      <div className="mb-8 space-y-4">
        {studentData.length === 0 ? (
          <p className="text-sm text-muted-foreground">No student log data found.</p>
        ) : (
          studentData.slice(0, 5).map((student, index) => {
            const widthPercent = (student.messageCount / maxStudentMessages) * 100;

            return (
              <div key={student.studentKey} className="space-y-2">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Rank #{index + 1}
                    </p>
                    <p className="text-sm font-medium">{student.studentLabel}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">{student.messageCount}</p>
                    <p className="text-xs text-muted-foreground">messages</p>
                  </div>
                </div>

                <div className="h-4 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-zinc-900 transition-all dark:bg-zinc-200"
                    style={{ width: `${widthPercent}%` }}
                  />
                </div>

                <p className="text-xs text-muted-foreground">
                  Appeared in {student.assignmentsCount} assignment
                  {student.assignmentsCount === 1 ? "" : "s"}.
                  {student.assignments.length > 0 && (
                    <> Recent matches: {student.assignments.slice(0, 3).join(", ")}.</>
                  )}
                </p>
              </div>
            );
          })
        )}
      </div>

      <div className="mb-3">
        <h3 className="text-base font-semibold">Assignments by Unique Students</h3>
        <p className="text-sm text-muted-foreground">
          Longer bars mean more unique students worked on that assignment.
        </p>
      </div>

      <div className="space-y-4">
        {assignmentData.length === 0 ? (
          <p className="text-sm text-muted-foreground">No assignment data found.</p>
        ) : (
          assignmentData.slice(0, 8).map((assignment, index) => {
            const widthPercent = (assignment.count / maxAssignmentCount) * 100;

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