import { deleteSessionToken } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const token = req.cookies.get("session_token")?.value;

  // Remove the token from the DB so it can never be reused
  if (token) {
    deleteSessionToken(token);
  }

  const response = NextResponse.json({ success: true });

  response.cookies.set("session_token", "", {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });

  return response;
}
