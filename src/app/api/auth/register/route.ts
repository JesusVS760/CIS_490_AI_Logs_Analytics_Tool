import db from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";

// Create instructors table if it does not exist
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
  db.exec("ALTER TABLE instructors ADD COLUMN is_verified INTEGER NOT NULL DEFAULT 0");
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

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const email = String(formData.get("email") || "").trim().toLowerCase();
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

    const existing = db
      .prepare("SELECT id FROM instructors WHERE email = ?")
      .get(email);

    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 },
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const verificationCode = generateVerificationCode();
    const verificationExpires = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const result = db
      .prepare(`
        INSERT INTO instructors (
          name,
          email,
          password_hash,
          is_verified,
          verification_code,
          verification_expires
        )
        VALUES (?, ?, ?, 0, ?, ?)
      `)
      .run(name, email, passwordHash, verificationCode, verificationExpires);

    try {
      await sendVerificationEmail(email, verificationCode);
    } catch (mailError) {
      console.error("Verification email send failed:", mailError);
      db.prepare("DELETE FROM instructors WHERE id = ?").run(result.lastInsertRowid);

      return NextResponse.json(
        { error: "Could not send verification email. Please try again." },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        user: {
          id: Number(result.lastInsertRowid),
          email,
          name,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}