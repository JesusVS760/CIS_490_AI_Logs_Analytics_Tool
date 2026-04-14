import db from "@/lib/db";
import { ensureInstructorsTable } from "@/lib/instructors";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";

ensureInstructorsTable();

const instructorColumns = db
  .prepare("PRAGMA table_info(instructors)")
  .all() as { name: string }[];

if (!instructorColumns.some((col) => col.name === "reset_code")) {
  db.exec("ALTER TABLE instructors ADD COLUMN reset_code TEXT");
}

if (!instructorColumns.some((col) => col.name === "reset_expires")) {
  db.exec("ALTER TABLE instructors ADD COLUMN reset_expires TEXT");
}

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD ?? process.env.GMAIL_PASS,
  },
});

function generateResetCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendResetEmail(email: string, code: string) {
  await transporter.sendMail({
    from: process.env.GMAIL_USER,
    to: email,
    subject: "Reset your password",
    text: `Your password reset code is ${code}. It expires in 10 minutes.`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5;">
        <h2>Reset your password</h2>
        <p>Your password reset code is:</p>
        <div style="font-size: 32px; font-weight: bold; letter-spacing: 6px; margin: 16px 0;">
          ${code}
        </div>
        <p>This code expires in 10 minutes.</p>
      </div>
    `,
  });
}

type InstructorRow = {
  id: number;
  email: string;
  auth_provider: string;
  has_local_password: number;
  reset_code: string | null;
  reset_expires: string | null;
};

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const action = String(formData.get("action") || "request").trim();
    const email = String(formData.get("email") || "")
      .trim()
      .toLowerCase();
    const code = String(formData.get("code") || "").trim();
    const newPassword = String(formData.get("newPassword") || "").trim();

    if (!email) {
      return NextResponse.json(
        { success: false, message: "Email is required." },
        { status: 400 }
      );
    }

    const user = db
      .prepare(
        `
        SELECT
          id,
          email,
          auth_provider,
          has_local_password,
          reset_code,
          reset_expires
        FROM instructors
        WHERE email = ?
        `
      )
      .get(email) as InstructorRow | undefined;

    if (action === "request") {
      if (!user) {
        return NextResponse.json({
          success: true,
          message:
            "If an account with that email exists, a reset code has been sent.",
        });
      }

      const resetCode = generateResetCode();
      const resetExpires = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      db.prepare(
        `
        UPDATE instructors
        SET reset_code = ?, reset_expires = ?
        WHERE email = ?
        `
      ).run(resetCode, resetExpires, email);

      try {
        await sendResetEmail(email, resetCode);
      } catch (mailError) {
        console.error("Reset email failed:", mailError);

        return NextResponse.json(
          { success: false, message: "Could not send reset email." },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "A reset code has been sent to your email.",
      });
    }

    if (action === "reset") {
      if (!user) {
        return NextResponse.json(
          { success: false, message: "Account not found." },
          { status: 404 }
        );
      }

      if (!/^\d{6}$/.test(code)) {
        return NextResponse.json(
          { success: false, message: "Enter a valid 6-digit reset code." },
          { status: 400 }
        );
      }

      if (!newPassword) {
        return NextResponse.json(
          { success: false, message: "New password is required." },
          { status: 400 }
        );
      }

      if (newPassword.length < 6) {
        return NextResponse.json(
          {
            success: false,
            message: "Password must be at least 6 characters.",
          },
          { status: 400 }
        );
      }

      if (!user.reset_code || !user.reset_expires) {
        return NextResponse.json(
          {
            success: false,
            message: "No reset request found. Please request a new code.",
          },
          { status: 400 }
        );
      }

      const expiresAt = new Date(user.reset_expires).getTime();
      const now = Date.now();

      if (Number.isNaN(expiresAt) || now > expiresAt) {
        return NextResponse.json(
          { success: false, message: "Reset code expired. Request a new one." },
          { status: 400 }
        );
      }

      if (user.reset_code !== code) {
        return NextResponse.json(
          { success: false, message: "Invalid reset code." },
          { status: 400 }
        );
      }

      const passwordHash = await bcrypt.hash(newPassword, 10);
      const nextProvider =
        user.auth_provider === "github" ? "both" : user.auth_provider || "local";

      db.prepare(
        `
        UPDATE instructors
        SET
          password_hash = ?,
          has_local_password = 1,
          auth_provider = ?,
          reset_code = NULL,
          reset_expires = NULL
        WHERE email = ?
        `
      ).run(passwordHash, nextProvider, email);

      return NextResponse.json({
        success: true,
        message: "Password reset successfully.",
        redirectTo: "/login",
      });
    }

    return NextResponse.json(
      { success: false, message: "Invalid action." },
      { status: 400 }
    );
  } catch (error) {
    console.error("Reset route error:", error);

    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}
