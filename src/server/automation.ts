import { db } from "@/src/prisma/db";
import {
  REMINDERS,
  canRunHere,
  firstName,
  iraqiWhatsapp,
  isQuietHours,
  reminderConversion,
  reminderDedupeKey,
  reminderFor,
  reminderLink,
  reminderRef,
  reminderSkip,
  renderInAppReminder,
  renderReminder,
  runKey,
  waLink,
  whatsappDedupeKey,
  type Job,
  type Reminder,
} from "@/src/lib/automation";
import { discountAmount, discountBadge } from "@/src/lib/discounts";
import { normalizeOrderStatus } from "@/src/lib/order-status";
import { isFullAccess } from "@/src/lib/system";
import { logActivity } from "@/src/server/activity";
import { activeDiscounts } from "@/src/server/discounts";
import { getLoyaltyRules, missingAwards, reconciliationMismatches } from "@/src/server/loyalty";
import { notify } from "@/src/server/notifications";
import { proofUploadTimes } from "@/src/server/payment-proofs";

/**
 * Automation — database side (phase 4, step 1).
 *
 * The daily list is built from live data every time it is viewed. The daily
 * job (scheduled at 06:00 Baghdad, or "run now" by the owner) only writes the
 * owner's morning summary notification and its run record: it never messages
 * customers. WhatsApp messages are links the owner opens and sends himself;
 * opening one records it once in the outbox so it is never sent twice.
 */

type Actor = { id: number; role: string };
type Fail = { ok: false; status: number; error: string };

const sql = db.raw.sql;
const SITE_URL = (process.env.URL || "https://shashtna.netlify.app").replace(/\/$/, "");

export async function automationSettings() {
  const rows = await db.orm.public.SiteSetting.where((s) => s.key.like("automation.%")).all().toArray().catch(() => []);
  const value = (key: string, fallback: string) => rows.find((row) => row.key === key)?.value ?? fallback;

  return {
    enabled: value("automation.enabled", "off") === "on",
    dryRun: value("automation.dryRun", "off") === "on",
    jobs: {
      "daily-digest": value("automation.job.dailyDigest", "off") === "on",
      "customer-reminders": value("automation.job.customerReminders", "off") === "on",
    } as Record<Job, boolean>,
    quietHours: value("automation.quietHours", "22:00-09:00"),
  };
}

export function databaseHost() {
  try {
    return new URL(process.env.DATABASE_URL ?? "").hostname;
  } catch {
    return "";
  }
}

// ------------------------------------------------------------------- the daily list

export type DueSubscription = {
  subscriptionId: number;
  userId: number;
  customerName: string;
  serviceType: string;
  packageName: string;
  endDate: string;
  reminder: Reminder;
  points: number;
  discountLabel: string | null;
  /** The prefilled wa.me link; null when the stored phone isn't an Iraqi mobile. */
  link: string | null;
  sent: { at: string; status: string } | null;
};

