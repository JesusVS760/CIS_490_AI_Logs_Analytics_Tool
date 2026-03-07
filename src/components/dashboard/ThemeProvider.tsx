"use client";

import { useEffect } from "react";

export default function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");

    if (savedTheme === "darks") {
      document.documentElement.classList.add("dark");
    }
  }, []);

  return <>{children}</>;
}
