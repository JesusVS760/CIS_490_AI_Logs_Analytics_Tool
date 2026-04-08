import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import db from "@/lib/db";

export async function requireAuthPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) redirect("/login");

  const session = db
    .prepare(
      `
      SELECT 1 FROM instructor_sessions s
      JOIN instructors i ON i.id = s.instructor_id
      WHERE s.token = ?
      `
    )
    .get(token);

  if (!session) redirect("/login");
}