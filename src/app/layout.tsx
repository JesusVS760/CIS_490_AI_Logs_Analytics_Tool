import type { Metadata } from "next";
import "./globals.css";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/ui/app-sidebar";
import Navbar from "@/components/dashboard/Navbar";
import ThemeProvider from "@/components/dashboard/ThemeProvider";

export const metadata: Metadata = {
  title: "AI Tutor Analytics",
  description: "AI Tutor Log Analytics Tool",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full bg-white text-black dark:bg-gray-900 dark:text-white transition-colors duration-300">
        <ThemeProvider>
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
              <main className="flex-1 p-6 bg-white dark:bg-gray-900 transition-colors duration-300">
                {children}
              </main>
            </SidebarInset>
          </SidebarProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
