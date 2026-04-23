import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { createSessionToken } from "@/lib/auth";

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

type InstructorRow = {
  id: number;
  email: string;
  auth_provider: string;
  github_id: string | null;
  has_local_password: number;
};

function toInstructor(cols: string[], row: unknown): InstructorRow {
  const r = row as Record<number, unknown>;
  return Object.fromEntries(cols.map((c, i) => [c, r[i]])) as InstructorRow;
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  const redirectUri = process.env.GITHUB_REDIRECT_URI;

  if (!code || !clientId || !clientSecret || !redirectUri) {
    return NextResponse.redirect(new URL("/login?oauth=failed", req.url));
  }

  try {
    const tokenRes = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: redirectUri,
        }),
      },
    );

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
    const githubId = String(ghUser.id);

    // Try to find existing instructor by GitHub ID first
    const byGithubId = await db.execute({
      sql: `SELECT id, email, auth_provider, github_id, has_local_password
            FROM instructors WHERE github_id = ?`,
      args: [githubId],
    });

    let instructor: InstructorRow | undefined = byGithubId.rows[0]
      ? toInstructor(byGithubId.columns, byGithubId.rows[0])
      : undefined;

    // Fall back to lookup by email
    if (!instructor) {
      const byEmail = await db.execute({
        sql: `SELECT id, email, auth_provider, github_id, has_local_password
              FROM instructors WHERE email = ?`,
        args: [normalizedEmail],
      });

      instructor = byEmail.rows[0]
        ? toInstructor(byEmail.columns, byEmail.rows[0])
        : undefined;
    }

    if (!instructor) {
      // New instructor — create account
      const result = await db.execute({
        sql: `INSERT INTO instructors (name, email, password_hash, auth_provider, github_id, has_local_password)
              VALUES (?, ?, ?, 'github', ?, 0)`,
        args: [displayName, normalizedEmail, "", githubId],
      });

      instructor = {
        id: Number(result.lastInsertRowid),
        email: normalizedEmail,
        auth_provider: "github",
        github_id: githubId,
        has_local_password: 0,
      };
    } else {
      // Existing instructor — update GitHub linkage
      const nextProvider =
        instructor.has_local_password || instructor.auth_provider === "local"
          ? "both"
          : "github";

      await db.execute({
        sql: `UPDATE instructors SET name = ?, github_id = ?, auth_provider = ? WHERE id = ?`,
        args: [displayName, githubId, nextProvider, instructor.id],
      });
    }

    const token = await createSessionToken(instructor.id);

    const res = NextResponse.redirect(new URL("/dashboard", req.url));
    res.cookies.set("session_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });

    return res;
  } catch (error) {
    console.error("GitHub callback error:", error);
    return NextResponse.redirect(new URL("/login?oauth=failed", req.url));
  }
}
