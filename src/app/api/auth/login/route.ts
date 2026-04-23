import db from "@/lib/db";
import { createSessionToken } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";
    let email: string | null = null;
    let password: string | null = null;

    if (contentType.includes("application/json")) {
      const body = await req.json();
      email = body?.email ?? null;
      password = body?.password ?? null;
    } else {
      const formData = await req.formData();
      email = formData.get("email") as string | null;
      password = formData.get("password") as string | null;
    }

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 },
      );
    }

    const result = await db.execute({
      sql: "SELECT * FROM instructors WHERE email = ?",
      args: [email.toLowerCase().trim()],
    });

    const cols = result.columns;
    const row = result.rows[0];
    if (!row) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 },
      );
    }

    const instructor = Object.fromEntries(
      cols.map((col, i) => [col, row[i]]),
    ) as { id: number; email: string; password_hash: string; name: string };

    const passwordValid = await bcrypt.compare(
      password,
      instructor.password_hash as string,
    );
    if (!passwordValid) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 },
      );
    }

    const token = await createSessionToken(instructor.id);

    const response = NextResponse.json({
      success: true,
      user: {
        id: instructor.id,
        email: instructor.email,
        name: instructor.name,
      },
    });

    response.cookies.set("session_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
