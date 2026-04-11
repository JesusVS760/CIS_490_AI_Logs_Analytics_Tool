//deleted getAllMessages 

import { NextRequest, NextResponse } from "next/server";
import { getMessagesByInstructor } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

// Disable Next.js route caching so each instructor always sees their own
// fresh data. Without this, a cached response from one instructor could
// accidentally be served to another on the same deployment.
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/messages
 *
 * Returns every chat message from logs belonging to the currently logged-in
 * instructor. Used by the analytics dashboard to build per-assignment charts.
 *
 * Like /api/sessions, this route MUST filter by instructor_id. Messages are
 * scoped through their parent session: getMessagesByInstructor joins through
 * sessions and filters on sessions.instructor_id.
 */
export async function GET(req: NextRequest) {
  try {
    // Authenticate and resolve the current instructor from the session cookie.
    // If the user isn't logged in, requireAuth returns a 401 we hand back.
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const instructor = authResult;

    // Fetch messages scoped to this instructor only.
    const messages = getMessagesByInstructor(instructor.instructorId);

    // No-store headers guarantee the browser and any intermediate proxies
    // don't cache this response. Critical for multi-account machines where
    // two instructors might share the same browser session.
    return NextResponse.json(messages, {
      headers: {
        "Cache-Control":
          "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (error) {
    console.error("ACTUAL ERROR:", error);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 },
    );
  }
}
