import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import db from "@/lib/db";

/**
 * Server-component auth guard.
 * Verifies the session_token cookie against the DB and returns the
 * instructor_id so callers can scope their queries.
 * Redirects to /login if the token is missing or invalid.
 */
export async function requireAuthPage(): Promise<{ instructorId: number }> {
  // Read the session cookie. cookies() is async in Next.js 15 App Router.
  const cookieStore = await cookies();
  const token = cookieStore.get("session_token")?.value;

  // No cookie at all → not logged in.
  if (!token) redirect("/login");

  // Look up the session and pull the instructor_id in the same query
  // so callers don't have to do a second round-trip to scope their data.
  const session = db
    .prepare(
      `
      SELECT i.id as instructorId
      FROM instructor_sessions s
      JOIN instructors i ON i.id = s.instructor_id
      WHERE s.token = ?
      `
    )
    .get(token) as { instructorId: number } | undefined;

  // Token exists but doesn't match a real session (expired, revoked, tampered).
  if (!session) redirect("/login");

  // Hand the instructor_id back to the caller for query scoping.
  return { instructorId: session.instructorId };
}