export async function dailyList(now = new Date()) {
  const settings = await automationSettings();
  const [subscriptions, loyaltyRules] = await Promise.all([db.orm.public.Subscription.all(), getLoyaltyRules()]);

  const due = subscriptions
    .filter((row) => ["IPTV", "VIP", "DIGITAL"].includes(String(row.serviceType ?? "IPTV").toUpperCase()))
    .filter((row) => !["SUSPENDED", "CANCELLED"].includes(String(row.status).toUpperCase()))
    .map((row) => ({ row, endDate: String(row.expiryDate).slice(0, 10), reminder: reminderFor(String(row.expiryDate).slice(0, 10), now) }))
    .filter((item): item is typeof item & { reminder: Reminder } => item.reminder !== null);

  const userIds = [...new Set(due.map((item) => item.row.userId))];
  const packageIds = [...new Set(due.map((item) => item.row.packageId).filter((id): id is number => typeof id === "number"))];
  const [users, accounts, options] = await Promise.all([
    userIds.length ? db.orm.public.User.where((u) => u.id.in(userIds)).select("id", "name", "phone").all() : [],
    userIds.length && loyaltyRules.enabled ? db.orm.public.LoyaltyAccount.where((a) => a.userId.in(userIds)).select("userId", "balance").all() : [],
    packageIds.length ? db.orm.public.PackageOption.where((o) => o.packageId.in(packageIds)).where({ isActive: true }).all() : [],
  ]);
  const discounts = await activeDiscounts(options.map((option) => option.id), now);
  const keys = due.map((item) => whatsappDedupeKey(item.reminder, item.row.id, item.endDate));
  const sent = keys.length ? await db.orm.public.OutboxMessage.where((m) => m.dedupeKey.in(keys)).all() : [];
  const sentBy = new Map(sent.map((message) => [message.dedupeKey, { at: String(message.sentAt ?? message.createdAt), status: message.status }]));
  const userOf = new Map(users.map((user) => [user.id, user]));
  const pointsOf = new Map(accounts.map((account) => [account.userId, account.balance]));

  const rows: DueSubscription[] = due.map(({ row, endDate, reminder }) => {
    const user = userOf.get(row.userId);
    // A renewal discount on any length of the subscription's package.
    const option = options.find((item) => item.packageId === row.packageId && discounts.get(item.id)?.appliesToRenewals);
    const rule = option ? discounts.get(option.id) : null;
    const base = option ? (option.renewalPrice ?? option.price) : 0;
    const discountLabel = rule && option ? discountBadge(rule, discountAmount(base, rule), "ar") : null;
    const points = Math.max(0, pointsOf.get(row.userId) ?? 0);
    const number = iraqiWhatsapp(user?.phone);
    const text = renderReminder(reminder, { firstName: firstName(user?.name), packageName: row.packageName, endDate, points, discountLabel, renewUrl: `${SITE_URL}/checkout?renew=${row.id}` });

    return {
      subscriptionId: row.id,
      userId: row.userId,
      customerName: user?.name ?? "—",
      serviceType: String(row.serviceType ?? "IPTV").toUpperCase(),
      packageName: row.packageName,
      endDate,
      reminder,
      points,
      discountLabel,
      link: number ? waLink(number, text) : null,
      sent: sentBy.get(whatsappDedupeKey(reminder, row.id, endDate)) ?? null,
    };
  });

  // ---- orders
  const dayAgo = new Date(now.getTime() - 24 * 3_600_000).toISOString();
  const halfDayAgo = new Date(now.getTime() - 12 * 3_600_000).toISOString();
  const openOrders = await db.orm.public.SubscriptionRequest.where((o) => o.status.in(["SUBMITTED", "AWAITING_PAYMENT", "PENDING", "PAID", "FULFILLING"])).select("id", "userId", "status", "serviceName", "createdAt", "updatedAt").all();
  const unpaid = openOrders.filter((o) => ["SUBMITTED", "AWAITING_PAYMENT"].includes(normalizeOrderStatus(o.status)));
  const proofs = await proofUploadTimes(unpaid.map((o) => o.id));
  const orders = {
    waitingPayment: unpaid.filter((o) => !proofs.has(o.id) && String(o.createdAt) < dayAgo).map((o) => ({ id: o.id, serviceName: o.serviceName, since: String(o.createdAt) })),
    proofsToReview: unpaid.filter((o) => proofs.has(o.id)).map((o) => ({ id: o.id, serviceName: o.serviceName, since: proofs.get(o.id)! })),
    notActivated: openOrders.filter((o) => ["PAID", "FULFILLING"].includes(normalizeOrderStatus(o.status)) && String(o.updatedAt) < halfDayAgo).map((o) => ({ id: o.id, serviceName: o.serviceName, since: String(o.updatedAt) })),
  };

  // ---- health
  const firstPurchase = (await db.orm.public.CreditPurchase.orderBy((p) => p.createdAt.asc()).first())?.createdAt ?? null;
  const unknownCost = firstPurchase
    ? (await db.orm.public.SubscriptionRequest.where({ status: "COMPLETED", channel: "SITE", loyaltyReward: false }).where((o) => o.creditCostIqd.isNull()).where((o) => o.updatedAt.gte(String(firstPurchase))).select("id").all()).length
    : null;
  const [mismatches, missing, lastRun, lastReminders] = await Promise.all([
    reconciliationMismatches().then((rows) => rows.length).catch(() => null),
    missingAwards().then((rows) => rows.length).catch(() => null),
    db.orm.public.AutomationRun.where({ job: "daily-digest" }).orderBy((r) => r.startedAt.desc()).first(),
    db.orm.public.AutomationRun.where({ runKey: runKey("customer-reminders", now) }).first(),
  ]);
  const todayKey = runKey("daily-digest", now);

  return {
    generatedAt: now.toISOString(),
    quietHours: isQuietHours(settings.quietHours, now),
    settings,
    subscriptions: rows,
    orders,
    health: {
      unknownCost,
      mismatches,
      missingAwards: missing,
      lastRun: lastRun ? { runKey: lastRun.runKey, status: lastRun.status, startedAt: String(lastRun.startedAt), error: lastRun.error ?? null } : null,
      ranToday: lastRun?.runKey === todayKey && lastRun.status === "SUCCEEDED",
      remindersRanToday: lastReminders?.status === "SUCCEEDED",
    },
  };
}

