"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import axios from "axios";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  Upload,
  Settings,
  LogOut,
  CircleUserIcon,
  Book,
} from "lucide-react";

const navItems = [
  { title: "Dashboard", icon: LayoutDashboard, href: "/" },
  { title: "Upload", icon: Upload, href: "/upload" },
  { title: "Assignment", icon: Book, href: "/assignments" },
  { title: "Settings", icon: Settings, href: "/settings" },
  { title: "Logout", icon: LogOut, href: "/logout" },
];

type ProfileUpdatedDetail = {
  nameUser?: string;
  profilePic?: string | null;
};

type StoredUser = {
  nameUser: string;
  profilePic: string | null;
};

export function AppSidebar() {
  const [nameUser, setNameUser] = useState("User");
  const [profilePic, setProfilePic] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const storedUserRaw = localStorage.getItem("dashboardUser");

    if (storedUserRaw) {
      try {
        const storedUser: StoredUser = JSON.parse(storedUserRaw);
        if (isMounted) {
          setNameUser(storedUser.nameUser || "User");
          setProfilePic(storedUser.profilePic || null);
        }
      } catch (error) {
        console.error("Failed to parse stored sidebar user:", error);
      }
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
            res.data?.user?.profilePic ?? res.data?.profilePic ?? null,
        };

        setNameUser(nextUser.nameUser);
        setProfilePic(nextUser.profilePic);
        localStorage.setItem("dashboardUser", JSON.stringify(nextUser));
      } catch (error) {
        if (!isMounted) return;
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

      const cached = localStorage.getItem("dashboardUser");
      let parsed: StoredUser = { nameUser: "User", profilePic: null };

      if (cached) {
        try {
          parsed = JSON.parse(cached);
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
    <Sidebar collapsible="offcanvas" className="relative z-10 h-full">
      <SidebarHeader className="px-4 py-3 text-lg font-semibold">
        <div className="flex flex-row items-center justify-start gap-3">
          {profilePic ? (
            <img
              src={profilePic}
              alt="Profile"
              className="h-10 w-10 rounded-full border border-gray-300 object-cover dark:border-gray-700"
            />
          ) : (
            <CircleUserIcon size={20} />
          )}

          <div className="min-w-0">
            <p className="truncate">{nameUser}</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild className="cursor-pointer">
                    <Link href={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="px-4 py-3 text-sm text-muted-foreground">
        Signed in as {nameUser}
      </SidebarFooter>
    </Sidebar>
  );
}
