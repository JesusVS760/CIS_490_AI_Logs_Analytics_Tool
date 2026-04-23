import db from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
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
  const newCode = generateVerificationCode();
  const newExpires = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  await db.execute({
    sql: `UPDATE instructors
          SET verification_code = ?, verification_expires = ?, is_verified = 0
          WHERE email = ?`,
    args: [newCode, newExpires, email],
  });

  await sendVerificationEmail(email, newCode);
}

type InstructorRow = {
  id: number;
  name: string;
  email: string;
  is_verified: number;
  verification_code: string | null;
  verification_expires: string | null;
};

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const action = String(formData.get("action") || "").trim();
    const email = String(formData.get("email") || "")
      .trim()
      .toLowerCase();
    const code = String(formData.get("code") || "").trim();

    if (!email) {
      return NextResponse.json(
        { success: false, message: "Email is required." },
        { status: 400 },
      );
    }

    const result = await db.execute({
      sql: `SELECT id, name, email, is_verified, verification_code, verification_expires
            FROM instructors WHERE email = ?`,
      args: [email],
    });

    const cols = result.columns;
    const userRow = result.rows[0];
    const user = userRow
      ? (Object.fromEntries(
          cols.map((c, i) => [c, userRow[i]]),
        ) as InstructorRow)
      : undefined;

    if (!user) {
      return NextResponse.json(
        { success: false, message: "User not found." },
        { status: 404 },
      );
    }

    if (action === "verify") {
      if (!/^\d{6}$/.test(code)) {
        return NextResponse.json(
          { success: false, message: "Enter a valid 6-digit code." },
          { status: 400 },
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
          { status: 400 },
        );
      }

      const expiresAt = new Date(user.verification_expires).getTime();
      if (Number.isNaN(expiresAt) || Date.now() > expiresAt) {
        return NextResponse.json(
          {
            success: false,
            message: "Code expired. Please request a new one.",
          },
          { status: 400 },
        );
      }

      if (user.verification_code !== code) {
        return NextResponse.json(
          { success: false, message: "Invalid verification code." },
          { status: 400 },
        );
      }

      await db.execute({
        sql: `UPDATE instructors
              SET is_verified = 1, verification_code = NULL, verification_expires = NULL
              WHERE email = ?`,
        args: [email],
      });

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
          { status: 400 },
        );
      }

      try {
        await createAndSendVerificationCode(email);
      } catch (mailError) {
        console.error("Resend verification email failed:", mailError);
        return NextResponse.json(
          { success: false, message: "Could not send verification email." },
          { status: 500 },
        );
      }

      return NextResponse.json({
        success: true,
        message: "A new verification code has been sent.",
      });
    }

    return NextResponse.json(
      { success: false, message: "Invalid action." },
      { status: 400 },
    );
  } catch (error) {
    console.error("Verify email route error:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 },
    );
  }
}
