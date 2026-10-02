import { consoleError, consoleJson, requireConsoleStaff, MESSAGES, consoleRoute } from "@/src/server/console-api";
import { listDevices } from "@/src/server/console-devices";

/**
 * GET /api/console/v1/devices            → the caller's own devices
 * GET /api/console/v1/devices?scope=team → every staff device ("staff" permission)
 *
 * Safe metadata only: never credential verifiers, tokens or push tokens.
 */
export const GET = consoleRoute(async (request: Request) => {
  const auth = await requireConsoleStaff(request);
  if (!auth.ok) return auth.response;

  const scope = new URL(request.url).searchParams.get("scope") === "team" ? "team" : "mine";
  const devices = await listDevices(auth.user, scope);
  if (!devices) return consoleError(403, "FORBIDDEN", MESSAGES.forbidden);

  return consoleJson({ ok: true, scope, devices });
});
