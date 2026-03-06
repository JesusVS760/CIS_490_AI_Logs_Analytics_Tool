import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { createSessionToken } from "@/lib/auth";
import bcrypt from "bcryptjs";

// Ensure table exists
db.exec(`
  CREATE TABLE IF NOT EXISTS instructors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

type GitHubUser = {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
};

type GitHubEmail = {
  email: string;
  primary: boolean;
  verified: boolean;
};

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  const redirectUri = process.env.GITHUB_REDIRECT_URI;

  if (!code || !clientId || !clientSecret || !redirectUri) {
    return NextResponse.redirect(new URL("/login?oauth=failed", req.url));
  }

  try {
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = (await tokenRes.json()) as { access_token?: string };
    const accessToken = tokenData.access_token;
    if (!tokenRes.ok || !accessToken) {
      return NextResponse.redirect(new URL("/login?oauth=failed", req.url));
    }

    const userRes = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
      },
    });

    if (!userRes.ok) {
      return NextResponse.redirect(new URL("/login?oauth=failed", req.url));
    }

    const ghUser = (await userRes.json()) as GitHubUser;

    const emailsRes = await fetch("https://api.github.com/user/emails", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
      },
    });

    if (!emailsRes.ok) {
      return NextResponse.redirect(new URL("/login?oauth=failed", req.url));
    }

    const ghEmails = (await emailsRes.json()) as GitHubEmail[];

    const primaryEmail =
      ghEmails.find((e) => e.primary && e.verified)?.email ??
      ghEmails.find((e) => e.verified)?.email ??
      ghUser.email ??
      `${ghUser.login}@users.noreply.github.com`;

    const normalizedEmail = primaryEmail.toLowerCase().trim();
    const displayName = ghUser.name?.trim() || ghUser.login;

    let instructor = db
      .prepare("SELECT id FROM instructors WHERE email = ?")
      .get(normalizedEmail) as { id: number } | undefined;

    if (!instructor) {
      const placeholderHash = await bcrypt.hash(`oauth:${ghUser.id}:${Date.now()}`, 10);
      const result = db
        .prepare("INSERT INTO instructors (name, email, password_hash) VALUES (?, ?, ?)")
        .run(displayName, normalizedEmail, placeholderHash);
      instructor = { id: Number(result.lastInsertRowid) };
    }

    const token = createSessionToken(instructor.id);

    const res = NextResponse.redirect(new URL("/dashboard", req.url));
    res.cookies.set("session_token", token, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });

    return res;
  } catch {
    return NextResponse.redirect(new URL("/login?oauth=failed", req.url));
  }
}
