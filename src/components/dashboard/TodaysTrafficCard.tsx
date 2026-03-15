import { Car } from "lucide-react";
import { useMemo } from "react";
import { Message } from "@/types";

type TodaysTrafficCardProps = {
  messages: Message[];
};

const getNestedValue = (
  obj: Record<string, unknown>,
  paths: string[][],
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

const getAssignmentInfo = (
  message: Message,
): { key: string; label: string } | null => {
  const msg = message as Record<string, unknown>;

  const value = getNestedValue(msg, [
    ["assignmentName"],
    ["assignmentTitle"],
    ["assignmentId"],
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

const getStudentKey = (message: Message): string | null => {
  const msg = message as Record<string, unknown>;

  const value = getNestedValue(msg, [
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

const TodaysTrafficCard = ({ messages }: TodaysTrafficCardProps) => {
  const trafficData = useMemo(() => {
    const assignmentMap = new Map<
      string,
      { label: string; uniqueStudents: Set<string> }
    >();

    messages.forEach((message) => {
      const assignment = getAssignmentInfo(message);
      const studentKey = getStudentKey(message);

      if (!assignment || !studentKey) return;

      if (!assignmentMap.has(assignment.key)) {
        assignmentMap.set(assignment.key, {
          label: assignment.label,
          uniqueStudents: new Set<string>(),
        });
      }

      assignmentMap.get(assignment.key)!.uniqueStudents.add(studentKey);
    });

    if (assignmentMap.size === 0) {
      return {
        assignmentLabel: "this assignment",
        totalTraffic: 0,
      };
    }

    const topAssignment = Array.from(assignmentMap.values()).sort(
      (a, b) => b.uniqueStudents.size - a.uniqueStudents.size,
    )[0];

    return {
      assignmentLabel: topAssignment.label,
      totalTraffic: topAssignment.uniqueStudents.size,
    };
  }, [messages]);

  return (
    <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            Total Traffic
          </h2>
          <p className="mt-6 text-4xl font-bold text-slate-900">
            {trafficData.totalTraffic}
          </p>
          <p className="mt-2 text-base text-slate-700">
            AI Tutor users for assignment: {trafficData.assignmentLabel}
          </p>
        </div>
        <div className="rounded-full bg-white/80 p-3 text-orange-700">
          <Car size={24} />
        </div>
      </div>
    </div>
  );
};

export default TodaysTrafficCard;
