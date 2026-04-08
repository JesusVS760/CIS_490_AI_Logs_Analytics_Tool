import { requireAuthPage } from "@/lib/requireAuthPage";
import React from "react";
import AssignmentsUsersChart from "../../components/assignments/AssignmentsUsersChart";
import MessagesPerAssignmentCard from "../../components/dashboard/MessagesPerAssignmentCard";

export default async function AssignmentsPage() {
  await requireAuthPage();

  return (
    <div>
      <h1>Assignments</h1>
      <AssignmentsUsersChart />
      <MessagesPerAssignmentCard />
    </div>
  );
}