export type DailyList = Awaited<ReturnType<typeof dailyList>>;

// ------------------------------------------------------------------- WhatsApp outbox

/**
 * The owner opened a prefilled WhatsApp link: record it once (by its dedupe
 * key) so the row shows «أُرسلت». In dry run it is recorded as SKIPPED.
 * The payload never carries the phone number or any credential.
 */
export async function markWhatsAppOpened(actor: Actor, subscriptionId: number, template: Reminder, now = new Date()): Promise<{ ok: true; created: boolean } | Fail> {
  if (!isFullAccess(actor.role)) return { ok: false, status: 403, error: "إرسال رسائل الواتساب للمالك فقط." };

  const sub = await db.orm.public.Subscription.first({ id: subscriptionId });

  if (!sub) return { ok: false, status: 404, error: "الاشتراك غير موجود." };

  const endDate = String(sub.expiryDate).slice(0, 10);

  if (reminderFor(endDate, now) !== template) return { ok: false, status: 409, error: "هذي الرسالة مو مستحقة اليوم. حدّث الصفحة." };

  const settings = await automationSettings();
  const key = whatsappDedupeKey(template, sub.id, endDate);
  const nowIso = now.toISOString();
  const rows = await db
    .runtime()
    .query(
      sql`INSERT INTO "public"."outboxMessage" ("channel", "template", "userId", "payload", "dedupeKey", "status", "attempts", "sentAt", "sentBy")
        VALUES ('WHATSAPP_LINK', ${template}, ${sub.userId}, ${JSON.stringify({ subscriptionId: sub.id, endDate })}, ${key}, ${settings.dryRun ? "SKIPPED" : "SENT"}, 1, ${nowIso}::timestamptz, ${actor.id})
        ON CONFLICT ("dedupeKey") DO NOTHING RETURNING "id"`
        .returnsRow({ id: "pg/int4@1" })
        .build(),
    )
    .toArray();

  return { ok: true, created: rows.length > 0 };
}

// ------------------------------------------------------------------- the job runner

export type RunResult = { ok: true; status: "SUCCEEDED" | "SKIPPED" | "FAILED"; runKey: string; reason?: string; stats?: Record<string, unknown> } | Fail;

/**
 * Runs a job once per Baghdad day. Guards, in order: allowed here (production
 * or a local database), automation on, the job on, a Postgres advisory lock,
 * then the AutomationRun row inserted by runKey BEFORE any work — so a second
 * trigger the same day is a no-op.
 */
