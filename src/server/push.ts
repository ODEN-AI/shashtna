import { buildMessages, chunk, readTickets, type DeviceInput, type PushNotification } from "@/src/lib/push";
import { db } from "@/src/prisma/db";
import { getSettings } from "@/src/server/settings";

/**
 * Push notifications — database and Expo side. See docs/push.md.
 *
 * Phones register their Expo push token through POST /api/mobile/devices.
 * When the owner's switch (`push.enabled`) is on, every new in-app
 * notification for a customer is also pushed to their active phones
 * (sendPushForNotification, called from notify()). Sending is best effort:
 * it never throws and never delays a notification for more than a few
 * seconds. Tokens are never logged.
 */

const EXPO_SEND_URL = "https://exp.host/--/api/v2/push/send";
const SEND_TIMEOUT_MS = 5_000;

export type PushFetch = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal: AbortSignal }) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

let fetchOverride: PushFetch | null = null;

/** Tests only (scripts/integration/push.mts): send through a fake instead of Expo. */
export function setPushFetchForTests(fake: PushFetch | null) {
  fetchOverride = fake;
}

export async function pushEnabled() {
  return (await getSettings())["push.enabled"] === "on";
}

/** Store (or move to this account) a phone's token. Returns the device id. */
export async function registerDevice(userId: number, input: DeviceInput) {
  const now = new Date().toISOString();
  const existing = await db.orm.public.PushDevice.first({ token: input.token });

  if (existing) {
    await db.orm.public.PushDevice.where({ id: existing.id }).update({ userId, platform: input.platform, deviceName: input.deviceName, appVersion: input.appVersion, isActive: true, lastSeenAt: now, lastError: null });

    return existing.id;
  }

  const created = await db.orm.public.PushDevice.create({ userId, token: input.token, platform: input.platform, deviceName: input.deviceName, appVersion: input.appVersion, isActive: true, lastSeenAt: now });

  return created.id;
}

/** Sign-out: this account stops receiving pushes on that phone. */
export async function unregisterDevice(userId: number, token: string) {
  await db.orm.public.PushDevice.where({ token, userId }).update({ isActive: false });
}

/** The account's active phones (for the admin customer page: counts only). */
export async function countActiveDevices(userId: number) {
  const result = await db.orm.public.PushDevice.where({ userId, isActive: true }).aggregate((a) => ({ count: a.count() }));

  return result.count;
}

/**
 * Push one in-app notification to its owner's active phones. Never throws.
 * Returns what happened (for tests and logs): counts only.
 */
export async function sendPushForNotification(userId: number, notification: PushNotification, options: { fetchImpl?: PushFetch; force?: boolean } = {}) {
  const result = { sent: 0, failed: 0, switchedOff: 0, skipped: "" as "" | "OFF" | "NO_DEVICES" | "ERROR" };

  try {
    if (!options.force && !(await pushEnabled())) return { ...result, skipped: "OFF" as const };

    const devices = await db.orm.public.PushDevice.where({ userId, isActive: true }).select("id", "token").all();

    if (!devices.length) return { ...result, skipped: "NO_DEVICES" as const };

    const send = options.fetchImpl ?? fetchOverride ?? (fetch as unknown as PushFetch);
    const headers: Record<string, string> = { Accept: "application/json", "Content-Type": "application/json" };

    if (process.env.EXPO_ACCESS_TOKEN) headers.Authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;

    for (const batch of chunk(devices)) {
      const tokens = batch.map((device) => device.token);
      let outcomes;

      try {
        const response = await send(EXPO_SEND_URL, { method: "POST", headers, body: JSON.stringify(buildMessages(tokens, notification)), signal: AbortSignal.timeout(SEND_TIMEOUT_MS) });

        outcomes = readTickets(tokens, response.ok ? await response.json() : null);
      } catch (error) {
        console.error("PUSH_SEND_ERROR:", error instanceof Error ? error.name : "unknown");
        outcomes = tokens.map((token) => ({ token, ok: false, gone: false, error: "NETWORK" }));
      }

      for (const outcome of outcomes) {
        if (outcome.ok) {
          result.sent += 1;
          continue;
        }

        result.failed += 1;
        if (outcome.gone) result.switchedOff += 1;

        await db.orm.public.PushDevice.where({ token: outcome.token }).update({ lastError: outcome.error, ...(outcome.gone ? { isActive: false } : {}) });
      }
    }

    return result;
  } catch (error) {
    console.error("PUSH_ERROR:", error instanceof Error ? error.message : error);

    return { ...result, skipped: "ERROR" as const };
  }
}
