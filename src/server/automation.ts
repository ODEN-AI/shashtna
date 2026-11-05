import { db } from "@/src/prisma/db";
import {
  JOBS,
  MAX_ATTEMPTS,
  REMINDERS,
  appendError,
  canRunHere,
  firstName,
  iraqiWhatsapp,
  isQuietHours,
  missedJobs,
  nextRetryAt,
  outboxDue,
  reminderConversion,
  reminderDedupeKey,
  reminderFor,
  reminderLink,
  reminderRef,
  reminderSkip,
  renderInAppReminder,
  renderReminder,
  runDecision,
  runKey,
  safeError,
  waLink,
  whatsappDedupeKey,
  type Job,
  type Trigger,
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
  const changedAt = (key: string) => {
    const at = rows.find((row) => row.key === key)?.updatedAt;
    return at ? String(at) : null;
  };
  // When a job last became able to run: the later of its own switch and the master switch.
  const switchedOnAt = (key: string) => [changedAt("automation.enabled"), changedAt(key)].filter((at): at is string => Boolean(at)).sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null;

  return {
    enabled: value("automation.enabled", "off") === "on",
    dryRun: value("automation.dryRun", "off") === "on",
    jobs: {
      "daily-digest": value("automation.job.dailyDigest", "off") === "on",
      "customer-reminders": value("automation.job.customerReminders", "off") === "on",
    } as Record<Job, boolean>,
    quietHours: value("automation.quietHours", "22:00-09:00"),
    switchedOnAt: {
      "daily-digest": switchedOnAt("automation.job.dailyDigest"),
      "customer-reminders": switchedOnAt("automation.job.customerReminders"),
    } as Record<Job, string | null>,
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
      // The 09:00 heartbeat: switched-on jobs with no SUCCEEDED run today.
      missed: missedJobs(
        {
          enabled: settings.enabled,
          jobs: settings.jobs,
          succeededToday: [lastRun?.runKey === todayKey && lastRun.status === "SUCCEEDED" ? "daily-digest" : null, lastReminders?.status === "SUCCEEDED" ? "customer-reminders" : null].filter((job): job is Job => job !== null),
          switchedOnAt: settings.switchedOnAt,
        },
        now,
      ),
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

export type RunResult =
  | { ok: true; status: "SUCCEEDED" | "SKIPPED" | "FAILED"; runKey: string; reason?: string; stats?: Record<string, unknown>; retryAt?: string | null; attempt?: number }
  | Fail;

/**
 * Runs a job once per Baghdad day. Guards, in order: allowed here (production
 * or a local database), automation on, the job on, a Postgres advisory lock,
 * then the AutomationRun row inserted by runKey BEFORE any work — so a second
 * trigger the same day is a no-op.
 */
export async function runJob(job: Job, options: { trigger: Trigger; actor?: Actor; now?: Date } = { trigger: "SCHEDULE" }): Promise<RunResult> {
  const now = options.now ?? new Date();
  const clock = () => options.now ?? new Date();
  const key = runKey(job, now);

  if (options.trigger === "MANUAL" && (!options.actor || !isFullAccess(options.actor.role))) return { ok: false, status: 403, error: "التشغيل اليدوي للمالك فقط." };
  if (!canRunHere({ CONTEXT: process.env.SHASHTNA_DEPLOY_CONTEXT || process.env.CONTEXT }, databaseHost())) return { ok: true, status: "SKIPPED", runKey: key, reason: "NOT_PRODUCTION" };

  const settings = await automationSettings();

  if (!settings.enabled) return { ok: true, status: "SKIPPED", runKey: key, reason: "AUTOMATION_OFF" };
  if (!settings.jobs[job]) return { ok: true, status: "SKIPPED", runKey: key, reason: "JOB_OFF" };

  // Claim today's row under the job's lock: insert it, or re-claim a FAILED
  // (or cut-off RUNNING) one with attempts + 1. A SUCCEEDED run is never re-run.
  const claimed = await db.transaction(async (tx) => {
    const lock = await tx.query(sql`SELECT pg_try_advisory_xact_lock(hashtext(${`automation:${job}`})) AS "locked"`.returnsRow({ locked: "pg/bool@1" }).build()).toArray();

    if (!lock[0]?.locked) return { id: null, attempt: 0, reason: "BUSY", reclaimed: false };

    const rows = await tx
      .query(
        sql`SELECT "id", "status", "attempts",
            to_char("startedAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "startedAt",
            COALESCE(to_char("nextAttemptAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), '') AS "nextAttemptAt"
          FROM "public"."automationRun" WHERE "runKey" = ${key}`
          .returnsRow({ id: "pg/int4@1", status: "pg/text@1", attempts: "pg/int4@1", startedAt: "pg/text@1", nextAttemptAt: "pg/text@1" })
          .build(),
      )
      .toArray();
    const row = rows[0] ? { ...rows[0], nextAttemptAt: rows[0].nextAttemptAt || null } : null;
    const decision = runDecision(row, now, options.trigger === "MANUAL");

    if (decision === "NEW") {
      const inserted = await tx
        .query(
          sql`INSERT INTO "public"."automationRun" ("job", "runKey", "status", "attempts", "trigger", "startedAt")
            VALUES (${job}, ${key}, 'RUNNING', 1, ${options.trigger}, ${now.toISOString()}::timestamptz)
            ON CONFLICT ("runKey") DO NOTHING RETURNING "id"`
            .returnsRow({ id: "pg/int4@1" })
            .build(),
        )
        .toArray();

      return { id: inserted[0]?.id ?? null, attempt: 1, reason: "DUPLICATE", reclaimed: false };
    }

    if (decision === "EXPIRE") {
      await tx
        .query(
          sql`UPDATE "public"."automationRun"
            SET "status" = 'FAILED', "error" = 'cut off before finishing', "nextAttemptAt" = NULL, "finishedAt" = ${now.toISOString()}::timestamptz
            WHERE "id" = ${row!.id} RETURNING "id"`
            .returnsRow({ id: "pg/int4@1" })
            .build(),
        )
        .toArray();

      return { id: null, attempt: row!.attempts, reason: "GAVE_UP", reclaimed: false, expiredId: row!.id };
    }

    if (decision === "RETRY" || decision === "RECLAIM") {
      const updated = await tx
        .query(
          sql`UPDATE "public"."automationRun"
            SET "status" = 'RUNNING', "attempts" = "attempts" + 1, "trigger" = ${options.trigger},
                "startedAt" = ${now.toISOString()}::timestamptz, "finishedAt" = NULL, "nextAttemptAt" = NULL
            WHERE "id" = ${row!.id} RETURNING "id", "attempts"`
            .returnsRow({ id: "pg/int4@1", attempts: "pg/int4@1" })
            .build(),
        )
        .toArray();

      return { id: updated[0]?.id ?? null, attempt: updated[0]?.attempts ?? 0, reason: decision, reclaimed: decision === "RECLAIM" };
    }

    return { id: null, attempt: row?.attempts ?? 0, reason: { DONE: "DUPLICATE", BUSY: "BUSY", WAIT: "RETRY_LATER", GAVE_UP: "GAVE_UP" }[decision], reclaimed: false };
  });

  if ("expiredId" in claimed && claimed.expiredId) {
    const previous = await db.orm.public.AutomationRun.first({ id: claimed.expiredId });
    await db.orm.public.AutomationRun.where({ id: claimed.expiredId }).update({ errorLog: appendError(previous?.errorLog, { attempt: claimed.attempt, at: clock().toISOString(), error: "cut off before finishing" }) });
    await logActivity({ actor: options.actor ?? null, entityType: "SETTING", action: "AUTOMATION_RUN_FAILED", summary: `فشل تشغيل ${job} نهائياً: انقطعت المحاولة ${claimed.attempt}`, details: JSON.stringify({ runKey: key, attempt: claimed.attempt, error: "cut off before finishing" }) });
  }

  if (claimed.id === null) return { ok: true, status: "SKIPPED", runKey: key, reason: claimed.reason };

  if (claimed.attempt > 1) {
    if (claimed.reclaimed) {
      const previous = await db.orm.public.AutomationRun.first({ id: claimed.id });
      await db.orm.public.AutomationRun.where({ id: claimed.id }).update({ errorLog: appendError(previous?.errorLog, { attempt: claimed.attempt - 1, at: clock().toISOString(), error: "cut off before finishing" }) });
    }
    await logActivity({ actor: options.actor ?? null, entityType: "SETTING", action: "AUTOMATION_RETRY", summary: `إعادة محاولة ${job} (المحاولة ${claimed.attempt})`, details: JSON.stringify({ runKey: key, attempt: claimed.attempt, trigger: options.trigger }) });
  }

  try {
    const stats: Record<string, unknown> = job === "customer-reminders" ? await customerReminders(now, settings.dryRun) : await dailyDigest(now, settings.dryRun);
    const summary =
      job === "customer-reminders"
        ? `تشغيل ${job}: ${stats.created} تذكير من ${stats.due} مستحق`
        : `تشغيل ${job}: ${stats.subscriptions} اشتراك، ${stats.orders} طلب`;

    await db.orm.public.AutomationRun.where({ id: claimed.id }).update({ status: "SUCCEEDED", stats: JSON.stringify(stats), finishedAt: clock().toISOString(), nextAttemptAt: null });
    await logActivity({ actor: options.actor ?? null, entityType: "SETTING", action: "AUTOMATION_RUN", summary: `${summary}${settings.dryRun ? " (تجريبي)" : ""}`, details: JSON.stringify({ runKey: key, attempt: claimed.attempt, trigger: options.trigger, ...stats }) });

    return { ok: true, status: "SUCCEEDED", runKey: key, stats };
  } catch (error) {
    // The error text, never customer data.
    const message = safeError(error instanceof Error ? error.message : "unknown");
    const failedAt = clock();
    const retryAt = nextRetryAt(claimed.attempt, failedAt);
    const previous = await db.orm.public.AutomationRun.first({ id: claimed.id });

    await db.orm.public.AutomationRun.where({ id: claimed.id }).update({
      status: "FAILED",
      error: message,
      errorLog: appendError(previous?.errorLog, { attempt: claimed.attempt, at: failedAt.toISOString(), error: message }),
      nextAttemptAt: retryAt?.toISOString() ?? null,
      finishedAt: failedAt.toISOString(),
    });
    await logActivity({
      actor: options.actor ?? null,
      entityType: "SETTING",
      action: "AUTOMATION_RUN_FAILED",
      summary: retryAt ? `فشل تشغيل ${job} (المحاولة ${claimed.attempt}، إعادة تلقائية لاحقاً)` : `فشل تشغيل ${job} نهائياً بعد ${claimed.attempt} محاولات`,
      details: JSON.stringify({ runKey: key, attempt: claimed.attempt, error: message, retryAt: retryAt?.toISOString() ?? null }),
    });

    return { ok: true, status: "FAILED", runKey: key, reason: message, retryAt: retryAt?.toISOString() ?? null, attempt: claimed.attempt };
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

    const notification = {
      type: "DAILY_DIGEST",
      title: "قائمة اليوم جاهزة",
      body: `${stats.subscriptions} اشتراك يحتاج تواصل (${stats.beforeExpiry} قبل الانتهاء، ${stats.expiryDay} اليوم، ${stats.winBack} للرجوع)، و${stats.orders} طلب يحتاج متابعة.`,
      link: "/admin/today",
    };

    // Through the outbox, so a failed notification is retried (and never sent twice).
    for (const user of staff) {
      const outboxId = await enqueueInApp({ template: "daily-digest", userId: user.id, dedupeKey: `daily-digest:${day}:${user.id}`, payload: { notification } });

      if (outboxId && (await deliverOutbox(outboxId, now)).delivered) stats.notified += 1;
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
  const stats = { due: due.length, recorded: 0, created: 0, failed: 0, alreadyRecorded: 0, openOrders: 0, skipped: { SUSPENDED: 0, OPTED_OUT: 0 }, dryRun };

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

      if (await db.orm.public.OutboxMessage.first({ dedupeKey: key })) {
        stats.alreadyRecorded += 1;
        continue;
      }

      // The link carries the row's own id (?r=), so take the id first and write the row
      // with its whole payload in one statement: a run cut off mid-way never leaves a
      // row the outbox retries can't deliver.
      const reserved = await db
        .runtime()
        .query(sql`SELECT nextval(pg_get_serial_sequence('"public"."outboxMessage"', 'id'))::int4 AS "id"`.returnsRow({ id: "pg/int4@1" }).build())
        .toArray();
      const outboxId = reserved[0]!.id;
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

      // The whole event is kept for push (Chapter 2): template, link and both languages; no phone or credentials.
      const notification = { type: reminder === "win-back" ? "SUBSCRIPTION_EXPIRED" : "RENEWAL_REMINDER", title: ar.title, body: ar.body, link };
      const inserted = await db
        .runtime()
        .query(
          sql`INSERT INTO "public"."outboxMessage" ("id", "channel", "template", "userId", "payload", "dedupeKey", "status", "attempts")
            VALUES (${outboxId}, 'IN_APP', ${reminder}, ${row.userId}, ${JSON.stringify({ subscriptionId: row.id, endDate, link, openOrderId, pushEligible: true, ar, en, notification })}, ${key}, ${dryRun ? "SKIPPED" : "PENDING"}, 0)
            ON CONFLICT ("dedupeKey") DO NOTHING RETURNING "id"`
            .returnsRow({ id: "pg/int4@1" })
            .build(),
        )
        .toArray();

      if (!inserted[0]) {
        stats.alreadyRecorded += 1;
        continue;
      }

      stats.recorded += 1;

      if (dryRun) continue;
      if (openOrderId) stats.openOrders += 1;

      if ((await deliverOutbox(outboxId, now)).delivered) stats.created += 1;
      else stats.failed += 1;
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

// ------------------------------------------------------------------- outbox delivery and retries (step 3)

type InAppPayload = { notification?: { type: string; title: string; body: string; link?: string | null } };

/** Records an in-app message once by its dedupe key; returns the new row's id, or null when it was already there. */
async function enqueueInApp(input: { template: string; userId: number; dedupeKey: string; payload: InAppPayload & Record<string, unknown> }) {
  const rows = await db
    .runtime()
    .query(
      sql`INSERT INTO "public"."outboxMessage" ("channel", "template", "userId", "payload", "dedupeKey", "status", "attempts")
        VALUES ('IN_APP', ${input.template}, ${input.userId}, ${JSON.stringify(input.payload)}, ${input.dedupeKey}, 'PENDING', 0)
        ON CONFLICT ("dedupeKey") DO NOTHING RETURNING "id"`
        .returnsRow({ id: "pg/int4@1" })
        .build(),
    )
    .toArray();

  return rows[0]?.id ?? null;
}

/**
 * Delivers one in-app outbox row: creates its notification under the row's
 * dedupe key (an existing one is reused, so a retry never duplicates) and
 * marks it SENT. A failure counts an attempt and schedules the next one with
 * backoff; after MAX_ATTEMPTS it stays FAILED for good.
 */
export async function deliverOutbox(id: number, now = new Date()) {
  const row = await db.orm.public.OutboxMessage.first({ id });

  if (!row || row.channel !== "IN_APP" || row.status === "SENT" || row.status === "SKIPPED") return { delivered: false, reason: "NOT_DELIVERABLE" as const };

  const payload = (() => {
    try {
      return JSON.parse(row.payload) as InAppPayload;
    } catch {
      return {} as InAppPayload;
    }
  })();
  const attempt = row.attempts + 1;
  const note = payload.notification && row.userId ? await notify({ userId: row.userId, ...payload.notification, dedupeKey: row.dedupeKey }) : null;

  if (note) {
    await db.orm.public.OutboxMessage.where({ id }).update({ status: "SENT", attempts: attempt, sentAt: now.toISOString(), nextAttemptAt: null });

    return { delivered: true, reason: null };
  }

  const retryAt = payload.notification ? nextRetryAt(attempt, now) : null;
  // A concurrent delivery may have sent it meanwhile (its notify won the dedupe key): never overwrite SENT.
  const failed = await db
    .runtime()
    .query(
      sql`UPDATE "public"."outboxMessage" SET "status" = 'FAILED', "attempts" = "attempts" + 1, "nextAttemptAt" = NULLIF(${retryAt ? retryAt.toISOString() : ""}, '')::timestamptz
        WHERE "id" = ${id} AND "status" NOT IN ('SENT', 'SKIPPED') RETURNING "id"`
        .returnsRow({ id: "pg/int4@1" })
        .build(),
    )
    .toArray();

  if (!failed[0]) return { delivered: true, reason: null };

  return { delivered: false, reason: retryAt ? ("RETRY_LATER" as const) : ("GAVE_UP" as const) };
}

/** The owner's «إعادة المحاولة» on one outbox row: one more delivery, even after the last automatic attempt. Idempotent. */
export async function retryOutboxMessage(actor: Actor, id: number, now = new Date()): Promise<{ ok: true; delivered: boolean } | Fail> {
  if (!isFullAccess(actor.role)) return { ok: false, status: 403, error: "إعادة المحاولة للمالك فقط." };

  const row = await db.orm.public.OutboxMessage.first({ id });

  if (!row) return { ok: false, status: 404, error: "الرسالة غير موجودة." };
  if (row.status === "SENT") return { ok: true, delivered: true };
  if (row.status !== "FAILED" && row.status !== "PENDING") return { ok: false, status: 409, error: "هذي الرسالة ما تحتاج إعادة." };

  const result = await deliverOutbox(id, now);

  await logActivity({ actor, entityType: "SETTING", action: "AUTOMATION_OUTBOX_RETRY", summary: `إعادة محاولة رسالة #${id} (${row.template}): ${result.delivered ? "وصلت" : "فشلت"}`, details: JSON.stringify({ outboxId: id, template: row.template, delivered: result.delivered }) });

  return { ok: true, delivered: result.delivered };
}

/**
 * The hourly pass (and the same checks a «شغّل هسه» relies on): retry each
 * switched-on job whose run today FAILED or was cut off, retry due outbox
 * rows, and raise the 09:00 heartbeat once per day when a switched-on job has
 * no SUCCEEDED run today. Guarded like the jobs: production or local only,
 * automation on, each job's own switch.
 */
export async function automationMaintenance(now = new Date()) {
  const day = runKey("daily-digest", now).split(":")[1];

  if (!canRunHere({ CONTEXT: process.env.SHASHTNA_DEPLOY_CONTEXT || process.env.CONTEXT }, databaseHost())) return { ok: true as const, status: "SKIPPED" as const, reason: "NOT_PRODUCTION" };

  const settings = await automationSettings();

  if (!settings.enabled) return { ok: true as const, status: "SKIPPED" as const, reason: "AUTOMATION_OFF" };

  const retried: Partial<Record<Job, string>> = {};

  for (const job of JOBS) {
    if (!settings.jobs[job]) continue;

    const row = await db.orm.public.AutomationRun.first({ runKey: runKey(job, now) });
    const decision = row ? runDecision({ status: row.status, attempts: row.attempts, startedAt: String(row.startedAt), nextAttemptAt: row.nextAttemptAt ? String(row.nextAttemptAt) : null }, now) : null;

    // Only when there is something to do: a due retry, a cut-off run to re-claim or to close.
    if (decision === "RETRY" || decision === "RECLAIM" || decision === "EXPIRE") {
      const result = await runJob(job, { trigger: "RETRY", now });
      retried[job] = result.ok ? `${result.status}${result.reason ? `:${result.reason.slice(0, 40)}` : ""}` : "ERROR";
    }
  }

  const candidates = await db.orm.public.OutboxMessage.where({ channel: "IN_APP" }).where((m) => m.status.in(["PENDING", "FAILED"])).where((m) => m.attempts.lt(MAX_ATTEMPTS)).orderBy((m) => m.id.asc()).limit(200).all();
  const due = candidates.filter((row) => outboxDue({ status: row.status, attempts: row.attempts, nextAttemptAt: row.nextAttemptAt ? String(row.nextAttemptAt) : null, createdAt: String(row.createdAt) }, now));
  const outbox = { due: due.length, delivered: 0, failed: 0 };

  for (const row of due) {
    if ((await deliverOutbox(row.id, now)).delivered) outbox.delivered += 1;
    else outbox.failed += 1;
  }

  const todays = await db.orm.public.AutomationRun.where((r) => r.runKey.in(JOBS.map((job) => runKey(job, now)))).all();
  const missed = missedJobs({ enabled: settings.enabled, jobs: settings.jobs, succeededToday: todays.filter((r) => r.status === "SUCCEEDED").map((r) => r.job as Job), switchedOnAt: settings.switchedOnAt }, now);
  let alerted = 0;

  if (missed.length) {
    const staff = (await db.orm.public.User.select("id", "role").all()).filter((user) => isFullAccess(user.role));
    const names = missed.map((job) => JOB_LABELS[job].ar).join("، ");

    for (const user of staff) {
      const outboxId = await enqueueInApp({
        template: "heartbeat",
        userId: user.id,
        dedupeKey: `heartbeat:${day}:${user.id}`,
        payload: { notification: { type: "AUTOMATION_ALERT", title: "المهمة الصباحية ما اشتغلت اليوم", body: `ما نجح اليوم لحد هسه: ${names}. افتح «المهام» وشغّلها أو شوف الخطأ.`, link: "/admin/jobs" } },
      });

      if (outboxId && (await deliverOutbox(outboxId, now)).delivered) alerted += 1;
    }
  }

  if (Object.keys(retried).length || outbox.due || alerted) {
    await logActivity({ actor: null, entityType: "SETTING", action: "AUTOMATION_MAINTENANCE", summary: `الفحص الدوري: ${Object.keys(retried).length} إعادة تشغيل، ${outbox.delivered}/${outbox.due} رسالة، ${alerted} تنبيه`, details: JSON.stringify({ day, retried, outbox, missed, alerted }) });
  }

  return { ok: true as const, status: "SUCCEEDED" as const, reason: null, retried, outbox, missed, alerted };
}

export const JOB_LABELS: Record<Job, { ar: string; en: string }> = {
  "daily-digest": { ar: "قائمة اليوم الصباحية", en: "Morning daily list" },
  "customer-reminders": { ar: "تذكير العملاء", en: "Customer reminders" },
};

/** «المهام»: recent runs per job and outbox rows that need attention. Counts and error text only — no customer data. */
export async function jobsOverview(now = new Date()) {
  const settings = await automationSettings();
  const [runs, attention] = await Promise.all([
    db.orm.public.AutomationRun.orderBy((r) => r.startedAt.desc()).limit(40).all(),
    db.orm.public.OutboxMessage.where((m) => m.status.in(["FAILED", "PENDING"])).where({ channel: "IN_APP" }).orderBy((m) => m.id.desc()).limit(50).all(),
  ]);
  const parse = (value: string | null | undefined) => {
    try {
      return value ? JSON.parse(value) : null;
    } catch {
      return null;
    }
  };
  const todays = runs.filter((run) => JOBS.some((job) => run.runKey === runKey(job, now)));

  return {
    settings,
    missed: missedJobs({ enabled: settings.enabled, jobs: settings.jobs, succeededToday: todays.filter((run) => run.status === "SUCCEEDED").map((run) => run.job as Job), switchedOnAt: settings.switchedOnAt }, now),
    runs: runs.map((run) => ({
      id: run.id,
      job: run.job,
      runKey: run.runKey,
      status: run.status,
      attempts: run.attempts,
      trigger: run.trigger,
      startedAt: String(run.startedAt),
      finishedAt: run.finishedAt ? String(run.finishedAt) : null,
      nextAttemptAt: run.nextAttemptAt ? String(run.nextAttemptAt) : null,
      error: run.error ?? null,
      errorLog: (parse(run.errorLog) as { attempt: number; at: string; error: string }[] | null) ?? [],
      stats: parse(run.stats) as Record<string, unknown> | null,
    })),
    // A PENDING row only needs attention once its run had time to finish.
    outbox: attention
      .filter((row) => row.status === "FAILED" || now.getTime() - Date.parse(String(row.createdAt)) > 10 * 60_000)
      .map((row) => ({ id: row.id, template: row.template, status: row.status, attempts: row.attempts, createdAt: String(row.createdAt), nextAttemptAt: row.nextAttemptAt ? String(row.nextAttemptAt) : null, final: row.attempts >= MAX_ATTEMPTS })),
  };
}

export type JobsOverview = Awaited<ReturnType<typeof jobsOverview>>;
