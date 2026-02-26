"use client";

import { Bell } from "lucide-react";
import React from "react";

/* ADD FUNCTIONALITY FOR BELL BUTTON  */
const Notifications = () => {
  const handleClick = () => {};

  return (
    <>
      <button className="cursor-pointer" onClick={handleClick}>
        <Bell />
      </button>
    </>
  );
};

export default Notifications;
