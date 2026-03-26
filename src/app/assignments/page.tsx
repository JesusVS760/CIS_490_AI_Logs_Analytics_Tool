import React from "react";
import AssignmentsUsersChart from "../../components/assignments/AssignmentsUsersChart";

console.log("AssignmentsUsersGraph:", AssignmentsUsersChart);

const AssignmentsPage = () => {
  return (
    <div>
      <h1>Assignments</h1>
      <AssignmentsUsersChart />
    </div>
  );
};

export default AssignmentsPage;