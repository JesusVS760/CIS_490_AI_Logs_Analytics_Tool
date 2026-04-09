import { requireAuthPage } from "@/lib/requireAuthPage";
import AssignmentsUsersChart from "../../components/assignments/AssignmentsUsersChart";
import MessagesPerAssignmentCard from "../../components/dashboard/MessagesPerAssignmentCard";

export default async function AssignmentsPage() {
  await requireAuthPage();

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
