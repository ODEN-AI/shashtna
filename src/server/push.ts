import { db } from "@/src/prisma/db";
import {
  buildPushMessage,
  chunk,
  isExpoPushToken,
  isPermanentTokenError,
  type ExpoPushMessage,
  type PushPlatform,
} from "@/src/lib/push";

/**
 * Push delivery through the Expo Push Service, which forwards to Firebase
 * Cloud Messaging (Android) and APNs (iOS) using the credentials configured
 * for the app in EAS. Server config:
 *
 *   EXPO_ACCESS_TOKEN  optional; required only when "Enhanced push security"
 *                      is enabled for the project on expo.dev
 *   PUSH_DISABLED=1    turns sending off (e.g. local development)
 *   EXPO_PUSH_API_URL  test-only override of the Expo Push API base URL
 *
 * Delivery never breaks the business action that triggered it: every error
 * is caught, logged without personal data, and recorded on the device or
 * campaign.
 */

// EXPO_PUSH_API_URL only exists so end-to-end tests can point delivery at a
// local recorder; production uses the default.
const PUSH_API = (process.env.EXPO_PUSH_API_URL?.trim() || "https://exp.host/--/api/v2/push").replace(/\/+$/, "");
const SEND_URL = `${PUSH_API}/send`;
const RECEIPTS_URL = `${PUSH_API}/getReceipts`;

type Transport = (url: string, body: unknown) => Promise<unknown>;

async function httpTransport(url: string, body: unknown) {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  const token = process.env.EXPO_ACCESS_TOKEN?.trim();

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(`PUSH_HTTP_${response.status}`);
  }

  return response.json();
}

let transport: Transport = httpTransport;

/** Tests replace the network call. */
export function setPushTransport(next: Transport | null) {
  transport = next ?? httpTransport;
}

function pushDisabled() {
  return process.env.PUSH_DISABLED === "1";
}

// ---------------------------------------------------------------- devices

export async function registerDevice(
  userId: number,
  input: { token: string; platform: PushPlatform; deviceName?: string | null; appVersion?: string | null },
) {
  const now = new Date().toISOString();
  const fields = {
    userId,
    platform: input.platform,
    deviceName: input.deviceName?.slice(0, 80) || null,
    appVersion: input.appVersion?.slice(0, 40) || null,
    isActive: true,
    lastSeenAt: now,
    lastError: null,
  };
  const existing = await db.orm.public.PushDevice.first({ token: input.token });

  // A token belongs to one installation. If another account signs in on the
  // same phone, the token moves to that account.
  if (existing) {
    return db.orm.public.PushDevice.where({ id: existing.id }).update(fields);
  }

  return db.orm.public.PushDevice.create({ token: input.token, provider: "EXPO", ...fields });
}

/** Logout: the phone stops receiving this account's notifications. */
export async function unregisterDevice(userId: number, token: string) {
  await db.orm.public.PushDevice.where({ userId, token }).updateAll({ isActive: false });
}

export async function listActiveDevices(userIds: number[]) {
  if (!userIds.length) {
    return [];
  }

  const devices = [];

  for (const ids of chunk(userIds, 500)) {
    devices.push(
      ...(await db.orm.public.PushDevice.where({ isActive: true })
        .where((device) => device.userId.in(ids))
        .all()),
    );
  }

  return devices;
}

async function deactivate(deviceId: number, error: string) {
  await db.orm.public.PushDevice.where({ id: deviceId }).update({ isActive: false, lastError: error.slice(0, 200) });
}

// ------------------------------------------------------------------- send

export type PushNotificationRecord = {
  id: number | null;
  userId: number;
  type: string;
  title: string;
  body: string;
  link: string | null;
  imageUrl?: string | null;
};

export type PushResult = { devices: number; accepted: number; failed: number; error?: string };

type ExpoTicket = { status: "ok"; id: string } | { status: "error"; message?: string; details?: { error?: string } };

/**
 * Sends each notification to all active devices of its user. Tickets are
 * stored so their delivery receipts can be checked later.
 */
