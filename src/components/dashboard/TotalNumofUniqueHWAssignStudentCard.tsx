"use client";

import React, { useMemo } from "react";
import { Message } from "@/types";
import { useDashboardAssignmentFilter } from "@/components/dashboard/DashboardAssignmentFilterContext";

type TotalNumofUniqueHWAssignStudentCardProps = {
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

function getAssignmentLabel(message: Message): string {
  const m = message as Record<string, unknown>;

  return (
    getNestedString(m, [
      ["assignmentName"],
      ["assignment", "name"],
      ["session", "assignmentName"],
      ["metadata", "assignmentName"],
      ["hwName"],
      ["homeworkName"],
    ]) ?? "Unknown Assignment"
  );
}

export default function TotalNumofUniqueHWAssignStudentCard({
  messages,
}: TotalNumofUniqueHWAssignStudentCardProps) {
  const { selectedAssignment } = useDashboardAssignmentFilter();

  const filteredMessages = useMemo(() => {
    if (selectedAssignment === "all") return messages;

    return messages.filter(
      (message) => getAssignmentLabel(message) === selectedAssignment
    );
  }, [messages, selectedAssignment]);

  const chartData = useMemo(() => {
    const studentAssignments = new Map<string, Set<string>>();

    for (const message of filteredMessages) {
      const student = getStudentLabel(message);
      const assignment = getAssignmentLabel(message);

      if (!studentAssignments.has(student)) {
        studentAssignments.set(student, new Set());
      }

      if (assignment !== "Unknown Assignment") {
        studentAssignments.get(student)!.add(assignment);
      }
    }

    return Array.from(studentAssignments.entries())
      .map(([student, assignments]) => ({
        student,
        uniqueHWCount: assignments.size,
      }))
      .sort((a, b) => b.uniqueHWCount - a.uniqueHWCount);
  }, [filteredMessages]);

  const maxCount = Math.max(...chartData.map((item) => item.uniqueHWCount), 1);

  return (
    <section className="rounded-lg border bg-white p-6 shadow-sm">
      <div className="mb-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Unique HW Assignments per Student
            </h2>
            <p className="mt-1 text-[11px] text-slate-600">
              Based on uploaded transcript log data.
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
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
          No assignment data available for the selected assignment.
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-end justify-between text-[10px] font-medium text-slate-500">
            <span>Students</span>
            <span>Unique HW Assignments</span>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[500px]">
              <div className="flex h-[210px] items-end gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
                {chartData.map((item) => {
                  const heightPercent = (item.uniqueHWCount / maxCount) * 100;

                  return (
                    <div
                      key={item.student}
                      className="flex min-w-[48px] flex-1 flex-col items-center justify-end"
                    >
                      <span className="mb-1 text-[10px] font-semibold text-slate-700">
                        {item.uniqueHWCount}
                      </span>

                      <div className="flex h-[145px] items-end">
                        <div
                          className="w-8 rounded-t-md bg-indigo-500 transition-all duration-300"
                          style={{
                            height: `${Math.max(heightPercent, 6)}%`,
                          }}
                          title={`${item.student}: ${item.uniqueHWCount} unique assignment${item.uniqueHWCount === 1 ? "" : "s"}`}
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
