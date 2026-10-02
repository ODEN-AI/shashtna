import { NextResponse } from "next/server";

import type { ConsoleErrorCode } from "@/src/lib/console-api";
import { isStaffRole, normalizeRole } from "@/src/lib/roles";
import { authenticateRequest } from "@/src/lib/session";

/**
 * Small helpers for /api/console/v1. Authentication is the existing one
 * (authenticateRequest: signed token + full session check); these only add
 * the Console API's response and request conventions.
 */

const NO_STORE = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
const MAX_BODY_BYTES = 4096;

export const MESSAGES = {
  unauthenticated: "انتهت جلسة تسجيل الدخول. يرجى تسجيل الدخول مرة أخرى.",
  forbidden: "ليس لديك صلاحية لتنفيذ هذا الإجراء.",
  notFound: "الجهاز غير موجود.",
  invalid: "بيانات غير صحيحة.",
} as const;

/** Every Console API response: JSON, never cached. */
export function consoleJson(body: Record<string, unknown>, status = 200, headers: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { ...NO_STORE, ...headers } });
}

/**
 * The v1 error envelope (src/lib/console-api: ConsoleErrorBody). `field`
 * names the invalid input; `retryAfter` (seconds) accompanies 429 — both are
 * also sent as headers (X-Invalid-Field / Retry-After) for older callers.
 */
export function consoleError(status: number, code: ConsoleErrorCode, message: string, headers: Record<string, string> = {}) {
  const extra: { field?: string; retryAfter?: number } = {};
  if (headers["X-Invalid-Field"]) extra.field = headers["X-Invalid-Field"];
  if (headers["Retry-After"]) extra.retryAfter = Number(headers["Retry-After"]);

  return consoleJson({ ok: false, code, message, ...extra }, status, headers);
}

/**
 * Wrap a Console route so an unexpected exception answers with the JSON
 * envelope (SERVER_ERROR, 500) instead of an HTML error page. Only the
 * error message is logged; nothing internal reaches the response.
 */
export function consoleRoute<A extends unknown[]>(handler: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (error) {
      console.error("CONSOLE_API_ERROR:", error instanceof Error ? error.message : "unknown error");
      return consoleError(500, "SERVER_ERROR", "حدث خطأ غير متوقع. حاول مرة أخرى.");
    }
  };
}

/**
 * Read a small JSON body. Requires `Content-Type: application/json` (a
 * cross-site form can't send it without a CORS preflight, which this API
 * never grants) and rejects a foreign Origin, so cookie-authenticated
 * requests can't be forged from another site.
 */
export async function readJsonBody(request: Request): Promise<{ ok: true; body: unknown } | { ok: false; response: NextResponse }> {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return { ok: false, response: consoleError(403, "FORBIDDEN", MESSAGES.forbidden) };
  }

  if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) {
    return { ok: false, response: consoleError(415, "UNSUPPORTED_MEDIA_TYPE", MESSAGES.invalid) };
  }

  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return { ok: false, response: consoleError(413, "TOO_LARGE", MESSAGES.invalid) };

  try {
    return { ok: true, body: text ? JSON.parse(text) : {} };
  } catch {
    return { ok: false, response: consoleError(400, "INVALID_JSON", MESSAGES.invalid) };
  }
}

/** A signed-in staff member (any staff role), with the full session check. 401 / 403 otherwise. */
export async function requireConsoleStaff(request: Request) {
  const auth = await authenticateRequest(request);

  if (!auth) return { ok: false as const, response: consoleError(401, "UNAUTHENTICATED", MESSAGES.unauthenticated) };

  const role = normalizeRole(auth.user.role);
  if (!isStaffRole(role)) return { ok: false as const, response: consoleError(403, "FORBIDDEN", MESSAGES.forbidden) };

  return { ok: true as const, user: { id: auth.user.id, name: auth.user.name, role }, payload: auth.payload };
}

/** Route param → positive integer id, or null. */
export function idParam(value: string) {
  return /^[1-9]\d{0,9}$/.test(value) ? Number(value) : null;
}
