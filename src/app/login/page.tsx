"use client";

// Amany Fogg - login/page.tsx
// This is the file that shows the login page and handles all login form logics (form state, API calls, error handling, redirects). This uses the same structure as the reset-account/page.tsx file, but more complex form states.

import { ChangeEvent, FormEvent, useState } from "react"; // Import React event types and state hook for typed form handling and local UI state

import Link from "next/link"; // Import Next.js Link for client-side route navigation to the reset page

import { useRouter } from "next/navigation"; // Import router hook for redirecting after a successful login

import axios from "axios"; // Import axios to simplify API calls from the client

import { Input } from "@/components/ui/input"; // Import shared input component from the existing UI layer
import { Label } from "@/components/ui/label"; // Import shared label component from the existing UI layer

// Defined the TypeScript shape for all login form fields
type LoginFormState = {
  email: string; // User email input value
  password: string; // User password input value
  remember: boolean; // Whether the user wants to be remembered
};

// Defined the login API response structure
type LoginApiResponse = {
  success: boolean; // This indicates if the login attempt has succeeded
  message: string; // Readable response message, which can be used to display errors
  redirectTo?: string; // Redirects to different route on success
};

// Provide initial values so the form starts in a known state
const initialState: LoginFormState = {
  email: "", // Start with an empty email field
  password: "", // Start with an empty password field
  remember: false, // Default, "remember me" to false
};

// Normalize API payload (string or object) into a safe, typed response.
function parseLoginPayload(payload: unknown): LoginApiResponse {
  // If segment that handles the case where backend returns a JSON string instead of an object
  if (typeof payload === "string") {
    try {
      return JSON.parse(payload) as LoginApiResponse; // Parse string payload into the expected login response type
    } catch {
      return { success: false, message: "Invalid API response format." }; // Returns a safe fallback if parsing fails
    }
  }

  // If segment that handles the common case where backend returns an object payload
  if (payload && typeof payload === "object") {
    const data = payload as Partial<LoginApiResponse>; // Narrow unknown payload to partial response fields
    // Return normalized values with fallbacks for missing fields
    return {
      success: Boolean(data.success), // Coerce success to a strict boolean
      message: data.message ?? "Request completed.", // Use backend message if present, otherwise a default
      redirectTo: data.redirectTo, // Pass through optional redirect target
    };
  }

  return { success: false, message: "Unexpected API response." }; // Final fallback for unexpected payload types
}

// Exports the login page component for the /login route
export default function LoginPage() {
  const router = useRouter(); // Initializes router for redirect after successful auth
  const [formState, setFormState] = useState<LoginFormState>(initialState); // Hold current form values in component state
  const [loading, setLoading] = useState(false); // Track submit loading state to disable the button and show progress text
  const [statusMessage, setStatusMessage] = useState<string | null>(null); // Store status/error message to display below the form

  // Handles all input changes (email, password, and checkbox) with one typed function
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, type, checked, value } = e.target; // Pulls useful properties from the changed input element

    // Updates only the changed field while preserving the rest of form state
    setFormState((prev) => ({
      ...prev, // Spread previous values to avoid losing untouched fields
      [name]: type === "checkbox" ? checked : value, // For checkbox use checked, otherwise use text value
    }));
  };

  // Handles form submission with API call and redirect logic
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); // Prevents default full-page form submit behavior
    setLoading(true); // Marks request as in progress
    setStatusMessage(null); // Clear any previous status message before new attempt

    try {
      const response = await axios.post("/api/auth/login", formState); // Sends login request to auth endpoint with current form state
      const data = parseLoginPayload(response.data); // Normalizes API response payload shape for safe usage
      console.log("login creds: ", data);

      // If segment for if the backend reports failure, shows this message and stops
      if (!data.success) {
        setStatusMessage(data.message);
        return;
      }

      // On success, navigates to provided route or fallback dashboard
      router.push(data.redirectTo ?? "/dashboard");
    } catch (error) {
      // If segment that handles axios specific errors to extract the server message when its available, and if not just an error message
      if (axios.isAxiosError(error)) {
        setStatusMessage(
          // Use server message when present, otherwise fallback text
          (error.response?.data as { message?: string } | undefined)?.message ??
            "Login failed. Please try again.",
        );
      } else {
        // Else segment that handles non axios unexpected runtime errors
        setStatusMessage("Unexpected error. Please try again.");
      }
    } finally {
      // Always clears loading state after request completes/fails
      setLoading(false);
    }
  };

  // Renders the login form UI
  return (
    // Outer card container styled with Tailwind utility classes
    <section className=" mx-auto w-full max-w-md rounded-xl border border-slate-200 bg-gradient-to-br from-slate-100 via-slate-50 to-slate-200 p-8 shadow-sm">
      {/* Page heading for login screen */}
      <h1 className="text-center text-3xl font-semibold text-slate-900">
        Log in
      </h1>

      {/* Form element wired to typed submit handler */}
      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        {/* Email field wrapper for spacing */}
        <div className="space-y-2">
          {/* Accessible label bound to email input id */}
          <Label htmlFor="email">Email</Label>
          {/* Controlled email input tied to formState.email */}
          <Input
            id="email"
            name="email"
            type="email"
            value={formState.email}
            onChange={handleChange}
            required
          />
        </div>

        {/* Password field wrapper for spacing */}
        <div className="space-y-2">
          {/* Accessible label bound to password input id */}
          <Label htmlFor="password">Password</Label>
          {/* Controlled password input tied to formState.password */}
          <Input
            id="password"
            name="password"
            type="password"
            value={formState.password}
            onChange={handleChange}
            required
          />
        </div>

        {/* Remember-me and forgot-password row block */}
        <div className="space-y-3 pt-1">
          {/* Native label wrapping checkbox for better click target */}
          <label
            htmlFor="remember"
            className="flex items-center justify-center gap-2 text-sm text-slate-600"
          >
            {/* Controlled checkbox tied to formState.remember */}
            <Input
              id="remember"
              name="remember"
              type="checkbox"
              checked={formState.remember}
              onChange={handleChange}
              className="h-4 w-4"
            />
            {/* Checkbox text */}
            Remember me
          </label>

          {/* Link to reset-account route */}
          <Link
            href="/reset-password"
            className="block text-center text-sm text-slate-600 underline-offset-4 hover:underline"
          >
            {/* Link text displayed to user */}
            Forgot password?
          </Link>
        </div>

        {/* Submit button triggers handleSubmit via form submit event */}
        <button
          type="submit"
          className="w-full rounded-md bg-slate-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={loading}
        >
          {/* Show loading text while request is in progress */}
          {loading ? "Logging in..." : "Log in"}
        </button>
      </form>

      {/* Conditionally render status message when one exists */}
      {statusMessage ? (
        // Error/status feedback text
        <p className="mt-4 text-center text-sm text-red-700">{statusMessage}</p>
      ) : null}

      {/* Register link */}
      <p className="mt-4 text-center text-sm text-slate-600">
               Don&apos;t have an account?{" "}
         <Link
        href="/register"
    className="font-medium text-slate-700 underline-offset-4 hover:underline"
     >
     Register
  </Link>
</p>


    </section>
  );
}
