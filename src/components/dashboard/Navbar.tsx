"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";

export default function Navbar() {
  return (
    <header className="sticky top-0 z-10 flex items-center gap-4 border-b bg-background px-4 h-14">
      <div className="md:hidden">
        <SidebarTrigger />
      </div>
      <h1 className="text-lg font-semibold">AI Tutor Analytics</h1>
    </header>
  );
}
