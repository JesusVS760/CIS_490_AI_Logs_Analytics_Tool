"use client";

import React, { useEffect, useState } from "react";
import axios from "axios";
import Link from "next/link";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  LineChart,
  Settings,
  CircleUserIcon,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Notifications from "./Notifications";
import SearchBar from "./SearchBar";

type ProfileUpdatedDetail = {
  nameUser?: string;
  profilePic?: string | null;
};

type StoredUser = {
  nameUser: string;
  profilePic: string | null;
};

export default function Navbar() {
  const [nameUser, setNameUser] = useState("User");
  const [profilePic, setProfilePic] = useState<string | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const cached = localStorage.getItem("dashboardUser");
    if (cached) {
      try {
        const parsed: StoredUser = JSON.parse(cached);
        if (isMounted) {
          setNameUser(parsed.nameUser || "User");
          setProfilePic(parsed.profilePic || null);
        }
      } catch {}
    }

    const fetchCurrentUser = async () => {
      try {
        const res = await axios.get("/api/auth/me", {
          withCredentials: true,
        });

        if (!isMounted) return;

        const nextUser: StoredUser = {
          nameUser:
            res.data?.user?.name ||
            res.data?.username ||
            res.data?.user?.email ||
            "User",
          profilePic:
            res.data?.user?.profilePic ??
            res.data?.profilePic ??
            null,
        };

        setNameUser(nextUser.nameUser);
        setProfilePic(nextUser.profilePic);
        localStorage.setItem("dashboardUser", JSON.stringify(nextUser));
      } catch (error) {
        if (!isMounted) return;

        setNameUser("User");
        setProfilePic(null);
        localStorage.removeItem("dashboardUser");
      } finally {
        if (isMounted) {
          setLoadingUser(false);
        }
      }
    };

    fetchCurrentUser();

    const handleProfileUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<ProfileUpdatedDetail>;

      setNameUser((prev) =>
        typeof customEvent.detail?.nameUser === "string"
          ? customEvent.detail.nameUser
          : prev
      );

      setProfilePic((prev) =>
        customEvent.detail?.profilePic !== undefined
          ? customEvent.detail.profilePic ?? null
          : prev
      );

      const cachedUser = localStorage.getItem("dashboardUser");
      let parsed: StoredUser = { nameUser: "User", profilePic: null };

      if (cachedUser) {
        try {
          parsed = JSON.parse(cachedUser);
        } catch {}
      }

      const updatedUser: StoredUser = {
        nameUser:
          typeof customEvent.detail?.nameUser === "string"
            ? customEvent.detail.nameUser
            : parsed.nameUser,
        profilePic:
          customEvent.detail?.profilePic !== undefined
            ? customEvent.detail.profilePic ?? null
            : parsed.profilePic,
      };

      localStorage.setItem("dashboardUser", JSON.stringify(updatedUser));
    };

    window.addEventListener("profile-updated", handleProfileUpdated);

    return () => {
      isMounted = false;
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

          <Link
            href="/settings"
            className="flex items-center gap-2 rounded-md px-2 py-1 transition hover:bg-muted"
          >
            {profilePic ? (
              <img
                src={profilePic}
                alt="Profile"
                className="h-8 w-8 rounded-full border border-gray-300 object-cover dark:border-gray-700"
              />
            ) : (
              <CircleUserIcon className="h-8 w-8" />
            )}

            <div className="hidden flex-col leading-tight md:flex">
              <span className="max-w-[120px] truncate text-sm font-medium">
                {loadingUser ? "Loading..." : nameUser}
              </span>
              <span className="text-xs text-muted-foreground">Settings</span>
            </div>

            <Settings className="h-4 w-4" />
          </Link>

          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link href="/logout">
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </Link>
          </Button>
        </section>
      </div>
    </header>
  );
}