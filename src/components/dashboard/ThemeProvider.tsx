"use client";

import { useEffect } from "react";

export default function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    const applyTheme = (isDark: boolean) => {
      document.documentElement.classList.toggle("dark", isDark);
      localStorage.setItem("dashboardTheme", isDark ? "dark" : "light");
    };

    const savedTheme = localStorage.getItem("dashboardTheme");
    applyTheme(savedTheme === "dark");

    const handleThemeUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<{ darkMode?: boolean }>;
      applyTheme(Boolean(customEvent.detail?.darkMode));
    };

    window.addEventListener("theme-updated", handleThemeUpdated);

    return () => {
      window.removeEventListener("theme-updated", handleThemeUpdated);
    };
  }, []);

  return <>{children}</>;
}