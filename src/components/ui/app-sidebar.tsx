"use client";

import React, { useEffect, useState } from "react";
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
} from "lucide-react";

const navItems = [
  { title: "Dashboard", icon: LayoutDashboard, href: "/" },
  { title: "Upload", icon: Upload, href: "/upload" },
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
    const storedUserRaw = localStorage.getItem("dashboardUser");

    if (storedUserRaw) {
      try {
        const storedUser: StoredUser = JSON.parse(storedUserRaw);
        setNameUser(storedUser.nameUser || "User");
        setProfilePic(storedUser.profilePic || null);
      } catch (error) {
        console.error("Failed to parse stored sidebar user:", error);
      }
    }

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
    <Sidebar collapsible="offcanvas" className="relative z-10 h-full">
      <SidebarHeader className="px-4 py-3 text-lg font-semibold">
        <div className="flex flex-row items-center justify-start gap-3">
          {profilePic ? (
            <img
              src={profilePic}
              alt="Profile"
              className="h-10 w-10 rounded-full object-cover border border-gray-300 dark:border-gray-700"
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
                    <a href={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </a>
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