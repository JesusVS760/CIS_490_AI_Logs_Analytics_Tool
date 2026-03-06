"use client";

// Amany Fogg - login/page.tsx
// This is the file that shows the login page and handles all login form logics (form state, API calls, error handling, redirects). This uses the same structure as the reset-account/page.tsx file, but more complex form states.

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import axios from "axios";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toaster } from "@/components/ui/sonner";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    const oauth = searchParams.get("oauth");

    if (oauth === "failed") {
      setStatusMessage("GitHub login failed. Please try again.");
    }
  }, [searchParams]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setStatusMessage(null);

    try {
      const formData = new FormData(e.currentTarget);
      const email = String(formData.get("email") ?? "").trim().toLowerCase();
      const password = String(formData.get("password") ?? "");
      const remember = formData.get("remember") === "on";

      if (!email || !password) {
        const message = "Email and password are required.";
        setStatusMessage(message);
        toast.error(message);
        return;
      }

      const payload = new FormData();
      payload.append("email", email);
      payload.append("password", password);
      payload.append("remember", remember ? "true" : "false");

      const { data } = await axios.post("/api/auth/login", payload);

      if (!data?.success) {
        const message = data?.error ?? data?.message ?? "Login failed. Please try again.";
        setStatusMessage(message);
        toast.error(message);
        return;
      }

      toast.success("Logged in successfully.");
      router.push("/dashboard");
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const message =
          (error.response?.data as { message?: string; error?: string } | undefined)?.error ??
          (error.response?.data as { message?: string; error?: string } | undefined)?.message ??
          "Login failed. Please try again.";
        setStatusMessage(message);
        toast.error(message);
      } else {
        const message = "Unexpected error. Please try again.";
        setStatusMessage(message);
        toast.error(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGitHubLogin = () => {
    setOauthLoading(true);
    setStatusMessage(null);
    window.location.href = "/api/auth/github";
  };

  return (
    <section className="mx-auto w-full max-w-md rounded-xl border border-slate-200 bg-gradient-to-br from-slate-100 via-slate-50 to-slate-200 p-8 shadow-sm">
      <Toaster />
      <h1 className="text-center text-3xl font-semibold text-slate-900">Log in</h1>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" required />
        </div>

        <div className="space-y-3 pt-1">
          <label
            htmlFor="remember"
            className="flex items-center justify-center gap-2 text-sm text-slate-600"
          >
            <Input id="remember" name="remember" type="checkbox" className="h-4 w-4" />
            Remember me
          </label>

          <Link
            href="/reset-password"
            className="block text-center text-sm text-slate-600 underline-offset-4 hover:underline"
          >
            Forgot password?
          </Link>
        </div>

        <button
          type="submit"
          className="w-full rounded-md bg-slate-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={loading || oauthLoading}
        >
          {loading ? "Logging in..." : "Log in"}
        </button>

        <button
          type="button"
          onClick={handleGitHubLogin}
          className="w-full rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={loading || oauthLoading}
        >
          {oauthLoading ? "Connecting..." : "Continue with GitHub"}
        </button>
      </form>

      {statusMessage ? (
        <p className="mt-4 text-center text-sm text-red-700">{statusMessage}</p>
      ) : null}
    </section>
  );
}
