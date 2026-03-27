"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { Loader2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function LogoutPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const hasLoggedOut = useRef(false);

  const handleLogout = async () => {
    if (hasLoggedOut.current) return;
    hasLoggedOut.current = true;

    try {
      setLoading(true);

      await axios.post("/api/logout", {}, { withCredentials: true });

      localStorage.removeItem("dashboardUser");

      toast.success("Logged out successfully");
      router.replace("/login");
    } catch (error) {
      console.error("Logout failed:", error);
      toast.error("Failed to log out");
      setLoading(false);
      hasLoggedOut.current = false;
    }
  };

  useEffect(() => {
    handleLogout();
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-sm">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border bg-muted">
            {loading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <LogOut className="h-6 w-6" />
            )}
          </div>

          <h1 className="text-2xl font-semibold tracking-tight">
            {loading ? "Logging you out..." : "Logout failed"}
          </h1>

          <p className="mt-2 text-sm text-muted-foreground">
            {loading
              ? "Please wait while your session is being cleared."
              : "Something went wrong while logging you out."}
          </p>

          {!loading && (
            <div className="mt-6 flex w-full flex-col gap-3">
              <Button onClick={handleLogout} className="w-full">
                Try Again
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push("/login")}
                className="w-full"
              >
                Go to Login
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

//needed change to comment on github