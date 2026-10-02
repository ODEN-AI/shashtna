import { PERMISSIONS, hasPermission } from "@/src/lib/roles";
import { staffSessionEndsAt } from "@/src/lib/staff-session";
import { consoleJson, consoleRoute, requireConsoleStaff } from "@/src/server/console-api";

/**
 * GET /api/console/v1/session — who is signed in (after the full server
 * session check), the permissions the server grants that role, and when the
 * session ends. Shells use it on launch/resume; they never decide
 * permissions themselves. Works for browser and device sessions alike.
 */
export const GET = consoleRoute(async (request: Request) => {
  const auth = await requireConsoleStaff(request);
  if (!auth.ok) return auth.response;

  const { payload, user } = auth;

  return consoleJson({
    ok: true,
    user,
    permissions: PERMISSIONS.filter((permission) => hasPermission(user.role, permission)),
    session: {
      kind: payload.did !== undefined ? "device" : "browser",
      deviceId: payload.did ?? null,
      issuedAt: payload.iat * 1000,
      endsAt: staffSessionEndsAt(payload.iat, payload.exp),
    },
  });
});
