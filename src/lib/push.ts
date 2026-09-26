/**
 * Pure rules for mobile push notifications: campaign types, audiences,
 * who a campaign reaches, and the message sent to the push provider.
 * Nothing here touches the database or the network, so it is unit-tested.
 */

import { hasPermission } from "@/src/lib/roles";
import { isOpen, isUnpaid } from "@/src/lib/order-status";
import { deriveSubscriptionState } from "@/src/lib/subscription-state";

// ------------------------------------------------------------------ types

/**
 * Notification types an admin can pick. They reuse the type names the
 * backend already writes for automatic notifications, so the website and the
 * app show the same icon/category either way.
 */
export const CAMPAIGN_TYPES = [
  "ANNOUNCEMENT",
  "OFFER",
  "ORDER_STATUS",
  "PAYMENT_UPDATE",
  "SUBSCRIPTION_ACTIVATED",
  "RENEWAL_REMINDER",
  "SERVICE_STATUS",
  "MESSAGE",
] as const;

export type CampaignType = (typeof CAMPAIGN_TYPES)[number];

export const CAMPAIGN_TYPE_LABELS: Record<CampaignType, { ar: string; en: string }> = {
  ANNOUNCEMENT: { ar: "إعلان", en: "Announcement" },
  OFFER: { ar: "عرض", en: "Offer" },
  ORDER_STATUS: { ar: "تحديث الطلب", en: "Order update" },
  PAYMENT_UPDATE: { ar: "تحديث الدفع", en: "Payment update" },
  SUBSCRIPTION_ACTIVATED: { ar: "تفعيل الاشتراك", en: "Subscription activated" },
  RENEWAL_REMINDER: { ar: "قرب انتهاء الاشتراك", en: "Expiring subscription" },
  SERVICE_STATUS: { ar: "صيانة / انقطاع الخدمة", en: "Maintenance / outage" },
  MESSAGE: { ar: "رسالة عامة", en: "General message" },
};

export const CAMPAIGN_AUDIENCES = [
  "ALL",
  "CUSTOMER",
  "ACTIVE_SUBSCRIBERS",
  "EXPIRING",
  "PENDING_ORDERS",
  "AWAITING_PAYMENT",
] as const;

export type CampaignAudience = (typeof CAMPAIGN_AUDIENCES)[number];

export const CAMPAIGN_AUDIENCE_LABELS: Record<CampaignAudience, { ar: string; en: string }> = {
  ALL: { ar: "كل المستخدمين", en: "All users" },
  CUSTOMER: { ar: "عميل محدد", en: "A specific customer" },
  ACTIVE_SUBSCRIBERS: { ar: "المشتركين الفعّالين", en: "Active subscribers" },
  EXPIRING: { ar: "اشتراكات تنتهي خلال 7 أيام", en: "Subscriptions expiring within 7 days" },
  PENDING_ORDERS: { ar: "عندهم طلب مفتوح", en: "Users with an open order" },
  AWAITING_PAYMENT: { ar: "بانتظار الدفع (بدون إثبات)", en: "Awaiting payment (no proof yet)" },
};

export const CAMPAIGN_STATUSES = ["DRAFT", "SCHEDULED", "SENDING", "SENT", "FAILED", "CANCELLED"] as const;

export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, { ar: string; en: string }> = {
  DRAFT: { ar: "مسودة", en: "Draft" },
  SCHEDULED: { ar: "مجدول", en: "Scheduled" },
  SENDING: { ar: "قيد الإرسال", en: "Sending" },
  SENT: { ar: "تم الإرسال", en: "Sent" },
  FAILED: { ar: "فشل", en: "Failed" },
  CANCELLED: { ar: "ملغي", en: "Cancelled" },
};

export function pickEnum<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  const candidate = String(value ?? "").trim().toUpperCase() as T;
  return allowed.includes(candidate) ? candidate : null;
}

// ------------------------------------------------------------ permissions

/**
 * Opening "إشعارات الهواتف" and messaging one customer needs the
 * `notifications` permission; sending to a whole audience also needs
 * `broadcast`. Checked on the server for every action.
 */
export function canSendToAudience(role: unknown, audience: CampaignAudience) {
  if (!hasPermission(role, "notifications")) {
    return false;
  }

  return audience === "CUSTOMER" || hasPermission(role, "broadcast");
}

// --------------------------------------------------------------- audience

