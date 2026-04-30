"use client";

import React, { useMemo } from "react";
import { Message } from "@/types";
import { useDashboardAssignmentFilter } from "@/components/dashboard/DashboardAssignmentFilterContext";

export default function UniqueAssignmentsPerStudentCard({
  messages,
}: {
  messages: Message[];
}) {
  const { selectedAssignment } = useDashboardAssignmentFilter();

  const filteredMessages = useMemo(() => {
    if (selectedAssignment === "all") return messages;
    return messages.filter(
      (message) => message.assignmentName === selectedAssignment,
    );
  }, [messages, selectedAssignment]);

  const { chartData, idToDisplay } = useMemo(() => {
    // Build a stable display-number map from ALL messages (not just the filtered subset).
    // This ensures "Student 1", "Student 2", etc. always refer to the same real student
    // regardless of which assignment filter is active.
    const allIds = Array.from(
      new Set(messages.map((m) => Number(m.studentId))),
    ).sort((a, b) => a - b);
    const idToDisplay = new Map(allIds.map((id, i) => [String(id), i + 1]));

    // Count unique assignments per student using only the filtered messages.
    const studentAssignments = new Map<string, Set<string>>();

    for (const message of filteredMessages) {
      const student = String(message.studentId);
      const assignment = message.assignmentName;

      if (!studentAssignments.has(student)) {
        studentAssignments.set(student, new Set());
      }
      studentAssignments.get(student)!.add(assignment);
    }

    const chartData = Array.from(studentAssignments.entries())
      .map(([student, assignments]) => ({
        student,
        uniqueHWCount: assignments.size,
      }))
      .sort(
        (a, b) =>
          (idToDisplay.get(a.student) ?? 0) - (idToDisplay.get(b.student) ?? 0),
      );
    return { chartData, idToDisplay };
  }, [filteredMessages]);

  const maxCount = Math.max(...chartData.map((item) => item.uniqueHWCount), 1);

  return (
    <section className="rounded-2xl border border-gray-100 p-6 shadow-sm w-full bg-white dark:bg-zinc-900">
      <div className="mb-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="flex items-center gap-2 font-bold text-lg">
              Unique HW Assignments Per Student
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Based on uploaded transcript log data.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
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
          <div className="flex items-end justify-between mt-1 text-md text-foreground">
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
                          title={`Student ${idToDisplay.get(item.student)}: ${item.uniqueHWCount} unique assignment${item.uniqueHWCount === 1 ? "" : "s"}`}
                        />
                      </div>

                      <span className="mt-2 w-full break-words text-center text-[10px] text-slate-600">
                        Student: {idToDisplay.get(item.student)}
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
