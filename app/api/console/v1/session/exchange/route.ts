import { clientAddress } from "@/src/lib/login-throttle";
import { setSessionCookie } from "@/src/lib/session";
import { MESSAGES, consoleError, consoleJson, readJsonBody, consoleRoute } from "@/src/server/console-api";
import { exchangeCredential } from "@/src/server/console-devices";
import { clearThrottle, recordThrottleFailure, throttleKeys, throttleRetryAfter } from "@/src/server/login-throttle";

/**
 * POST /api/console/v1/session/exchange  { credential }
 *
 * A native shell trades its device credential (kept in OS secure storage)
 * for the normal staff session: the existing signed token, set as the
 * existing HttpOnly session cookie. The token itself is not returned.
 * Failures are one generic 401 and are throttled like sign-ins.
 */
export const POST = consoleRoute(async (request: Request) => {
  const read = await readJsonBody(request);
  if (!read.ok) return read.response;

  const credential = (read.body as { credential?: unknown } | null)?.credential;
  const deviceKey = typeof credential === "string" ? (credential.split(".")[1] ?? "invalid").slice(0, 12) : "invalid";
  const keys = throttleKeys(deviceKey, clientAddress(request.headers), "exchange");
  const retryAfter = await throttleRetryAfter(keys);
  if (retryAfter) return consoleError(429, "RATE_LIMITED", "محاولات كثيرة. حاول لاحقًا.", { "Retry-After": String(retryAfter) });

  const result = await exchangeCredential(credential);
  if (!result) {
    await recordThrottleFailure(keys);
    return consoleError(401, "UNAUTHENTICATED", MESSAGES.unauthenticated);
  }

  await clearThrottle(keys);
  const response = consoleJson({ ok: true, expiresAt: result.session.expiresAt, user: result.user, device: result.device });
  setSessionCookie(response, result.session.token, result.session.expiresAt);

  return response;
});
