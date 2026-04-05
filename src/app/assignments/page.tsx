import React from "react";
import AssignmentsUsersChart from "../../components/assignments/AssignmentsUsersChart";
import MessagesPerAssignmentCard from "../../components/dashboard/MessagesPerAssignmentCard";


const AssignmentsPage = () => {
  return (
    <div>
      <h1>Assignments</h1>
      <AssignmentsUsersChart />
      <MessagesPerAssignmentCard />
    </div>
  );
};

export default AssignmentsPage;