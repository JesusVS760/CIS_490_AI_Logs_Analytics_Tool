"use client";

// The register page/page.tsx

import { ChangeEvent, FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import axios from "axios";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Defined the TypeScript shape for all register form fields
type RegisterFormState = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
};

// Match your backend responses:
// - success: true => { success: true, user: {...} }
// - error cases => { error: "..." }
type RegisterSuccessResponse = {
  success: true;
  user: { id: number; email: string; name: string };
};

type RegisterErrorResponse = {
  error: string;
};

const initialState: RegisterFormState = {
  name: "",
  email: "",
  password: "",
  confirmPassword: "",
};

function isEmailValid(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export default function RegisterPage() {
  const router = useRouter();
  const [formState, setFormState] = useState<RegisterFormState>(initialState);

  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  // GitHub OAuth (custom route)
  const handleGitHubOAuth = () => {
    setStatusMessage(null);
    setOauthLoading(true);
    window.location.href = "/api/auth/github";
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setStatusMessage(null);

    const trimmedName = formState.name.trim();
    const trimmedEmail = formState.email.trim().toLowerCase();
    const password = formState.password;
    const confirmPassword = formState.confirmPassword;

    // Frontend validation
    if (!trimmedName) {
      setStatusMessage("Name is required.");
      setLoading(false);
      return;
    }

    if (!trimmedEmail) {
      setStatusMessage("Email is required.");
      setLoading(false);
      return;
    }

    if (!isEmailValid(trimmedEmail)) {
      setStatusMessage("Please enter a valid email.");
      setLoading(false);
      return;
    }

    if (!password) {
      setStatusMessage("Password is required.");
      setLoading(false);
      return;
    }

    if (password.length < 8) {
      setStatusMessage("Password must be at least 8 characters.");
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setStatusMessage("Passwords do not match.");
      setLoading(false);
      return;
    }

    try {
      const formData = new FormData();
      formData.append("name", trimmedName);
      formData.append("email", trimmedEmail);
      formData.append("password", password);

      // ✅ Axios to backend route
      const response = await axios.post<
        RegisterSuccessResponse | RegisterErrorResponse
      >("/api/auth/register", formData);

      // If backend returns { error: ... } even with 200 (unlikely), handle it
      if ("error" in response.data) {
        setStatusMessage(response.data.error);
        return;
      }

      // success === true
      try {
        localStorage.setItem("pendingVerifyEmail", trimmedEmail);
      } catch {
        // ignore storage errors
      }

      // Backend, so choose one:
      router.push("/login");
    } catch (error) {
      if (axios.isAxiosError(error)) {
        // Backend sends { error: "..." } on failures
        const data = error.response?.data as Partial<RegisterErrorResponse> | undefined;
        setStatusMessage(data?.error ?? "Registration failed. Please try again.");
      } else {
        setStatusMessage("Unexpected error. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const disableAll = loading || oauthLoading;

  return (
    <section className="mx-auto w-full max-w-md rounded-xl border border-slate-200 bg-gradient-to-br from-slate-100 via-slate-50 to-slate-200 p-8 shadow-sm">
      <h1 className="text-center text-3xl font-semibold text-slate-900">
        Sign up
      </h1>

      {/* GitHub OAuth */}
      <div className="mt-6 space-y-3">
        <button
          type="button"
          onClick={handleGitHubOAuth}
          disabled={disableAll}
          className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
        >
          {oauthLoading ? "Connecting to GitHub..." : "Continue with GitHub"}
        </button>

        <div className="flex items-center gap-3 py-2">
          <div className="h-px flex-1 bg-slate-300" />
          <span className="text-xs font-medium text-slate-600">OR</span>
          <div className="h-px flex-1 bg-slate-300" />
        </div>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            name="name"
            type="text"
            value={formState.name}
            onChange={handleChange}
            required
            disabled={disableAll}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            value={formState.email}
            onChange={handleChange}
            required
            disabled={disableAll}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            value={formState.password}
            onChange={handleChange}
            required
            disabled={disableAll}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Re-type password</Label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            value={formState.confirmPassword}
            onChange={handleChange}
            required
            disabled={disableAll}
          />
        </div>

        <button
          type="submit"
          className="w-full rounded-md bg-slate-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={disableAll}
        >
          {loading ? "Signing up..." : "Sign up"}
        </button>
      </form>

      <Link
        href="/login"
        className="mt-4 block text-center text-sm text-slate-600 underline-offset-4 hover:underline"
      >
        Already have an account? Log in
      </Link>

      {statusMessage ? (
        <p className="mt-4 text-center text-sm text-red-700">{statusMessage}</p>
      ) : null}
    </section>
  );
}