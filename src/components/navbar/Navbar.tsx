"use client";

import React, { useEffect, useState } from "react";
import axios from "axios";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  LineChart,
  Settings,
  CircleUserIcon,
} from "lucide-react";
import Notifications from "./Notifications";
import SearchBar from "./SearchBar";

type ProfileUpdatedDetail = {
  nameUser?: string;
  profilePic?: string | null;
};

export default function Navbar() {
  const [nameUser, setNameUser] = useState("User");
  const [profilePic, setProfilePic] = useState<string | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
  try {
    const res = await axios.get("/api/auth/me", {
      withCredentials: true,
    });

    const user = res.data.user;

    setNameUser(user?.name || "User");
    setProfilePic(user?.profilePic || null);
  } catch (error) {
    console.error("Failed to load navbar user:", error);
  }
};

    fetchUser();

    const handleProfileUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<ProfileUpdatedDetail>;

      if (typeof customEvent.detail?.nameUser === "string") {
        setNameUser(customEvent.detail.nameUser);
      }

      if (customEvent.detail?.profilePic !== undefined) {
        setProfilePic(customEvent.detail.profilePic);
      }
    };

    window.addEventListener("profile-updated", handleProfileUpdated);

    return () => {
      window.removeEventListener("profile-updated", handleProfileUpdated);
    };
  }, []);

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background px-4">
      <div className="md:hidden">
        <SidebarTrigger />
      </div>

      <div className="flex w-full items-center justify-between">
        <div className="flex items-center justify-center gap-2">
          <h1 className="text-lg font-semibold">AI Tutor Analytics</h1>
          <LineChart className="hidden md:block" />
        </div>

        <section className="flex items-center gap-3">
          <SearchBar />
          <Notifications />

          <a
            href="/settings"
            className="flex items-center gap-2 rounded-md px-2 py-1 transition hover:bg-muted"
          >
            {profilePic ? (
              <img
                src={profilePic}
                alt="Profile"
                className="h-8 w-8 rounded-full object-cover border border-gray-300 dark:border-gray-700"
              />
            ) : (
              <CircleUserIcon className="h-8 w-8" />
            )}

            <div className="hidden md:flex flex-col leading-tight">
              <span className="max-w-[120px] truncate text-sm font-medium">
                {nameUser}
              </span>
              <span className="text-xs text-muted-foreground">
                Settings
              </span>
            </div>

            <Settings className="h-4 w-4" />
          </a>
        </section>
      </div>
    </header>
  );
}