export async function runJob(job: Job, options: { trigger: "SCHEDULE" | "MANUAL"; actor?: Actor; now?: Date } = { trigger: "SCHEDULE" }): Promise<RunResult> {
  const now = options.now ?? new Date();
  const key = runKey(job, now);

  if (options.trigger === "MANUAL" && (!options.actor || !isFullAccess(options.actor.role))) return { ok: false, status: 403, error: "التشغيل اليدوي للمالك فقط." };
  if (!canRunHere({ CONTEXT: process.env.SHASHTNA_DEPLOY_CONTEXT || process.env.CONTEXT }, databaseHost())) return { ok: true, status: "SKIPPED", runKey: key, reason: "NOT_PRODUCTION" };

  const settings = await automationSettings();

  if (!settings.enabled) return { ok: true, status: "SKIPPED", runKey: key, reason: "AUTOMATION_OFF" };
  if (!settings.jobs[job]) return { ok: true, status: "SKIPPED", runKey: key, reason: "JOB_OFF" };

  const claimed = await db.transaction(async (tx) => {
    const lock = await tx.query(sql`SELECT pg_try_advisory_xact_lock(hashtext(${`automation:${job}`})) AS "locked"`.returnsRow({ locked: "pg/bool@1" }).build()).toArray();

    if (!lock[0]?.locked) return { id: null, reason: "BUSY" };

    const inserted = await tx
      .query(
        sql`INSERT INTO "public"."automationRun" ("job", "runKey", "status", "attempts", "trigger", "startedAt")
          VALUES (${job}, ${key}, 'RUNNING', 1, ${options.trigger}, now())
          ON CONFLICT ("runKey") DO NOTHING RETURNING "id"`
          .returnsRow({ id: "pg/int4@1" })
          .build(),
      )
      .toArray();

    return { id: inserted[0]?.id ?? null, reason: "DUPLICATE" };
  });

  if (claimed.id === null) return { ok: true, status: "SKIPPED", runKey: key, reason: claimed.reason };

  try {
    const stats: Record<string, unknown> = job === "customer-reminders" ? await customerReminders(now, settings.dryRun) : await dailyDigest(now, settings.dryRun);
    const summary =
      job === "customer-reminders"
        ? `تشغيل ${job}: ${stats.created} تذكير من ${stats.due} مستحق`
        : `تشغيل ${job}: ${stats.subscriptions} اشتراك، ${stats.orders} طلب`;

    await db.orm.public.AutomationRun.where({ id: claimed.id }).update({ status: "SUCCEEDED", stats: JSON.stringify(stats), finishedAt: new Date().toISOString() });
    await logActivity({ actor: options.actor ?? null, entityType: "SETTING", action: "AUTOMATION_RUN", summary: `${summary}${settings.dryRun ? " (تجريبي)" : ""}`, details: JSON.stringify({ runKey: key, ...stats }) });

    return { ok: true, status: "SUCCEEDED", runKey: key, stats };
  } catch (error) {
    // The error text, never customer data.
    const message = error instanceof Error ? error.message.slice(0, 300) : "unknown";

    await db.orm.public.AutomationRun.where({ id: claimed.id }).update({ status: "FAILED", error: message, finishedAt: new Date().toISOString() });
    await logActivity({ actor: options.actor ?? null, entityType: "SETTING", action: "AUTOMATION_RUN_FAILED", summary: `فشل تشغيل ${job}`, details: JSON.stringify({ runKey: key, error: message }) });

    return { ok: true, status: "FAILED", runKey: key, reason: message };
  }
}

/** Job 1: count the day's list and tell the owner (full-access staff) in one notification per day. */
async function dailyDigest(now: Date, dryRun: boolean) {
  const list = await dailyList(now);
  const stats = {
    subscriptions: list.subscriptions.length,
    beforeExpiry: list.subscriptions.filter((row) => row.reminder === "before-expiry").length,
    expiryDay: list.subscriptions.filter((row) => row.reminder === "expiry-day").length,
    winBack: list.subscriptions.filter((row) => row.reminder === "win-back").length,
    orders: list.orders.waitingPayment.length + list.orders.proofsToReview.length + list.orders.notActivated.length,
    health: Number(Boolean(list.health.unknownCost)) + Number(Boolean(list.health.mismatches)) + Number(Boolean(list.health.missingAwards)),
    notified: 0,
    dryRun,
  };

  if (!dryRun) {
    const staff = (await db.orm.public.User.select("id", "role").all()).filter((user) => isFullAccess(user.role));
    const day = runKey("daily-digest", now).split(":")[1];

    for (const user of staff) {
      const created = await notify({
        userId: user.id,
        type: "DAILY_DIGEST",
        title: "قائمة اليوم جاهزة",
        body: `${stats.subscriptions} اشتراك يحتاج تواصل (${stats.beforeExpiry} قبل الانتهاء، ${stats.expiryDay} اليوم، ${stats.winBack} للرجوع)، و${stats.orders} طلب يحتاج متابعة.`,
        link: "/admin/today",
        dedupeKey: `daily-digest:${day}:${user.id}`,
      });
      if (created) stats.notified += 1;
    }
  }

  return stats;
}

// ------------------------------------------------------------------- job 2: in-app customer reminders (step 2)

const CUSTOMER_SERVICES = ["IPTV", "VIP", "DIGITAL"];
const UNPAID = ["SUBMITTED", "AWAITING_PAYMENT"];
const BATCH = 50;

function serviceOf(row: { serviceType: string | null }) {
  return String(row.serviceType ?? "IPTV").toUpperCase();
}

/**
 * Job 2: an in-app notification for each customer whose subscription ends in
 * 5 days, today, or ended 3 days ago (Baghdad days). Each is written to the
 * outbox first (unique reminder:{template}:{subId}:{endDate}), so a repeat
 * run, or a run on another day for the same cycle, never sends it twice.
 * Dry run records SKIPPED outbox rows (under a dry-run key) and creates
 * nothing for the customer.
 * CODE deliveries have no subscription and so get no reminder.
 */
