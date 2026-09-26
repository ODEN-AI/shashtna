import { NextResponse } from "next/server";

import { getRequestAuth } from "@/src/lib/session";
import { normalizeRole, isStaffRole } from "@/src/lib/roles";
import { db } from "@/src/prisma/db";

/**
 * Shared plumbing for /api/mobile/* routes.
 *
 * Every route authenticates the Bearer token (the same signed token the
 * website keeps in its HttpOnly cookie), re-reads the account from the
 * database so deleted accounts lose access immediately, and answers with a
 * consistent JSON envelope: `{ success: true, ...data }` or
 * `{ success: false, code, message }`. Responses are never cached by
 * intermediaries.
 */

export const NO_STORE = { "Cache-Control": "private, no-store" } as const;

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

export function fail(status: number, code: string, message: string) {
  return NextResponse.json({ success: false, code, message, error: message }, { status, headers: NO_STORE });
}

export const UNAUTHORIZED_MESSAGE = "انتهت جلسة تسجيل الدخول. يرجى تسجيل الدخول مرة أخرى.";

export function serializeMobileUser(user: {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  role: string;
  preferredContact: string | null;
  renewalReminders: boolean;
  marketingOptIn: boolean;
  createdAt: string;
}): MobileUser {
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

type Handler<C> = (context: { request: Request; user: MobileUser; params: C }) => Promise<Response>;

/** Wraps a route handler with authentication and error handling. */
export function withMobileUser<C = Record<string, never>>(handler: Handler<C>) {
  return async (request: Request, routeContext?: { params: Promise<C> }) => {
    const payload = getRequestAuth(request);

    if (!payload) {
      return fail(401, "UNAUTHORIZED", UNAUTHORIZED_MESSAGE);
    }

    try {
      const row = await db.orm.public.User.first({ id: payload.sub });

      if (!row) {
        return fail(401, "UNAUTHORIZED", UNAUTHORIZED_MESSAGE);
      }

      const params = (routeContext ? await routeContext.params : {}) as C;

      return await handler({ request, user: serializeMobileUser(row), params });
    } catch (error) {
      console.error("MOBILE_API_ERROR:", {
        path: new URL(request.url).pathname,
        message: error instanceof Error ? error.message : String(error),
      });

      return fail(500, "SERVER_ERROR", "صار خطأ بالخادم. حاول مرة ثانية.");
    }
  };
}

/** Public (no login) mobile routes with the same error envelope. */
export function withPublic<C = Record<string, never>>(handler: (context: { request: Request; params: C }) => Promise<Response>) {
  return async (request: Request, routeContext?: { params: Promise<C> }) => {
    try {
      const params = (routeContext ? await routeContext.params : {}) as C;
      return await handler({ request, params });
    } catch (error) {
      console.error("MOBILE_API_ERROR:", {
        path: new URL(request.url).pathname,
        message: error instanceof Error ? error.message : String(error),
      });

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
