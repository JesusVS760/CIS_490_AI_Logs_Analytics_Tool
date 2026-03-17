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

const looksLikeEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

const toTitleCase = (value: string) =>
  value.replace(/\b\w/g, (char) => char.toUpperCase());

const formatStudentDisplayLabel = (label: string) => {
  const value = label.trim();

  if (!looksLikeEmail(value)) {
    return value;
  }

  const localPart = value.split("@")[0];

  const cleaned = localPart
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return toTitleCase(cleaned);
};

const maskEmail = (email: string) => {
  const trimmed = email.trim();
  if (!looksLikeEmail(trimmed)) return trimmed;

  const [local, domain] = trimmed.split("@");
  if (!local || !domain) return trimmed;

  if (local.length <= 2) {
    return `${local[0] ?? ""}***@${domain}`;
  }

  return `${local.slice(0, 2)}***@${domain}`;
};

const truncateText = (value: string, max = 32) => {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}...`;
};

const formatStudentSecondaryLabel = (
  studentLabel: string,
  studentKey: string
): string | null => {
  if (looksLikeEmail(studentLabel)) {
    return maskEmail(studentLabel);
  }

  if (looksLikeEmail(studentKey)) {
    return maskEmail(studentKey);
  }

  const cleanedKey = studentKey.trim();
  const cleanedLabel = studentLabel.trim().toLowerCase();

  if (cleanedKey && cleanedKey.toLowerCase() !== cleanedLabel) {
    return `ID: ${truncateText(cleanedKey, 24)}`;
  }

  return null;
};

// Stable grouping key: prefer email / IDs, not name text.
const getStudentKey = (message: Message): string | null => {
  const msg = message as Record<string, unknown>;

  const value = getNestedString(msg, [
    ["studentEmail"],
    ["email"],
    ["student"],
    ["studentName"],
    ["studentIdentifier"],
    ["studentId"],
    ["studentAnonymousId"],
    ["userId"],
    ["senderEmail"],
    ["senderId"],
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

  return value ? value.toLowerCase().trim() : null;
};

// Best user-facing label available from the logs.
const getStudentLabel = (message: Message): string | null => {
  const msg = message as Record<string, unknown>;

  const explicitName = getNestedString(msg, [
    ["studentFullName"],
    ["fullName"],
    ["student", "name"],
    ["session", "student", "name"],
  ]);

  if (explicitName && !looksLikeEmail(explicitName)) {
    return explicitName;
  }

  const transcriptStudentValue = getNestedString(msg, [
    ["studentEmail"],
    ["email"],
    ["student"],
    ["studentName"],
    ["studentIdentifier"],
    ["senderEmail"],
    ["student", "email"],
    ["session", "studentEmail"],
    ["session", "student", "email"],
  ]);

  if (transcriptStudentValue) {
    return transcriptStudentValue;
  }

  return getNestedString(msg, [
    ["studentId"],
    ["studentAnonymousId"],
    ["userId"],
    ["senderId"],
    ["student", "id"],
    ["student", "anonymousId"],
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

const isBetterStudentLabel = (currentLabel: string, nextLabel: string) => {
  const currentIsEmail = looksLikeEmail(currentLabel);
  const nextIsEmail = looksLikeEmail(nextLabel);

  if (currentIsEmail && !nextIsEmail) return true;
  if (!currentIsEmail && nextIsEmail) return false;

  return nextLabel.length > currentLabel.length;
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

    if (isBetterStudentLabel(current.label, studentLabel)) {
      current.label = studentLabel;
    }

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
        <h2 className="text-xl font-semibold">Student Activity</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          A quick look at who has shown up in the uploaded logs and where most
          of the activity is happening.
        </p>
      </div>

      <div className="mb-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border p-4">
          <p className="text-sm font-medium">Students found</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {overallUniqueUsers} student
            {overallUniqueUsers === 1 ? "" : "s"} showed up across the current
            set of logs.
          </p>
        </div>

        <div className="rounded-xl border p-4">
          <p className="text-sm font-medium">Messages captured</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {totalMessages} message{totalMessages === 1 ? "" : "s"} were tied to
            student activity.
          </p>
        </div>

        <div className="rounded-xl border p-4">
          <p className="text-sm font-medium">Assignments with activity</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {totalAssignments} assignment
            {totalAssignments === 1 ? "" : "s"} had at least one student appear
            in the logs.
          </p>
        </div>

        <div className="rounded-xl border p-4">
          <p className="text-sm font-medium">Average activity per student</p>
          <p className="mt-2 text-sm text-muted-foreground">
            On average, each student contributed{" "}
            {averageMessagesPerStudent.toFixed(1)} message
            {Number(averageMessagesPerStudent.toFixed(1)) === 1 ? "" : "s"}.
          </p>
        </div>
      </div>

      <div className="mb-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border p-4">
          <p className="text-sm font-medium">Most active student</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {topStudentByMessages
              ? `${formatStudentDisplayLabel(
                  topStudentByMessages.studentLabel
                )} had ${
                  topStudentByMessages.messageCount
                } logged message${
                  topStudentByMessages.messageCount === 1 ? "" : "s"
                }.`
              : "No student activity found yet."}
          </p>
        </div>

        <div className="rounded-xl border p-4">
          <p className="text-sm font-medium">Worked across the most assignments</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {topStudentByAssignments
              ? `${formatStudentDisplayLabel(
                  topStudentByAssignments.studentLabel
                )} appeared in ${
                  topStudentByAssignments.assignmentsCount
                } assignment${
                  topStudentByAssignments.assignmentsCount === 1 ? "" : "s"
                }.`
              : "No student activity found yet."}
          </p>
        </div>

        <div className="rounded-xl border p-4">
          <p className="text-sm font-medium">Assignment with the widest reach</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {topAssignment
              ? `${topAssignment.assignmentLabel} involved ${
                  topAssignment.count
                } unique student${topAssignment.count === 1 ? "" : "s"}.`
              : "No assignment activity found yet."}
          </p>
        </div>

        <div className="rounded-xl border p-4">
          <p className="text-sm font-medium">Returning vs one-time students</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {repeatStudents} returning and {oneTimeStudents} one-time student
            {oneTimeStudents === 1 ? "" : "s"} were found in this upload.
          </p>
        </div>
      </div>

      <div className="mb-6 rounded-xl border p-4">
        <h3 className="text-base font-semibold">What stands out</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Student activity is spread across{" "}
          <span className="font-medium text-foreground">
            {totalAssignments} assignment{totalAssignments === 1 ? "" : "s"}
          </span>
          , with an average of{" "}
          <span className="font-medium text-foreground">
            {averageUsersPerAssignment.toFixed(1)} students per assignment
          </span>
          .{" "}
          {topStudentByMessages ? (
            <>
              The busiest student in the current logs is{" "}
              <span className="font-medium text-foreground">
                {formatStudentDisplayLabel(topStudentByMessages.studentLabel)}
              </span>
              , while{" "}
              <span className="font-medium text-foreground">
                {topAssignment?.assignmentLabel ?? "N/A"}
              </span>{" "}
              drew the broadest participation.
            </>
          ) : (
            "Upload more logs to surface student patterns here."
          )}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border p-4">
          <h3 className="text-base font-semibold">Students behind the activity</h3>
          <div className="mt-3 space-y-3">
            {studentData.slice(0, 5).map((student) => {
              const primaryName = formatStudentDisplayLabel(student.studentLabel);
              const secondaryLabel = formatStudentSecondaryLabel(
                student.studentLabel,
                student.studentKey
              );

              return (
                <div
                  key={student.studentKey}
                  className="rounded-lg border p-3 text-sm"
                >
                  <p className="font-medium text-foreground">{primaryName}</p>

                  {secondaryLabel && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {secondaryLabel}
                    </p>
                  )}

                  <p className="mt-2 text-muted-foreground">
                    {student.messageCount} logged message
                    {student.messageCount === 1 ? "" : "s"} across{" "}
                    {student.assignmentsCount} assignment
                    {student.assignmentsCount === 1 ? "" : "s"}.
                  </p>

                  {student.assignments.length > 0 && (
                    <p className="mt-1 text-muted-foreground">
                      Worked on: {student.assignments.slice(0, 3).join(", ")}
                      {student.assignments.length > 3 ? " ..." : ""}
                    </p>
                  )}
                </div>
              );
            })}

            {studentData.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No student activity found.
              </p>
            )}
          </div>
        </div>

        <div className="rounded-xl border p-4">
          <h3 className="text-base font-semibold">Where students are showing up</h3>
          <div className="mt-3 space-y-3">
            {assignmentData.slice(0, 5).map((assignment) => (
              <div
                key={assignment.assignmentKey}
                className="rounded-lg border p-3 text-sm"
              >
                <p className="font-medium text-foreground">
                  {assignment.assignmentLabel}
                </p>
                <p className="mt-1 text-muted-foreground">
                  {assignment.count} student
                  {assignment.count === 1 ? "" : "s"} appeared in this
                  assignment.
                </p>
              </div>
            ))}

            {assignmentData.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No assignment activity found.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UniqueUsersCard;