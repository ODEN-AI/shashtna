import { NextResponse } from "next/server";

import {
  SESSION_COOKIE,
  verifyAuthToken,
  type MobileAuthPayload,
} from "@/src/lib/mobile-auth";
import { db } from "@/src/prisma/db";

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

  if (!payload) {
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
 * Admin guard. The role is re-read from the database so a demoted or
 * deleted account loses access immediately, even with an unexpired token.
 */
export async function requireAdmin(request: Request) {
  const payload = getRequestAuth(request);

  if (!payload) {
    return {
      ok: false as const,
      response: authError(
        401,
        "انتهت جلسة تسجيل الدخول. يرجى تسجيل الدخول مرة أخرى.",
      ),
    };
  }

  const user = await db.orm.public.User.first({ id: payload.sub });

  if (!user || String(user.role ?? "").toUpperCase() !== "ADMIN") {
    return {
      ok: false as const,
      response: authError(403, "هذه الصفحة مخصصة للمسؤولين فقط."),
    };
  }

  return {
    ok: true as const,
    user,
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
