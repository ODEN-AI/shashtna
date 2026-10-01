import { MESSAGES, consoleError, consoleJson, idParam, readJsonBody, requireConsoleStaff } from "@/src/server/console-api";
import { revokeDevice } from "@/src/server/console-devices";

/** POST /api/console/v1/devices/:id/revoke — the device's owner, or the "staff" permission. Audited. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireConsoleStaff(request);
  if (!auth.ok) return auth.response;

  const read = await readJsonBody(request);
  if (!read.ok) return read.response;

  const id = idParam((await params).id);
  const result = id ? await revokeDevice(auth.user, id) : null;
  if (!result?.ok) return consoleError(404, "NOT_FOUND", MESSAGES.notFound);

  return consoleJson({ ok: true, device: result.device, changed: result.changed });
}
