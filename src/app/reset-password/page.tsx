"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import axios from "axios";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toaster } from "@/components/ui/sonner";

export default function ResetPasswordPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [step, setStep] = useState<"request" | "reset">("request");
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleRequestCode = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setStatusMessage(null);

    try {
      const normalizedEmail = email.trim().toLowerCase();

      if (!normalizedEmail) {
        const message = "Email is required.";
        setStatusMessage(message);
        toast.error(message);
        return;
      }

      const payload = new FormData();
      payload.append("action", "request");
      payload.append("email", normalizedEmail);

      const { data } = await axios.post("/api/auth/reset", payload);
      const message = data?.message ?? "Reset code sent.";
      setStatusMessage(message);
      toast.success(message);
      setStep("reset");
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const message =
          (error.response?.data as { message?: string; error?: string } | undefined)
            ?.message ??
          (error.response?.data as { message?: string; error?: string } | undefined)
            ?.error ??
          "Failed to send reset code.";
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

  const handleResetPassword = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setStatusMessage(null);

    try {
      const normalizedEmail = email.trim().toLowerCase();

      if (!normalizedEmail || !code.trim() || !newPassword.trim()) {
        const message = "Email, reset code, and new password are required.";
        setStatusMessage(message);
        toast.error(message);
        return;
      }

      if (newPassword.trim().length < 6) {
        const message = "Password must be at least 6 characters.";
        setStatusMessage(message);
        toast.error(message);
        return;
      }

      if (newPassword !== confirmPassword) {
        const message = "Passwords do not match.";
        setStatusMessage(message);
        toast.error(message);
        return;
      }

      const payload = new FormData();
      payload.append("action", "reset");
      payload.append("email", normalizedEmail);
      payload.append("code", code.trim());
      payload.append("newPassword", newPassword);

      const { data } = await axios.post("/api/auth/reset", payload);
      const message = data?.message ?? "Password reset successfully.";
      setStatusMessage(message);
      toast.success(message);

      setTimeout(() => {
        router.push(data?.redirectTo ?? "/login");
      }, 1200);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const message =
          (error.response?.data as { message?: string; error?: string } | undefined)
            ?.message ??
          (error.response?.data as { message?: string; error?: string } | undefined)
            ?.error ??
          "Failed to reset password.";
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

  return (
    <section className="mx-auto w-full max-w-md rounded-xl border border-slate-200 bg-gradient-to-br from-slate-100 via-slate-50 to-slate-200 p-8 shadow-sm">
      <Toaster />

      <h1 className="text-center text-3xl font-semibold text-slate-900">
        Reset account
      </h1>

      <p className="mt-2 text-center text-sm text-slate-600">
        {step === "request"
          ? "Enter your email to receive a 6-digit reset code."
          : "Enter the reset code from your email and choose a new password."}
      </p>

      {step === "request" ? (
        <form className="mt-6 space-y-4" onSubmit={handleRequestCode}>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-md bg-slate-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={loading}
          >
            {loading ? "Sending..." : "Send reset code"}
          </button>
        </form>
      ) : (
        <form className="mt-6 space-y-4" onSubmit={handleResetPassword}>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="code">Reset Code</Label>
            <Input
              id="code"
              name="code"
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="newPassword">New Password</Label>
            <Input
              id="newPassword"
              name="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm New Password</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-md bg-slate-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={loading}
          >
            {loading ? "Resetting..." : "Reset Password"}
          </button>

          <button
            type="button"
            onClick={() => setStep("request")}
            className="w-full rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            disabled={loading}
          >
            Back
          </button>
        </form>
      )}

      {statusMessage ? (
        <p className="mt-4 text-center text-sm text-slate-700">
          {statusMessage}
        </p>
      ) : null}

      <p className="mt-4 text-center text-sm text-slate-600">
        Remembered your password?{" "}
        <Link
          href="/login"
          className="underline underline-offset-4 hover:no-underline"
        >
          Back to login
        </Link>
      </p>
    </section>
  );
}
