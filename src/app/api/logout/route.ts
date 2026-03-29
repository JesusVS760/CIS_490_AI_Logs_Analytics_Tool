import { NextResponse } from "next/server";

export async function POST() {
  try {
    const response = NextResponse.json({ success: true });

    // Clear next-auth v4 session cookies
    const cookieOptions = {
      path: "/",
      expires: new Date(0),
    };

    response.cookies.set("next-auth.session-token", "", cookieOptions);
    response.cookies.set("next-auth.csrf-token", "", cookieOptions);
    response.cookies.set("next-auth.callback-url", "", cookieOptions);

    // Also clear the __Secure- prefixed versions (used in production over HTTPS)
    response.cookies.set("__Secure-next-auth.session-token", "", cookieOptions);
    response.cookies.set("__Secure-next-auth.csrf-token", "", cookieOptions);
    response.cookies.set("__Secure-next-auth.callback-url", "", cookieOptions);

    return response;
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json(
      { error: "Failed to log out" },
      { status: 500 }
    );
  }
}