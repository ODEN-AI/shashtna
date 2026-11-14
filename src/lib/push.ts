/**
 * Push notifications to the Shashtna customer app — pure rules.
 * See docs/push.md.
 *
 * Every in-app notification the site creates for a customer is also sent as
 * a push to that customer's registered phones (Expo Push Service → FCM /
 * APNs), when the owner has switched push on. The push carries the same
 * title, text and link as the in-app notification; the app routes a tap
 * from `{ notificationId, type, link }`.
 */

export const PUSH_PLATFORMS = ["ANDROID", "IOS"] as const;
export type PushPlatform = (typeof PUSH_PLATFORMS)[number];

/** Expo accepts at most 100 messages per request. */
export const EXPO_BATCH = 100;

const TOKEN = /^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]{10,180}\]$/;

export function isExpoToken(value: unknown): value is string {
  return typeof value === "string" && TOKEN.test(value);
}

/** A token as it may appear in logs or screens: never in full. */
export function maskToken(token: string) {
  return `${String(token).slice(0, 22)}…`;
}

export type DeviceInput = { token: string; platform: PushPlatform; deviceName: string | null; appVersion: string | null };

/** The app's registration body, checked on the server. */
export function checkDeviceInput(body: Record<string, unknown>): { ok: true; value: DeviceInput } | { ok: false; error: string } {
  if (!isExpoToken(body.token)) return { ok: false, error: "رمز الإشعارات غير صالح." };

  const platform = String(body.platform ?? "").toUpperCase();

  if (!(PUSH_PLATFORMS as readonly string[]).includes(platform)) return { ok: false, error: "نوع الجهاز غير صالح." };

  const text = (value: unknown, max: number) => {
    const clean = String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);

    return clean || null;
  };

  return { ok: true, value: { token: body.token, platform: platform as PushPlatform, deviceName: text(body.deviceName, 80), appVersion: text(body.appVersion, 20) } };
}

/** The app's Android channel for a notification type (the app creates these three). */
export function channelFor(type: string) {
  const value = String(type ?? "").toUpperCase();

  if (/INCIDENT|STATUS_|MAINTENANCE|OUTAGE/.test(value)) return "service";
  if (/OFFER|ANNOUNCEMENT|IMAGE|PROMO|NEWS/.test(value)) return "offers";

  return "account";
}

export type PushNotification = { id: number; type: string; title: string; body: string; link: string | null };

export type ExpoMessage = {
  to: string;
  title: string;
  body: string;
  data: { notificationId: number; type: string; link: string | null };
  sound: "default";
  priority: "high" | "normal";
  channelId: string;
};

/** One Expo message per token, with the notification's own title, text and link. */
export function buildMessages(tokens: readonly string[], notification: PushNotification): ExpoMessage[] {
  const channelId = channelFor(notification.type);

  return tokens.map((to) => ({
    to,
    title: String(notification.title).slice(0, 100),
    body: String(notification.body).slice(0, 300),
    data: { notificationId: notification.id, type: String(notification.type).slice(0, 40), link: notification.link },
    sound: "default",
    priority: channelId === "offers" ? "normal" : "high",
    channelId,
  }));
}

export function chunk<T>(items: readonly T[], size: number = EXPO_BATCH): T[][] {
  const out: T[][] = [];

  for (let index = 0; index < items.length; index += size) out.push(items.slice(index, index + size));

  return out;
}

export type TicketOutcome = { token: string; ok: boolean; gone: boolean; error: string | null };

/**
 * Expo's answer for a batch, per token, in the order sent. A token Expo says
 * is no longer registered (`DeviceNotRegistered`) is `gone` and gets switched
 * off. A malformed answer marks every token as failed, never gone.
 */
export function readTickets(tokens: readonly string[], response: unknown): TicketOutcome[] {
  const data = response && typeof response === "object" ? (response as { data?: unknown }).data : undefined;

  if (!Array.isArray(data)) return tokens.map((token) => ({ token, ok: false, gone: false, error: "BAD_RESPONSE" }));

  return tokens.map((token, index) => {
    const ticket = data[index] as { status?: string; message?: string; details?: { error?: string } } | undefined;

    if (ticket?.status === "ok") return { token, ok: true, gone: false, error: null };

    const code = ticket?.details?.error ?? (ticket ? "ERROR" : "NO_TICKET");

    return { token, ok: false, gone: code === "DeviceNotRegistered", error: String(code).slice(0, 60) };
  });
}
