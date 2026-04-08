import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED_ROUTES = ["/dashboard", "/upload", "/assignments"];

// Fast first-pass: if there's no cookie at all, redirect immediately.
// Full DB-backed validation is handled in app/(protected)/layout.tsx,
// which catches orphaned tokens (e.g. after account deletion).
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtectedRoute = PROTECTED_ROUTES.some((route) =>
    pathname.startsWith(route)
  );

  if (!isProtectedRoute) {
    return NextResponse.next();
  }

  const sessionToken = request.cookies.get("session_token");

  if (!sessionToken) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/(dashboard|upload|assignments)(.*)"],
};