async function customerReminders(now: Date, dryRun: boolean) {
  const [subscriptions, loyaltyRules] = await Promise.all([db.orm.public.Subscription.all(), getLoyaltyRules()]);
  const due = subscriptions
    .filter((row) => CUSTOMER_SERVICES.includes(serviceOf(row)))
    .map((row) => ({ row, endDate: String(row.expiryDate).slice(0, 10), reminder: reminderFor(String(row.expiryDate).slice(0, 10), now) }))
    .filter((item): item is typeof item & { reminder: Reminder } => item.reminder !== null);
  const stats = { due: due.length, recorded: 0, created: 0, alreadyRecorded: 0, openOrders: 0, skipped: { SUSPENDED: 0, OPTED_OUT: 0 }, dryRun };

  if (!due.length) return stats;

  const subIds = due.map((item) => item.row.id);
  const userIds = [...new Set(due.map((item) => item.row.userId))];
  const [users, orders, accounts] = await Promise.all([
    db.orm.public.User.where((u) => u.id.in(userIds)).select("id", "renewalReminders").all(),
    db.orm.public.SubscriptionRequest.where((o) => o.subscriptionId.in(subIds)).where({ loyaltyReward: false }).select("id", "subscriptionId", "status", "requestType", "packageOptionId").all(),
    loyaltyRules.enabled ? db.orm.public.LoyaltyAccount.where((a) => a.userId.in(userIds)).select("userId", "balance", "status").all() : [],
  ]);
  const remindersOn = new Map(users.map((user) => [user.id, user.renewalReminders !== false]));
  const points = new Map(accounts.filter((account) => account.status === "ACTIVE").map((account) => [account.userId, Math.max(0, account.balance)]));
  // An open unpaid renewal of this subscription: the reminder points to it instead of a new checkout.
  const openOrder = new Map<number, number>();
  // The length the customer last bought or renewed this subscription with.
  const lastOption = new Map<number, number>();

  for (const order of [...orders].sort((a, b) => a.id - b.id)) {
    const status = normalizeOrderStatus(order.status);

    if (order.subscriptionId === null || order.subscriptionId === undefined) continue;
    if (order.requestType === "RENEW" && UNPAID.includes(status)) openOrder.set(order.subscriptionId, order.id);
    if (status === "COMPLETED" && order.packageOptionId) lastOption.set(order.subscriptionId, order.packageOptionId);
  }

  const optionIds = [...new Set(lastOption.values())];
  const activeOptions = optionIds.length ? await db.orm.public.PackageOption.where((o) => o.id.in(optionIds)).where({ isActive: true }).all() : [];
  const optionById = new Map(activeOptions.map((option) => [option.id, option]));
  const discounts = await activeDiscounts(activeOptions.map((option) => option.id), now);

  for (let start = 0; start < due.length; start += BATCH) {
    for (const { row, endDate, reminder } of due.slice(start, start + BATCH)) {
      const skip = reminderSkip({ status: row.status, remindersOn: remindersOn.get(row.userId) ?? true });

      if (skip) {
        stats.skipped[skip] += 1;
        continue;
      }

      // A dry run records under its own per-day key, so it never blocks the real reminder of that cycle.
      const key = dryRun ? `dryrun:${runKey("customer-reminders", now)}:${reminderDedupeKey(reminder, row.id, endDate)}` : reminderDedupeKey(reminder, row.id, endDate);
      const inserted = await db
        .runtime()
        .query(
          sql`INSERT INTO "public"."outboxMessage" ("channel", "template", "userId", "payload", "dedupeKey", "status", "attempts")
            VALUES ('IN_APP', ${reminder}, ${row.userId}, ${JSON.stringify({ subscriptionId: row.id, endDate })}, ${key}, ${dryRun ? "SKIPPED" : "PENDING"}, 0)
            ON CONFLICT ("dedupeKey") DO NOTHING RETURNING "id"`
            .returnsRow({ id: "pg/int4@1" })
            .build(),
        )
        .toArray();
      const outboxId = inserted[0]?.id;

      if (!outboxId) {
        stats.alreadyRecorded += 1;
        continue;
      }

      stats.recorded += 1;

      if (dryRun) continue;

      const optionId = lastOption.get(row.id);
      const option = optionId ? optionById.get(optionId) : undefined;
      const rule = option ? discounts.get(option.id) : null;
      const discountLabel = rule && option && rule.appliesToRenewals ? discountBadge(rule, discountAmount(option.renewalPrice ?? option.price, rule), "ar") : null;
      const discountLabelEn = rule && option && rule.appliesToRenewals ? discountBadge(rule, discountAmount(option.renewalPrice ?? option.price, rule), "en") : null;
      const openOrderId = openOrder.get(row.id) ?? null;
      const data = { packageName: row.packageName, endDate, points: points.get(row.userId) ?? 0, discountLabel, openOrder: Boolean(openOrderId) };
      const ar = renderInAppReminder(reminder, data, "ar");
      const en = renderInAppReminder(reminder, { ...data, discountLabel: discountLabelEn }, "en");
      const link = reminderLink({ subscriptionId: row.id, optionId: option?.id ?? null, outboxId, openOrderId });

      if (openOrderId) stats.openOrders += 1;

      await notify({ userId: row.userId, type: reminder === "win-back" ? "SUBSCRIPTION_EXPIRED" : "RENEWAL_REMINDER", title: ar.title, body: ar.body, link, dedupeKey: key });
      // The whole event is kept for push (Chapter 2): template, link and both languages; no phone or credentials.
      await db.orm.public.OutboxMessage.where({ id: outboxId }).update({
        status: "SENT",
        attempts: 1,
        sentAt: new Date().toISOString(),
        payload: JSON.stringify({ subscriptionId: row.id, endDate, link, openOrderId, pushEligible: true, ar, en }),
      });
      stats.created += 1;
    }
  }

  return stats;
}

