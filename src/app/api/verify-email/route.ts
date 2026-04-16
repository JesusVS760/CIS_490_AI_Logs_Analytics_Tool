//NOTE: Must have an .env file in order to work
import db from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

db.exec(`
  CREATE TABLE IF NOT EXISTS instructors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    is_verified INTEGER NOT NULL DEFAULT 0,
    verification_code TEXT,
    verification_expires TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

const instructorColumns = db
  .prepare("PRAGMA table_info(instructors)")
  .all() as { name: string }[];

if (!instructorColumns.some((col) => col.name === "is_verified")) {
  db.exec(
    "ALTER TABLE instructors ADD COLUMN is_verified INTEGER NOT NULL DEFAULT 0"
  );
}

if (!instructorColumns.some((col) => col.name === "verification_code")) {
  db.exec("ALTER TABLE instructors ADD COLUMN verification_code TEXT");
}

if (!instructorColumns.some((col) => col.name === "verification_expires")) {
  db.exec("ALTER TABLE instructors ADD COLUMN verification_expires TEXT");
}

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
  const newCode = generateVerificationCode();
  const newExpires = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  db.prepare(
    `
    UPDATE instructors
    SET
      verification_code = ?,
      verification_expires = ?,
      is_verified = 0
    WHERE email = ?
    `
  ).run(newCode, newExpires, email);

  await sendVerificationEmail(email, newCode);
}

type InstructorRow = {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  is_verified: number;
  verification_code: string | null;
  verification_expires: string | null;
  created_at: string;
};

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const action = String(formData.get("action") || "").trim();
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const code = String(formData.get("code") || "").trim();

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
          name,
          email,
          password_hash,
          is_verified,
          verification_code,
          verification_expires,
          created_at
        FROM instructors
        WHERE email = ?
        `
      )
      .get(email) as InstructorRow | undefined;

    if (!user) {
      return NextResponse.json(
        { success: false, message: "User not found." },
        { status: 404 }
      );
    }

    if (action === "verify") {
      if (!/^\d{6}$/.test(code)) {
        return NextResponse.json(
          { success: false, message: "Enter a valid 6-digit code." },
          { status: 400 }
        );
      }

      if (user.is_verified === 1) {
        return NextResponse.json({
          success: true,
          message: "Email already verified.",
          redirectTo: "/login",
        });
      }

      if (!user.verification_code || !user.verification_expires) {
        return NextResponse.json(
          {
            success: false,
            message: "No verification code found. Please resend.",
          },
          { status: 400 }
        );
      }

      const expiresAt = new Date(user.verification_expires).getTime();
      const now = Date.now();

      if (Number.isNaN(expiresAt) || now > expiresAt) {
        return NextResponse.json(
          { success: false, message: "Code expired. Please request a new one." },
          { status: 400 }
        );
      }

      if (user.verification_code !== code) {
        return NextResponse.json(
          { success: false, message: "Invalid verification code." },
          { status: 400 }
        );
      }

      db.prepare(
        `
        UPDATE instructors
        SET
          is_verified = 1,
          verification_code = NULL,
          verification_expires = NULL
        WHERE email = ?
        `
      ).run(email);

      return NextResponse.json({
        success: true,
        message: "Email verified successfully.",
        redirectTo: "/login",
      });
    }

    if (action === "resend") {
      if (user.is_verified === 1) {
        return NextResponse.json(
          { success: false, message: "This email is already verified." },
          { status: 400 }
        );
      }

      try {
        await createAndSendVerificationCode(email);
      } catch (mailError) {
        console.error("Resend verification email failed:", mailError);

        return NextResponse.json(
          { success: false, message: "Could not send verification email." },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "A new verification code has been sent.",
      });
    }

    return NextResponse.json(
      { success: false, message: "Invalid action." },
      { status: 400 }
    );
  } catch (error) {
    console.error("Verify email route error:", error);

    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}