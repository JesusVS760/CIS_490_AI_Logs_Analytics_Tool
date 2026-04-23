import db from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendVerificationEmail(email: string, code: string) {
  await transporter.sendMail({
    from: process.env.GMAIL_USER,
    to: email,
    subject: "Verify your email",
    text: `Your verification code is ${code}. It expires in 10 minutes.`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5;">
        <h2>Verify your email</h2>
        <p>Your verification code is:</p>
        <div style="font-size: 32px; font-weight: bold; letter-spacing: 6px; margin: 16px 0;">
          ${code}
        </div>
        <p>This code expires in 10 minutes.</p>
      </div>
    `,
  });
}

async function createAndSendVerificationCode(email: string) {
  const code = generateVerificationCode();
  const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  await db.execute({
    sql: `UPDATE instructors
          SET verification_code = ?, verification_expires = ?, is_verified = 0
          WHERE email = ?`,
    args: [code, expires, email],
  });

  await sendVerificationEmail(email, code);
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const email = String(formData.get("email") || "")
      .trim()
      .toLowerCase();
    const password = String(formData.get("password") || "");
    const name = String(formData.get("name") || "").trim();

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: "Name, email, and password are required" },
        { status: 400 },
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 },
      );
    }

    const existingResult = await db.execute({
      sql: `SELECT id, auth_provider, github_id, has_local_password
            FROM instructors WHERE email = ?`,
      args: [email],
    });

    const cols = existingResult.columns;
    const existingRow = existingResult.rows[0];
    const existing = existingRow
      ? (Object.fromEntries(cols.map((c, i) => [c, existingRow[i]])) as {
          id: number;
          auth_provider: string;
          github_id: string | null;
          has_local_password: number;
        })
      : undefined;

    const passwordHash = await bcrypt.hash(password, 12);

    if (!existing) {
      const insertResult = await db.execute({
        sql: `INSERT INTO instructors (name, email, password_hash, auth_provider, has_local_password, is_verified)
              VALUES (?, ?, ?, 'local', 1, 0)`,
        args: [name, email, passwordHash],
      });

      try {
        await createAndSendVerificationCode(email);
      } catch (mailError) {
        console.error("Initial verification email failed:", mailError);
        return NextResponse.json(
          {
            error:
              "Account created, but verification email could not be sent. Please use Resend Code.",
          },
          { status: 500 },
        );
      }

      return NextResponse.json(
        {
          success: true,
          user: { id: Number(insertResult.lastInsertRowid), email, name },
          message: "Account created. Verification code sent.",
        },
        { status: 201 },
      );
    }

    if (existing.has_local_password) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 },
      );
    }

    const nextProvider =
      existing.auth_provider === "github" ? "both" : existing.auth_provider;

    await db.execute({
      sql: `UPDATE instructors
            SET name = ?, password_hash = ?, has_local_password = 1,
                auth_provider = ?, is_verified = 0
            WHERE id = ?`,
      args: [name, passwordHash, nextProvider, existing.id],
    });

    try {
      await createAndSendVerificationCode(email);
    } catch (mailError) {
      console.error("Initial verification email failed:", mailError);
      return NextResponse.json(
        {
          error:
            "Account updated, but verification email could not be sent. Please use Resend Code.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        user: { id: existing.id, email, name },
        message: "Account created. Verification code sent.",
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
