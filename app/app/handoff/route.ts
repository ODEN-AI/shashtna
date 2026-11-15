import { NextResponse } from "next/server";

import { APP_MODE_COOKIE, safeNext, verifyHandoffCode } from "@/src/lib/app-handoff";
import { createAuthToken } from "@/src/lib/mobile-auth";
import { isStaffRole } from "@/src/lib/roles";
import { setSessionCookie } from "@/src/lib/session";
import { db } from "@/src/prisma/db";

export const dynamic = "force-dynamic";

/**
 * POST /app/handoff (form: code, next) — the customer app's in-app browser
 * lands here with a one-time code from POST /api/mobile/web-session and is
 * signed in to the website, then sent to `next` (an allow-listed customer
 * page). The code comes in the body, never the URL. App mode is switched on
 * for this browser so pages render without the site's header, footer and
 * menus. A bad or expired code lands on the login page instead; no code at all
 * (a guest browsing the store) gets app mode without a session.
 */
export async function POST(request: Request) {
  let code: unknown = null;
  let next: unknown = null;

  try {
    const form = await request.formData();
    code = form.get("code");
    next = form.get("next");
  } catch {
    // A body that isn't a form is treated as no code.
  }

  const target = safeNext(next);
  const appMode = (response: NextResponse) => {
    response.cookies.set(APP_MODE_COOKIE, "1", { httpOnly: false, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
    response.headers.set("Cache-Control", "no-store");

    return response;
  };

  // A guest (no code at all) browses in app mode without a session, e.g. the store before signing in.
  if (code === null || code === "") {
    return appMode(NextResponse.redirect(new URL(target, request.url), 303));
  }

  const userId = verifyHandoffCode(code);
  const user = userId ? await db.orm.public.User.first({ id: userId }) : null;

  if (!user || isStaffRole(user.role)) {
    return appMode(NextResponse.redirect(new URL(`/login?redirect=${encodeURIComponent(target)}`, request.url), 303));
  }

  const session = createAuthToken(user.id, user.role);
  const response = appMode(NextResponse.redirect(new URL(target, request.url), 303));

  setSessionCookie(response, session.token, session.expiresAt);

  return response;
}
