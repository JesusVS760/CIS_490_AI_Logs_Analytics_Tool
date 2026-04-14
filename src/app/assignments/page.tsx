import { redirect } from "next/navigation";
import { requireAuthPage } from "@/lib/requireAuthPage";
import db from "@/lib/db";
import AssignmentsUsersChart from "../../components/assignments/AssignmentsUsersChart";
import MessagesPerAssignmentCard from "../../components/dashboard/MessagesPerAssignmentCard";

export default async function AssignmentsPage() {
  // Auth check — redirects to /login if no valid session.
  // Now also returns the instructor_id so we can scope the log check below.
  const { instructorId } = await requireAuthPage();

  // Gate the page behind having uploaded logs.
  // Count this instructor's sessions by joining sessions -> assignments -> courses,
  // since courses.instructor_id is the source of truth for data scoping.
  const row = db
    .prepare(
      `SELECT COUNT(*) as count
       FROM sessions s
       JOIN assignments a ON s.assignment_id = a.id
       JOIN courses c ON a.course_id = c.id
       WHERE c.instructor_id = ?`
    )
    .get(instructorId) as { count: number };

  // No logs yet → bounce the instructor to the upload page.
  // They'll come back here automatically once data exists.
  if (row.count === 0) {
    redirect("/upload");
  }

  // Has logs → render the analytics cards as normal.
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