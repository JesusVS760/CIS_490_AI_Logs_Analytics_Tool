import db from "@/lib/db";
import { ensureInstructorsTable } from "@/lib/instructors";
import { createSessionToken } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";

ensureInstructorsTable();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = body.email as string | null;
    const password = body.password as string | null;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 },
      );
    }

    const instructor = db
      .prepare(
        `
        SELECT id, email, password_hash, name, auth_provider, has_local_password
        FROM instructors
        WHERE email = ?
        `,
      )
      .get(email.toLowerCase().trim()) as
      | {
          id: number;
          email: string;
          password_hash: string;
          name: string;
          auth_provider: string;
          has_local_password: number;
        }
      | undefined;

    if (!instructor) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 },
      );
    }

    if (!instructor.has_local_password) {
      return NextResponse.json(
        {
          error:
            "This account does not have an email/password login yet. Use Continue with GitHub or register a password first.",
        },
        { status: 401 },
      );
    }

    const passwordValid = await bcrypt.compare(
      password,
      instructor.password_hash,
    );

    if (!passwordValid) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 },
      );
    }

    const token = createSessionToken(instructor.id);

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
      secure: false,
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
