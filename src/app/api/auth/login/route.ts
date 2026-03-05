import db from "@/lib/db";
import { createSessionToken } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";

// Ensure instructors table exists
db.exec(`
  CREATE TABLE IF NOT EXISTS instructors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const email = formData.get("email") as string | null;
    const password = formData.get("password") as string | null;
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const instructor = db
      .prepare("SELECT * FROM instructors WHERE email = ?")
      .get(email.toLowerCase().trim()) as
      | { id: number; email: string; password_hash: string; name: string }
      | undefined;

    if (!instructor) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    const passwordValid = await bcrypt.compare(
      password,
      instructor.password_hash
    );

    if (!passwordValid) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Create a session token stored in SQLite — no JWT secret needed
    const token = createSessionToken(instructor.id);

    const response = NextResponse.json({
      success: true,
      user: {
        id: instructor.id,
        email: instructor.email,
        name: instructor.name,
      },
    });

    // Local app: secure:false so the cookie works over http://localhost
    response.cookies.set("session_token", token, {
      httpOnly: true,
      secure: false, // localhost is never HTTPS
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days — local app, no need to force re-login often
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
