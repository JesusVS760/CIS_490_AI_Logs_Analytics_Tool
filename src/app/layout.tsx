import type { Metadata } from "next";
import "./globals.css";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/ui/app-sidebar";
import ThemeProvider from "@/components/dashboard/ThemeProvider";
import Navbar from "@/components/navbar/Navbar";

export const metadata: Metadata = {
  title: "AI Tutor Analytics",
  description: "AI Tutor Log Analytics Tool",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const themeScript = `
    (function () {
      try {
        var savedTheme = localStorage.getItem("dashboardTheme");
        if (savedTheme === "dark") {
          document.documentElement.classList.add("dark");
        } else {
          document.documentElement.classList.remove("dark");
        }
      } catch (e) {}
    })();
  `;

  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="h-full bg-white text-black transition-colors duration-300 dark:bg-gray-900 dark:text-white">
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
              <main className="flex-1 bg-white p-6 transition-colors duration-300 dark:bg-gray-900">
                {children}
              </main>
            </SidebarInset>
          </SidebarProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}