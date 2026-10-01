"use client";

/**
 * fetch() for admin API calls with human-readable failures:
 *  - no network        → throws an Error with a readable connection message
 *  - 401 (no session)  → announces SESSION_EXPIRED_EVENT so the console can
 *                        ask the admin to sign in again
 *  - 403 (no access)   → the API's own "no permission" message is kept
 *  - non-JSON errors   → replaced by a JSON body with a readable message, so
 *                        callers' `response.json()` never shows raw HTML or
 *                        "Unexpected token" errors
 * Technical details go to the console log only.
 */

import { announceSessionExpired } from "@/app/ui/session-events";

export { SESSION_EXPIRED_EVENT } from "@/app/ui/session-events";

export const CONSOLE_MESSAGES = {
  network: "تعذر الاتصال بالخادم. تحقق من اتصال الإنترنت وحاول مرة أخرى.",
  server: "حدث خطأ أثناء تحميل البيانات. حاول مرة أخرى.",
  unauthenticated: "انتهت جلسة تسجيل الدخول. يرجى تسجيل الدخول مرة أخرى.",
  forbidden: "ليس لديك صلاحية لتنفيذ هذا الإجراء.",
} as const;

export async function adminFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  let response: Response;

  try {
    response = await fetch(input, init);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }

    console.error("ADMIN_NETWORK_ERROR:", error);
    throw new Error(CONSOLE_MESSAGES.network);
  }

  if (response.status === 401) {
    announceSessionExpired();
  }

  const isJson = (response.headers.get("content-type") ?? "").includes("application/json");

  if (!response.ok && !isJson) {
    console.error("ADMIN_SERVER_ERROR:", response.status, response.url);
    const message =
      response.status === 401 ? CONSOLE_MESSAGES.unauthenticated : response.status === 403 ? CONSOLE_MESSAGES.forbidden : CONSOLE_MESSAGES.server;

    return Response.json({ success: false, message, error: message }, { status: response.status });
  }

  return response;
}
