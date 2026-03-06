import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const auth = await verifyAuth(req);

  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    success: true,
    user: {
      id: auth.instructorId,
      email: auth.email,
      name: auth.name,
    },
  });
}
