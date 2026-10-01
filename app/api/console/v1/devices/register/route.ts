import { parseDeviceInput } from "@/src/lib/console-api";
import { MESSAGES, consoleError, consoleJson, readJsonBody, requireConsoleStaff } from "@/src/server/console-api";
import { registerDevice } from "@/src/server/console-devices";

/**
 * POST /api/console/v1/devices/register  { platform, label, appVersion?, deviceId? }
 *
 * Called by the native shell's own HTTP layer (not page JavaScript) right
 * after a password sign-in. Needs a normal staff session (a device session
 * can't mint more credentials). Returns the device credential ONCE; the
 * server keeps only its verifier. With `deviceId`, re-binds one of the
 * caller's own devices (rotating its credential) instead of adding a row.
 */
export async function POST(request: Request) {
  const auth = await requireConsoleStaff(request);
  if (!auth.ok) return auth.response;
  if (auth.payload.did !== undefined) return consoleError(403, "FORBIDDEN", MESSAGES.forbidden);

  const read = await readJsonBody(request);
  if (!read.ok) return read.response;

  const input = parseDeviceInput(read.body);
  if (!input.ok) return consoleError(400, "INVALID", MESSAGES.invalid, { "X-Invalid-Field": input.field });

  const result = await registerDevice(auth.user, auth.payload.iat, input.value);
  if (!result.ok) {
    if (result.error === "LIMIT") return consoleError(409, "DEVICE_LIMIT", "وصلت للحد الأعلى من الأجهزة. ألغِ جهازًا قديمًا أولًا.");
    if (result.error === "REVOKED") return consoleError(409, "DEVICE_REVOKED", "هذا الجهاز ملغى. سجّله كجهاز جديد.");
    if (result.error === "FORBIDDEN") return consoleError(403, "FORBIDDEN", MESSAGES.forbidden);
    return consoleError(404, "NOT_FOUND", MESSAGES.notFound);
  }

  return consoleJson({ ok: true, device: result.device, credential: result.credential, rebound: result.rebound }, result.rebound ? 200 : 201);
}
