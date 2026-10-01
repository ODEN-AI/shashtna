import { cleanDeviceLabel } from "@/src/lib/console-api";
import { MESSAGES, consoleError, consoleJson, idParam, readJsonBody, requireConsoleStaff } from "@/src/server/console-api";
import { renameDevice } from "@/src/server/console-devices";

/** POST /api/console/v1/devices/:id/rename  { label } — the device's owner, or the "staff" permission. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireConsoleStaff(request);
  if (!auth.ok) return auth.response;

  const read = await readJsonBody(request);
  if (!read.ok) return read.response;

  const label = cleanDeviceLabel((read.body as { label?: unknown } | null)?.label);
  if (!label) return consoleError(400, "INVALID", MESSAGES.invalid, { "X-Invalid-Field": "label" });

  const id = idParam((await params).id);
  const result = id ? await renameDevice(auth.user, id, label) : null;
  if (!result?.ok) return consoleError(404, "NOT_FOUND", MESSAGES.notFound);

  return consoleJson({ ok: true, device: result.device, changed: result.changed });
}