/**
 * A RENEW order created from a reminder link (?r=outboxId) is tagged with it.
 * Only an in-app reminder that was sent to this customer, for this order's
 * subscription, counts; anything else (a forged or stale r) is ignored.
 */
export async function linkReminderToOrder(userId: number, orderId: number, value: unknown) {
  const outboxId = reminderRef(value);

  if (!outboxId) return false;

  const [message, order] = await Promise.all([db.orm.public.OutboxMessage.first({ id: outboxId }), db.orm.public.SubscriptionRequest.first({ id: orderId })]);

  if (!message || !order || message.channel !== "IN_APP" || message.status !== "SENT" || message.userId !== userId) return false;
  if (order.userId !== userId || order.requestType !== "RENEW" || order.reminderOutboxId) return false;

  const payload = (() => {
    try {
      return JSON.parse(message.payload) as { subscriptionId?: number };
    } catch {
      return {};
    }
  })();

  if (!order.subscriptionId || payload.subscriptionId !== order.subscriptionId) return false;

  await db.orm.public.SubscriptionRequest.where({ id: orderId }).update({ reminderOutboxId: outboxId });

  return true;
}

/** Reminders → renewals over the last `days` days. Counts only: no names, phones or order details. */
export async function reminderReport(days: number, now = new Date()) {
  const since = new Date(now.getTime() - days * 86_400_000).toISOString();
  const [messages, fromReminder, renewals] = await Promise.all([
    db.orm.public.OutboxMessage.where({ channel: "IN_APP", status: "SENT" }).where((m) => m.sentAt.gte(since)).select("template").all(),
    db.orm.public.SubscriptionRequest.where((o) => o.reminderOutboxId.isNotNull()).where((o) => o.createdAt.gte(since)).select("status").all(),
    db.orm.public.SubscriptionRequest.where({ requestType: "RENEW", loyaltyReward: false, channel: "SITE" }).where((o) => o.reminderOutboxId.isNull()).where((o) => o.updatedAt.gte(since)).select("status").all(),
  ]);
  const sent = Object.fromEntries(REMINDERS.map((template) => [template, messages.filter((message) => message.template === template).length])) as Record<Reminder, number>;

  return {
    days,
    ...reminderConversion({
      sent,
      started: fromReminder.length,
      completed: fromReminder.filter((order) => normalizeOrderStatus(order.status) === "COMPLETED").length,
      completedWithout: renewals.filter((order) => normalizeOrderStatus(order.status) === "COMPLETED").length,
    }),
  };
}

/** The in-app reminders job owns customer reminders when it is switched on (the dashboard's on-visit reminders then stay quiet). */
export async function customerRemindersOn() {
  const settings = await automationSettings();

  return settings.enabled && settings.jobs["customer-reminders"];
}
