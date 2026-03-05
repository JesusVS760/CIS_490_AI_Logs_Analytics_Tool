import React from "react";
import ChatDuration from "./ChatDuration";
import UniqueUsersCard from "./UniqueUsersCard";

const AnalyticsDashboard = () => {
  return (
    <div className="w-85">
      <ChatDuration />
      <UniqueUsersCard />
    </div>
  );
};

export default AnalyticsDashboard;
