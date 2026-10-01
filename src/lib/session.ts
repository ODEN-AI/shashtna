import { NextResponse } from "next/server";

import {
  SESSION_COOKIE,
  verifyAuthToken,
  type MobileAuthPayload,
} from "@/src/lib/mobile-auth";
import { hasPermission, type Permission } from "@/src/lib/roles";
import { db } from "@/src/prisma/db";
import { sessionState } from "@/src/server/staff-sessions";

/*
 * The website session cookie carries the same signed token the mobile app
 * receives, so every API route authenticates either a Bearer token (mobile)
 * or the HttpOnly cookie (website) the same way.
 */

function readCookie(request: Request, name: string) {
  const header = request.headers.get("cookie") ?? "";

  for (const part of header.split(";")) {
    const separator = part.indexOf("=");

    if (separator === -1) {
      continue;
    }

    if (part.slice(0, separator).trim() === name) {
      try {
        return decodeURIComponent(part.slice(separator + 1).trim());
      } catch {
        return null;
      }
    }
  }

  return null;
}

export function getRequestAuth(
  request: Request,
): MobileAuthPayload | null {
  const authorization = request.headers.get("authorization") ?? "";
  const bearer = authorization.match(/^Bearer\s+(.+)$/i);

  const token = bearer ? bearer[1].trim() : readCookie(request, SESSION_COOKIE);

  if (!token) {
    return null;
  }

  return verifyAuthToken(token);
}

function authError(status: 401 | 403, message: string) {
  return NextResponse.json(
    {
      success: false,
      message,
      error: message,
    },
    {
      status,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

/**
 * Resolves the signed-in user for a customer API request.
 *
 * `claimedUserId` is the userId the client sent (query/body). It is never
 * trusted: when present it must match the authenticated user.
 */
export function requireUser(request: Request, claimedUserId?: unknown) {
  const payload = getRequestAuth(request);

  // Console device sessions are for the staff console only, never the
  // customer APIs (which don't re-check device state).
  if (!payload || payload.did !== undefined) {
    return {
      ok: false as const,
      response: authError(
        401,
        "انتهت جلسة تسجيل الدخول. يرجى تسجيل الدخول مرة أخرى.",
      ),
    };
  }

  if (
    claimedUserId !== undefined &&
    claimedUserId !== null &&
    claimedUserId !== "" &&
    Number(claimedUserId) !== payload.sub
  ) {
    return {
      ok: false as const,
      response: authError(403, "ليس لديك صلاحية الوصول إلى هذه البيانات."),
    };
  }

  return {
    ok: true as const,
    userId: payload.sub,
  };
}

/**
 * The authenticated account behind a request (Bearer or cookie), after the
 * full session check (role re-read from the database, staff maximum age,
 * sign-out-everywhere, Console device state). Null = no valid session.
 */
export async function authenticateRequest(request: Request) {
  const payload = getRequestAuth(request);

  if (!payload) {
    return null;
  }

  const user = await db.orm.public.User.first({ id: payload.sub });

  if (!user || (await sessionState(user, payload)) !== "ok") {
    return null;
  }

  return { user, payload };
}

/**
 * Staff guard for admin APIs. The role is re-read from the database so a
 * demoted or deleted account loses access immediately, even with an
 * unexpired token. Legacy ADMIN accounts keep full access.
 */
export async function requireAdmin(request: Request, permission: Permission) {
  const auth = await authenticateRequest(request);

  // 401: no valid session (account gone, staff session expired or revoked,
  // Console device revoked / signed out).
  if (!auth) {
    return {
      ok: false as const,
      response: authError(
        401,
        "انتهت جلسة تسجيل الدخول. يرجى تسجيل الدخول مرة أخرى.",
      ),
    };
  }

  // 403: signed in, but the role lacks this permission.
  if (!hasPermission(auth.user.role, permission)) {
    return {
      ok: false as const,
      response: authError(403, "ليس لديك صلاحية لتنفيذ هذا الإجراء."),
    };
  }

  return {
    ok: true as const,
    user: auth.user,
  };
}

export function setSessionCookie(
  response: NextResponse,
  token: string,
  expiresAt: number,
) {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(expiresAt),
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
