import { NextResponse } from "next/server";

import { verifyAuthToken } from "@/src/lib/mobile-auth";
import { isStaffRole, normalizeRole } from "@/src/lib/roles";
import { db } from "@/src/prisma/db";
import { issuedAfterRevocation, sessionsRevokedAt } from "@/src/server/mobile/sessions";
import { sessionState } from "@/src/server/staff-sessions";

/**
 * Shared plumbing for /api/mobile/* (the Shashtna app's contract).
 *
 * - Envelope: `{ success: true, ...data }` or `{ success: false, code, message, error }`.
 * - Auth: the Bearer token only (never the website cookie, so other sites
 *   can't ride a browser session), re-checked against the database on every
 *   request: account exists, Console device tokens rejected, staff session
 *   rules, app sign-out-everywhere.
 * - Account data is `private, no-store`; errors never include internals.
 */

export const NO_STORE = { "Cache-Control": "private, no-store" } as const;
export const UNAUTHORIZED_MESSAGE = "انتهت جلسة تسجيل الدخول. يرجى تسجيل الدخول مرة أخرى.";

type UserRow = NonNullable<Awaited<ReturnType<typeof db.orm.public.User.first>>>;

export type MobileUser = {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  role: string;
  isStaff: boolean;
  preferredContact: string | null;
  renewalReminders: boolean;
  marketingOptIn: boolean;
  createdAt: string;
};

export function ok(data: Record<string, unknown> = {}, init: { status?: number; headers?: HeadersInit } = {}) {
  return NextResponse.json({ success: true, ...data }, { status: init.status ?? 200, headers: init.headers ?? NO_STORE });
}

export function fail(status: number, code: string, message: string, headers: HeadersInit = NO_STORE) {
  return NextResponse.json({ success: false, code, message, error: message }, { status, headers });
}

export function serializeMobileUser(user: UserRow): MobileUser {
  const role = normalizeRole(user.role) || "CUSTOMER";

  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    email: user.email,
    role,
    isStaff: isStaffRole(role),
    preferredContact: user.preferredContact,
    renewalReminders: user.renewalReminders,
    marketingOptIn: user.marketingOptIn,
    createdAt: String(user.createdAt),
  };
}

/** The account behind a mobile request after every session check, or null. */
export async function authenticateMobile(request: Request): Promise<UserRow | null> {
  const match = (request.headers.get("authorization") ?? "").match(/^Bearer\s+(.+)$/i);
  const payload = match ? verifyAuthToken(match[1].trim()) : null;

  // Console device sessions belong to the staff Console only.
  if (!payload || payload.did !== undefined) return null;

  const user = await db.orm.public.User.first({ id: payload.sub });
  if (!user) return null;
  if ((await sessionState(user, payload)) !== "ok") return null;
  if (!issuedAfterRevocation(payload.iat, await sessionsRevokedAt(user.id))) return null;

  return user;
}

function logServerError(request: Request, error: unknown) {
  // Path and error text only: never headers, bodies, tokens or passwords.
  console.error("MOBILE_API_ERROR:", {
    path: new URL(request.url).pathname,
    message: error instanceof Error ? error.message : String(error),
  });
}

type RouteContext<C> = { params: Promise<C> };
type UserHandler<C> = (context: { request: Request; user: MobileUser; row: UserRow; params: C }) => Promise<Response>;

/** Authenticated route: 401 without a valid app session; 500 envelope on unexpected errors. */
export function withMobileUser<C = Record<string, never>>(handler: UserHandler<C>) {
  return async (request: Request, routeContext?: RouteContext<C>) => {
    try {
      const row = await authenticateMobile(request);
      if (!row) return fail(401, "UNAUTHORIZED", UNAUTHORIZED_MESSAGE);

      const params = (routeContext ? await routeContext.params : {}) as C;
      return await handler({ request, user: serializeMobileUser(row), row, params });
    } catch (error) {
      logServerError(request, error);
      return fail(500, "SERVER_ERROR", "صار خطأ بالخادم. حاول مرة ثانية.");
    }
  };
}

/** Public route (no login) with the same error envelope. */
export function withPublic<C = Record<string, never>>(handler: (context: { request: Request; params: C }) => Promise<Response>) {
  return async (request: Request, routeContext?: RouteContext<C>) => {
    try {
      const params = (routeContext ? await routeContext.params : {}) as C;
      return await handler({ request, params });
    } catch (error) {
      logServerError(request, error);
      return fail(500, "SERVER_ERROR", "صار خطأ بالخادم. حاول مرة ثانية.");
    }
  };
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function positiveInt(value: unknown) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

/**
 * Older app builds send their own `userId`. It is never trusted: present and
 * different from the signed-in account → 403 (same rule as the website APIs).
 */
export function claimsOtherUser(claimed: unknown, userId: number) {
  return claimed !== undefined && claimed !== null && claimed !== "" && Number(claimed) !== userId;
}

export const FORBIDDEN_MESSAGE = "ليس لديك صلاحية الوصول إلى هذه البيانات.";

/**
 * Drop-in for the older routes that still forward to the website handlers
 * (receipts, subscription-requests, account/profile): same result shape as
 * requireMobileAuth, but with the full session check above.
 */
export async function requireMobileSession(request: Request) {
  const row = await authenticateMobile(request).catch(() => null);

  return row
    ? { ok: true as const, userId: row.id }
    : { ok: false as const, response: fail(401, "UNAUTHORIZED", UNAUTHORIZED_MESSAGE) };
}
