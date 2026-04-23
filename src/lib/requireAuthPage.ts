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
  const cookieStore = await cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) redirect("/login");

  const result = await db.execute({
    sql: `
      SELECT i.id as instructorId
      FROM instructor_sessions s
      JOIN instructors i ON i.id = s.instructor_id
      WHERE s.token = ?
    `,
    args: [token],
  });

  if (result.rows.length === 0) redirect("/login");

  const instructorId = Number(result.rows[0][0]);

  return { instructorId };
}
