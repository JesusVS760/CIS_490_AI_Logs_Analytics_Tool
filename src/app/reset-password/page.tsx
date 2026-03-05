"use client";

// Amany Fogg - reset-account/page.tsx
// This is the reset-account page file that shows the reset account page and handles all reset form logics (form state, API calls, error handling). This uses a similar structure as the login/page.tsx file, but simpler form states

import { FormEvent, useState } from "react";
import Link from "next/link";
import axios from "axios";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ResetAccountPage() {
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
      };

      const { data } = await axios.post("/api/auth/reset", payload);
      setStatusMessage(data?.message ?? "Request completed.");
    } catch (error) {
      if (axios.isAxiosError(error)) {
        setStatusMessage(
          (error.response?.data as { message?: string } | undefined)?.message ??
            "Failed to send reset link."
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
      <h1 className="text-center text-3xl font-semibold text-slate-900">Reset account</h1>
      <p className="mt-2 text-center text-sm text-slate-600">
        Enter your email to receive a reset link for your account.
      </p>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required />
        </div>

        <button
          type="submit"
          className="w-full rounded-md bg-slate-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={loading}
        >
          {loading ? "Sending..." : "Send reset link"}
        </button>
      </form>

      {statusMessage ? (
        <p className="mt-4 text-center text-sm text-slate-700">{statusMessage}</p>
      ) : null}

      <p className="mt-4 text-center text-sm text-slate-600">
        Remembered your password?{" "}
        <Link href="/login" className="underline underline-offset-4 hover:no-underline">
          Back to login
        </Link>
      </p>
    </section>
  );
}
