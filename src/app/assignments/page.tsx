import { redirect } from "next/navigation";
import { requireAuthPage } from "@/lib/requireAuthPage";
import db from "@/lib/db";
import AssignmentsUsersChart from "../../components/assignments/AssignmentsUsersChart";
import MessagesPerAssignmentCard from "../../components/dashboard/MessagesPerAssignmentCard";

export default async function AssignmentsPage() {
  const { instructorId } = await requireAuthPage();

  const result = await db.execute({
    sql: `SELECT COUNT(*) as count
          FROM sessions s
          JOIN assignments a ON s.assignment_id = a.id
          JOIN courses c ON a.course_id = c.id
          WHERE c.instructor_id = ?`,
    args: [instructorId],
  });

  const count = Number(result.rows[0]?.[0] ?? 0);

  if (count === 0) {
    redirect("/upload");
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <h1 className="text-2xl font-bold">Assignments</h1>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <AssignmentsUsersChart />
        <MessagesPerAssignmentCard />
      </div>
    </div>
  );
}
