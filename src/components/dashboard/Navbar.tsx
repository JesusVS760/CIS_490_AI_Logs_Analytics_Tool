"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { ChartBar, LineChart, Settings } from "lucide-react";
import SearchBar from "./SearchBar";
import Notifications from "./Notifications";

export default function Navbar() {
  return (
    <header className="sticky top-0 z-10 flex items-center gap-4 border-b bg-background px-4 h-14">
      <div className="md:hidden">
        <SidebarTrigger />
      </div>
      <div className="flex justify-between w-full">
        <div className="flex items-center justify-center gap-2">
          <h1 className="text-lg font-semibold">AI Tutor Analytics</h1>
          <LineChart className="hidden md:block" />
        </div>
        <div>
          <section className="cursor-pointer flex items-center gap-3">
            <SearchBar />
            <Notifications />
            <a href="/settings">
              <Settings />
            </a>
          </section>
        </div>
      </div>
    </header>
  );
}
