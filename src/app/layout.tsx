import type { Metadata } from "next";
import "./globals.css";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/ui/app-sidebar";
import ThemeProvider from "@/components/dashboard/ThemeProvider";
import Navbar from "@/components/navbar/Navbar";
import { DashboardAssignmentFilterProvider } from "@/components/dashboard/DashboardAssignmentFilterContext";
import { initializeDb } from "@/lib/db";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "AI Tutor Analytics",
  description: "AI Tutor Log Analytics Tool",
};

// Initialize the database schema once when the app starts.
// This is safe to call on every cold start — all CREATE TABLE and
// ALTER TABLE statements are idempotent (IF NOT EXISTS / try-catch).
await initializeDb();

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <body className="h-full bg-white text-black transition-colors duration-300 dark:bg-gray-900 dark:text-white">
        <Toaster position="top-right" richColors />
        <ThemeProvider>
          <DashboardAssignmentFilterProvider>
            <SidebarProvider style={{ display: "flex", minHeight: "100vh" }}>
              <AppSidebar />
              <SidebarInset
                style={{
                  flex: 1,
                  minWidth: 0,
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <Navbar />
                <main className="flex-1 bg-white p-6 transition-colors duration-300 dark:bg-gray-900">
                  {children}
                </main>
              </SidebarInset>
            </SidebarProvider>
          </DashboardAssignmentFilterProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