export type AudienceUser = { id: number; marketingOptIn: boolean };
export type AudienceSubscription = { userId: number; status: string; expiryDate: string };
export type AudienceOrder = { id: number; userId: number; status: string };

export type AudienceData = {
  users: AudienceUser[];
  subscriptions: AudienceSubscription[];
  orders: AudienceOrder[];
  /** Order ids that already have a payment proof uploaded. */
  ordersWithProof: Set<number>;
};

/**
 * Resolves the recipients of a campaign. Offers only reach customers who
 * opted in to offers (the "marketing" preference on the website and in the
 * app); service and account messages reach everyone in the audience.
 */
export function resolveAudience(
  audience: CampaignAudience,
  type: CampaignType,
  data: AudienceData,
  options: { targetUserId?: number | null; now?: number } = {},
): number[] {
  const now = options.now ?? Date.now();
  const byId = new Map(data.users.map((user) => [user.id, user]));
  let ids: Set<number>;

  switch (audience) {
    case "ALL":
      ids = new Set(data.users.map((user) => user.id));
      break;
    case "CUSTOMER":
      ids = new Set(options.targetUserId && byId.has(options.targetUserId) ? [options.targetUserId] : []);
      break;
    case "ACTIVE_SUBSCRIBERS":
      ids = new Set(
        data.subscriptions
          .filter((subscription) => {
            const state = deriveSubscriptionState(subscription, now);
            return state === "ACTIVE" || state === "EXPIRING";
          })
          .map((subscription) => subscription.userId),
      );
      break;
    case "EXPIRING":
      ids = new Set(
        data.subscriptions
          .filter((subscription) => deriveSubscriptionState(subscription, now) === "EXPIRING")
          .map((subscription) => subscription.userId),
      );
      break;
    case "PENDING_ORDERS":
      ids = new Set(data.orders.filter((order) => isOpen(order.status)).map((order) => order.userId));
      break;
    case "AWAITING_PAYMENT":
      ids = new Set(
        data.orders
          .filter((order) => isUnpaid(order.status) && !data.ordersWithProof.has(order.id))
          .map((order) => order.userId),
      );
      break;
  }

  return [...ids]
    .filter((id) => byId.has(id))
    .filter((id) => type !== "OFFER" || audience === "CUSTOMER" || byId.get(id)!.marketingOptIn)
    .sort((a, b) => a - b);
}

// ---------------------------------------------------------------- devices

export const PUSH_PLATFORMS = ["ANDROID", "IOS"] as const;
export type PushPlatform = (typeof PUSH_PLATFORMS)[number];

/** Expo push tokens: ExponentPushToken[...] or ExpoPushToken[...]. */
export function isExpoPushToken(token: unknown): token is string {
  return typeof token === "string" && /^Expo(nent)?PushToken\[[A-Za-z0-9_\-]{10,200}\]$/.test(token);
}

// --------------------------------------------------------------- messages

export type PushPayloadData = {
  /** In-app notification id, so tapping marks the right record as read. */
  notificationId: number | null;
  type: string;
  /** Internal link; the app parses it into a typed destination. */
  link: string | null;
};

export type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  data: PushPayloadData;
  sound: "default";
  priority: "high" | "default";
  channelId: string;
  richContent?: { image: string };
  mutableContent?: boolean;
};

/** Android notification channels created by the app. */
export function channelFor(type: string) {
  if (type === "OFFER" || type === "ANNOUNCEMENT") return "offers";
  if (type === "SERVICE_STATUS") return "service";
  return "account";
}

export function buildPushMessage(
  token: string,
  notification: { id: number | null; type: string; title: string; body: string; link: string | null; imageUrl?: string | null },
): ExpoPushMessage {
  const message: ExpoPushMessage = {
    to: token,
    title: notification.title.slice(0, 120),
    body: notification.body.slice(0, 600),
    data: { notificationId: notification.id, type: notification.type, link: notification.link },
    sound: "default",
    priority: notification.type === "OFFER" ? "default" : "high",
    channelId: channelFor(notification.type),
  };

  if (notification.imageUrl && /^https:\/\//.test(notification.imageUrl)) {
    message.richContent = { image: notification.imageUrl };
    message.mutableContent = true;
  }

  return message;
}

export function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

/** Push provider errors after which a token will never work again. */
export function isPermanentTokenError(error: unknown) {
  return error === "DeviceNotRegistered";
}
