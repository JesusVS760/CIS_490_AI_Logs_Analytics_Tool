"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Settings } from "lucide-react";
import SearchBar from "./SearchBar";

export default function Navbar() {
  return (
    <header className="sticky top-0 z-10 flex items-center gap-4 border-b bg-background px-4 h-14">
      <div className="md:hidden">
        <SidebarTrigger />
      </div>
      <div className="flex justify-between w-full">
        <h1 className="text-lg font-semibold">AI Tutor Analytics</h1>
        <div>
          <button
            type="button"
            className="cursor-pointer flex items-center gap-3"
          >
            <SearchBar />
            <Settings />
          </button>
        </div>
      </div>
    </header>
  );
}
