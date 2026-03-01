// USAGE in any protected route:
//   const auth = await requireAuth(req);
//   if (auth instanceof NextResponse) return auth; // not logged in
//   // auth.instructorId, auth.email, auth.name are now available

import crypto from "crypto";
import db from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export interface AuthPayload {
  instructorId: number;
  email: string;
  name: string;
}

// Ensure the sessions table exists at import time
db.exec(`
  CREATE TABLE IF NOT EXISTS instructor_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    instructor_id INTEGER NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

/**
 * Looks up the session_token cookie in the DB.
 * Returns the instructor payload or null if not found / invalid.
 */
export async function verifyAuth(
  req: NextRequest,
): Promise<AuthPayload | null> {
  const token = req.cookies.get("session_token")?.value;
  if (!token) return null;

  const row = db
    .prepare(
      `SELECT i.id, i.email, i.name
       FROM instructor_sessions s
       JOIN instructors i ON i.id = s.instructor_id
       WHERE s.token = ?`,
    )
    .get(token) as { id: number; email: string; name: string } | undefined;

  if (!row) return null;

  return { instructorId: row.id, email: row.email, name: row.name };
}

/**
 * Returns a 401 response if the request is not authenticated.
 */
export async function requireAuth(
  req: NextRequest,
): Promise<AuthPayload | NextResponse> {
  const payload = await verifyAuth(req);
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return payload;
}

/**
 * Generates a secure random token, stores it in the DB, and returns it.
 * Call this after verifying the instructor's password in the login route.
 */
export function createSessionToken(instructorId: number): string {
  const token = crypto.randomBytes(32).toString("hex");
  db.prepare(
    "INSERT INTO instructor_sessions (instructor_id, token) VALUES (?, ?)",
  ).run(instructorId, token);
  return token;
}

/**
 * Removes a session token from the DB. Called on logout.
 */
export function deleteSessionToken(token: string): void {
  db.prepare("DELETE FROM instructor_sessions WHERE token = ?").run(token);
}