export async function pushNotifications(
  notifications: PushNotificationRecord[],
  options: { campaignId?: number | null } = {},
): Promise<PushResult> {
  const result: PushResult = { devices: 0, accepted: 0, failed: 0 };

  if (pushDisabled() || !notifications.length) {
    return result;
  }

  const devices = await listActiveDevices([...new Set(notifications.map((item) => item.userId))]);
  const outgoing: { deviceId: number; message: ExpoPushMessage }[] = [];

  for (const notification of notifications) {
    for (const device of devices) {
      if (device.userId === notification.userId && isExpoPushToken(device.token)) {
        outgoing.push({ deviceId: device.id, message: buildPushMessage(device.token, notification) });
      }
    }
  }

  result.devices = outgoing.length;

  for (const batch of chunk(outgoing, 100)) {
    let tickets: ExpoTicket[];

    try {
      const response = (await transport(SEND_URL, batch.map((item) => item.message))) as { data?: ExpoTicket[] };
      tickets = Array.isArray(response?.data) ? response.data : [];
    } catch (error) {
      const message = error instanceof Error ? error.message : "PUSH_ERROR";
      console.error("PUSH_SEND_ERROR:", message);
      result.failed += batch.length;
      result.error = message;
      continue;
    }

    for (const [index, item] of batch.entries()) {
      const ticket = tickets[index];

      if (ticket?.status === "ok") {
        result.accepted += 1;
        await db.orm.public.PushTicket.create({
          ticketId: ticket.id,
          deviceId: item.deviceId,
          campaignId: options.campaignId ?? null,
        }).catch(() => undefined);
        continue;
      }

      result.failed += 1;
      const code = (ticket && ticket.status === "error" && ticket.details?.error) || "UNKNOWN";

      if (isPermanentTokenError(code)) {
        await deactivate(item.deviceId, code);
      } else {
        await db.orm.public.PushDevice.where({ id: item.deviceId }).update({ lastError: code.slice(0, 200) });
      }
    }
  }

  return result;
}

// --------------------------------------------------------------- receipts

type ExpoReceipt = { status: "ok" } | { status: "error"; message?: string; details?: { error?: string } };

/**
 * Checks delivery receipts for tickets older than 15 minutes (Expo keeps them
 * for 24 hours). Unregistered devices are deactivated and campaign failure
 * counts are corrected.
 */
export async function checkPushReceipts(now = Date.now()) {
  if (pushDisabled()) {
    return { checked: 0, failed: 0 };
  }

  const cutoff = new Date(now - 15 * 60 * 1000).toISOString();
  const pending = await db.orm.public.PushTicket.where({ status: "PENDING" })
    .where((ticket) => ticket.createdAt.lt(cutoff))
    .orderBy((ticket) => ticket.id.asc())
    .limit(1000)
    .all();
  let failed = 0;

  for (const batch of chunk(pending, 300)) {
    let receipts: Record<string, ExpoReceipt>;

    try {
      const response = (await transport(RECEIPTS_URL, { ids: batch.map((ticket) => ticket.ticketId) })) as {
        data?: Record<string, ExpoReceipt>;
      };
      receipts = response?.data ?? {};
    } catch (error) {
      console.error("PUSH_RECEIPTS_ERROR:", error instanceof Error ? error.message : error);
      break;
    }

    const checkedAt = new Date(now).toISOString();

    for (const ticket of batch) {
      const receipt = receipts[ticket.ticketId];
      // Receipts older than a day are gone; treat them as delivered.
      const expired = !receipt && now - new Date(ticket.createdAt).getTime() > 24 * 60 * 60 * 1000;

      if (!receipt && !expired) {
        continue;
      }

      if (receipt?.status === "error") {
        failed += 1;
        const code = receipt.details?.error ?? "UNKNOWN";

        await db.orm.public.PushTicket.where({ id: ticket.id }).update({ status: "ERROR", error: code, checkedAt });

        if (isPermanentTokenError(code)) {
          await deactivate(ticket.deviceId, code);
        }

        if (ticket.campaignId) {
          const campaign = await db.orm.public.PushCampaign.first({ id: ticket.campaignId });

          if (campaign) {
            await db.orm.public.PushCampaign.where({ id: campaign.id }).update({
              acceptedCount: Math.max(0, campaign.acceptedCount - 1),
              failedCount: campaign.failedCount + 1,
            });
          }
        }
      } else {
        await db.orm.public.PushTicket.where({ id: ticket.id }).update({ status: "OK", checkedAt });
      }
    }
  }

  return { checked: pending.length, failed };
}
