"use client";

// Amany Fogg - reset-account/page.tsx
// This is the reset-account page file that shows the reset account page and handles all reset form logics (form state, API calls, error handling). This uses a similar structure as the login/page.tsx file, but simpler form states

import { ChangeEvent, FormEvent, useState } from "react"; // Imports React event types and state hook for typed form handling and local UI state
import Link from "next/link"; // Imports Next.js Link for client-side route navigation back to login
import axios from "axios"; // Imports axios to simplify API calls from the client
import { Input } from "@/components/ui/input"; // Imports shared input component from the existing UI layer
import { Label } from "@/components/ui/label"; // Imports shared label component from the existing UI layer

// Defines the TypeScript shape for reset form fields
type ResetFormState = {
  
  email: string; // This is the user email input value
};

// Defines the expected reset API response structure
type ResetApiResponse = {
  
  success: boolean; // Indicates if reset request succeeded
  message: string; // Response message
};

// This provides the initial values so the form starts in a known state
const initialState: ResetFormState = {

  email: "", // Starts with an empty email field
};

// This normalizes API payload (string or object) into a safe, typed response
function parseResetPayload(payload: unknown): ResetApiResponse {
  // If segment that handles the case where the backend returns string based JSON
  if (typeof payload === "string") {
    try {
      
      return JSON.parse(payload) as ResetApiResponse; // Parse string payload into the expected reset response type
    } catch {
      
      return { success: false, message: "Invalid API response format." }; // This returns a safe fallback if parsing fails
    }
  }

  // If segment that handles the case where backend returns an object payload
  if (payload && typeof payload === "object") {
    
    const data = payload as Partial<ResetApiResponse>; // Narrow unknown payload to partial response fields
    // Return normalized values with fallbacks for missing fields
    return {
      
      success: Boolean(data.success), // Coerce success to a strict boolean
      
      message: data.message ?? "Request completed.", // Uses a backend message if present, otherwise a default msg "Request Completed"
    };
  }

  return { success: false, message: "Unexpected API response." }; // Final fallback for unexpected payload types
}

// Exports the reset page component for the /reset-account route
export default function ResetAccountPage() {
  
  const [formState, setFormState] = useState<ResetFormState>(initialState); // Holds current form values in component state
  const [loading, setLoading] = useState(false); // Tracks submit loading state to disable button and show progress text
  const [statusMessage, setStatusMessage] = useState<string | null>(null); // Stores status/error message to display below the form

  // Handles email input change with typed event
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {

    setFormState({ email: e.target.value }); // Replaces the form state with the current email field value
  };

  // Handles the form submission with API call
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    
    e.preventDefault(); // Prevents default full-page form submit behavior
    setLoading(true); // Mark request as in progress
    setStatusMessage(null); // Clear any previous status message before new attempt

    try {
      
      const response = await axios.post("/api/auth/reset", formState); // Sends the reset request to auth endpoint with current form state
      const data = parseResetPayload(response.data); // Normalizes the API response payload shape for safe usage
      setStatusMessage(data.message); // This shows the backend response message to user
    } catch (error) {
      // If segment that handles the axios specific errors to extract server message if available
      if (axios.isAxiosError(error)) {
        setStatusMessage(
          // Uses the server message when present, otherwise its the hard coded message provided below
          (error.response?.data as { message?: string } | undefined)?.message ??
            "Failed to send reset link."
        );
      } else {
        // Else segment that handles non axios unexpected runtime errors 
        setStatusMessage("Unexpected error. Please try again.");
      }
    } finally {
      // Always clear loading state after request completes/fails
      setLoading(false);
    }
  };

  // Render reset form UI
  return (
    // Outer card container styled with Tailwind utility classes
    <section className="mx-auto w-full max-w-md rounded-xl border border-slate-200 bg-gradient-to-br from-slate-100 via-slate-50 to-slate-200 p-8 shadow-sm">
      {/* Page heading for reset screen */}
      <h1 className="text-center text-3xl font-semibold text-slate-900">Reset account</h1>
      {/* Instructional text under heading */}
      <p className="mt-2 text-center text-sm text-slate-600">
        Enter your email to receive a reset link for your account.
      </p>

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

        {/* Submit button triggers handleSubmit via form submit event */}
        <button
          type="submit"
          className="w-full rounded-md bg-slate-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={loading}
        >
          {/* Show loading text while request is in progress */}
          {loading ? "Sending..." : "Send reset link"}
        </button>
      </form>

      {/* Conditionally render status message when one exists */}
      {statusMessage ? (
        // Error/status feedback text
        <p className="mt-4 text-center text-sm text-slate-700">{statusMessage}</p>
      ) : null}

      {/* Navigation text and link back to login page */}
      <p className="mt-4 text-center text-sm text-slate-600">
        Remembered your password?{" "}
        {/* Link back to login route */}
        <Link href="/login" className="underline underline-offset-4 hover:no-underline">
          Back to login
        </Link>
      </p>
    </section>
  );
}
