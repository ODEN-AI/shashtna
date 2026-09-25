import { db } from "@/src/prisma/db";
import { daysRemaining, deriveSubscriptionState } from "@/src/lib/subscription-state";

export type NotificationInput = {
  userId: number;
  type: string;
  title: string;
  body: string;
  link?: string | null;
  /** When set, a notification with the same key is only ever created once. */
  dedupeKey?: string | null;
};

export async function notify(input: NotificationInput) {
  try {
    if (input.dedupeKey) {
      const existing = await db.orm.public.Notification.first({
        dedupeKey: input.dedupeKey,
      });

      if (existing) {
        return existing;
      }
    }

    return await db.orm.public.Notification.create({
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      link: input.link ?? null,
      dedupeKey: input.dedupeKey ?? null,
    });
  } catch (error) {
    console.error("NOTIFY_ERROR:", error);
    return null;
  }
}

export async function listNotifications(userId: number, limit = 30) {
  return db.orm.public.Notification.where({ userId })
    .orderBy((item) => item.createdAt.desc())
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
 * (No WhatsApp/Telegram/push delivery exists yet.)
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
