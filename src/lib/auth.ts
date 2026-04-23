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
  darkMode: boolean;
  profilePic: string | null;
}

// libsql returns rows as arrays — map by column index from the SELECT order:
// 0: id, 1: email, 2: name, 3: dark_mode, 4: profile_pic
function rowsAsObjects(result: Awaited<ReturnType<typeof db.execute>>) {
  const cols = result.columns;
  return result.rows.map((row) => {
    const obj: Record<string, unknown> = {};
    cols.forEach((col, i) => {
      obj[col] = row[i];
    });
    return obj;
  });
}

export async function verifyAuth(
  req: NextRequest,
): Promise<AuthPayload | null> {
  const token = req.cookies.get("session_token")?.value;
  if (!token) return null;

  const result = await db.execute({
    sql: `
      SELECT
        i.id,
        i.email,
        i.name,
        COALESCE(i.dark_mode, 0) AS dark_mode,
        i.profile_pic
      FROM instructor_sessions s
      JOIN instructors i ON i.id = s.instructor_id
      WHERE s.token = ?
    `,
    args: [token],
  });

  const rows = rowsAsObjects(result);
  if (rows.length === 0) return null;

  const row = rows[0] as {
    id: number;
    email: string;
    name: string;
    dark_mode: number;
    profile_pic: string | null;
  };

  return {
    instructorId: Number(row.id),
    email: row.email,
    name: row.name,
    darkMode: Boolean(row.dark_mode),
    profilePic: row.profile_pic ?? null,
  };
}

export async function requireAuth(
  req: NextRequest,
): Promise<AuthPayload | NextResponse> {
  const payload = await verifyAuth(req);
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return payload;
}

export async function createSessionToken(
  instructorId: number,
): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");

  await db.execute({
    sql: `INSERT INTO instructor_sessions (instructor_id, token) VALUES (?, ?)`,
    args: [instructorId, token],
  });

  return token;
}

export async function deleteSessionToken(token: string): Promise<void> {
  await db.execute({
    sql: "DELETE FROM instructor_sessions WHERE token = ?",
    args: [token],
  });
}
