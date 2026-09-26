import { db } from "@/src/prisma/db";
import { safeNotificationLink } from "@/src/lib/destinations";
import { daysRemaining, deriveSubscriptionState } from "@/src/lib/subscription-state";
import { pushNotifications } from "@/src/server/push";

export type NotificationInput = {
  userId: number;
  type: string;
  title: string;
  body: string;
  link?: string | null;
  /** When set, a notification with the same key is only ever created once. */
  dedupeKey?: string | null;
  imageUrl?: string | null;
  campaignId?: number | null;
};

/**
 * Records an in-app notification (shown on the website and in the mobile
 * app) and pushes it to the customer's phones. The same record backs both.
 * A notification that already exists for the dedupe key is not re-sent.
 */
export async function notify(input: NotificationInput, options: { push?: boolean } = {}) {
  try {
    if (input.dedupeKey) {
      const existing = await db.orm.public.Notification.first({
        dedupeKey: input.dedupeKey,
      });

      if (existing) {
        return existing;
      }
    }

    const created = await db.orm.public.Notification.create({
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      // Only known internal destinations are stored, so the app can always
      // map a link to a screen.
      link: safeNotificationLink(input.link),
      dedupeKey: input.dedupeKey ?? null,
      imageUrl: input.imageUrl ?? null,
      campaignId: input.campaignId ?? null,
    });

    if (options.push !== false) {
      await pushNotifications([created]).catch((error) => {
        console.error("NOTIFY_PUSH_ERROR:", error instanceof Error ? error.message : error);
      });
    }

    return created;
  } catch (error) {
    console.error("NOTIFY_ERROR:", error);
    return null;
  }
}

export async function listNotifications(userId: number, limit = 30, beforeId?: number) {
  const scope = db.orm.public.Notification.where({ userId });

  return (beforeId ? scope.where((item) => item.id.lt(beforeId)) : scope)
    .orderBy((item) => item.id.desc())
    .limit(limit)
    .all();
}

export async function countUnreadNotifications(userId: number) {
  const result = await db.orm.public.Notification.where({ userId })
    .where((item) => item.readAt.isNull())
    .aggregate((aggregate) => ({ unread: aggregate.count() }));

  return result.unread;
}

export async function markNotificationsRead(userId: number, id?: number) {
  const now = new Date().toISOString();
  const scope = db.orm.public.Notification.where({ userId }).where((item) =>
    item.readAt.isNull(),
  );

  await (id ? scope.where({ id }) : scope).updateAll({ readAt: now });
}

/**
 * In-app renewal reminders. Runs when the customer opens My Shashtna: one
 * reminder per subscription per expiry date when it enters the 7-day window,
 * and one when it expires. Respects the customer's reminder preference.
 * Also run for every customer by the scheduled job (/api/cron/push), so the
 * reminder reaches the phone even when the customer does not open the site.
 */
export async function ensureRenewalReminders(
  userId: number,
  subscriptions: { id: number; status: string; expiryDate: string; packageName: string }[],
  enabled: boolean,
) {
  if (!enabled) {
    return;
  }

  for (const subscription of subscriptions) {
    const state = deriveSubscriptionState(subscription);
    const expiryDay = String(subscription.expiryDate).slice(0, 10);

    if (state === "EXPIRING") {
      const days = daysRemaining(subscription.expiryDate);

      await notify({
        userId,
        type: "RENEWAL_REMINDER",
        title: "اشتراكك ينتهي قريبًا",
        body: `اشتراك «${subscription.packageName}» ينتهي خلال ${days} ${days === 1 ? "يوم" : "أيام"}. جدّده حتى تستمر المشاهدة بدون انقطاع.`,
        link: `/subscriptions/${subscription.id}`,
        dedupeKey: `renewal:${subscription.id}:${expiryDay}:expiring`,
      });
    }

    if (state === "EXPIRED") {
      await notify({
        userId,
        type: "SUBSCRIPTION_EXPIRED",
        title: "انتهى اشتراكك",
        body: `انتهى اشتراك «${subscription.packageName}». تكدر تعيد تفعيله من صفحة الاشتراك.`,
        link: `/subscriptions/${subscription.id}`,
        dedupeKey: `renewal:${subscription.id}:${expiryDay}:expired`,
      });
    }
  }
}
