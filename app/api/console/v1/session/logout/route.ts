import { clearSessionCookie, getRequestAuth } from "@/src/lib/session";
import { consoleJson, readJsonBody, consoleRoute } from "@/src/server/console-api";
import { signOutDevice } from "@/src/server/console-devices";

/**
 * POST /api/console/v1/session/logout
 *
 * Ends this session only. For a Console device session the device's
 * credential is cleared too (the shell must sign in with the password
 * again); the device itself is not revoked and other devices and browser
 * sessions are untouched. Always clears the cookie; idempotent.
 */
export const POST = consoleRoute(async (request: Request) => {
  const read = await readJsonBody(request);
  if (!read.ok) return read.response;

  const payload = getRequestAuth(request);
  const signedOutDevice = payload?.did !== undefined ? await signOutDevice(payload.sub, payload.did) : false;
  const response = consoleJson({ ok: true, device: signedOutDevice });
  clearSessionCookie(response);

  return response;
});
