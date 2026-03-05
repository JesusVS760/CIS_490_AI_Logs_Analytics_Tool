"use client";

// Amany Fogg - login/page.tsx
// This is the file that shows the login page and handles all login form logics (form state, API calls, error handling, redirects). This uses the same structure as the reset-account/page.tsx file, but more complex form states.

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import axios from "axios";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setStatusMessage(null);

    try {
      const formData = new FormData(e.currentTarget);
      const payload = {
        email: String(formData.get("email") ?? ""),
        password: String(formData.get("password") ?? ""),
        remember: formData.get("remember") === "on",
      };

      const { data } = await axios.post("/api/auth/login", payload);
      if (!data?.success) {
        setStatusMessage(data?.message ?? "Login failed. Please try again.");
        return;
      }

      router.push("/dashboard");
    } catch (error) {
      if (axios.isAxiosError(error)) {
        setStatusMessage(
          (error.response?.data as { message?: string } | undefined)?.message ??
            "Login failed. Please try again."
        );
      } else {
        setStatusMessage("Unexpected error. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mx-auto w-full max-w-md rounded-xl border border-slate-200 bg-gradient-to-br from-slate-100 via-slate-50 to-slate-200 p-8 shadow-sm">
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
            href="/reset-account"
            className="block text-center text-sm text-slate-600 underline-offset-4 hover:underline"
          >
            Forgot password?
          </Link>
        </div>

        <button
          type="submit"
          className="w-full rounded-md bg-slate-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={loading}
        >
          {loading ? "Logging in..." : "Log in"}
        </button>
      </form>

      {statusMessage ? (
        <p className="mt-4 text-center text-sm text-red-700">{statusMessage}</p>
      ) : null}
    </section>
  );
}
