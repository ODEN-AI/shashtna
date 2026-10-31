/**
 * Integration check of the in-app customer reminders job (phase 4, step 2)
 * against a LOCAL database, through the services (no server needed):
 *
 *   node --experimental-strip-types --import ./tests/register-alias.mjs scripts/integration/customer-reminders.mts
 *
 * The switch; dry run creates nothing for customers and never blocks the real
 * cycle; a run creates the right notifications once (skip rules, open orders,
 * points, discount, link); a second run is a no-op; the ?r= tracking links an
 * order, a forged one is ignored; the measurement numbers move as expected.
 * It creates throwaway rows and removes them. Refuses any non-local DATABASE_URL.
 */
import assert from "node:assert/strict";

await import("dotenv/config");

const host = (() => {
  try {
    return new URL(process.env.DATABASE_URL ?? "").hostname;
  } catch {
    return "";
  }
})();

if (host !== "localhost" && host !== "127.0.0.1") {
  console.error("Refusing to run: DATABASE_URL must point at a local database.");
  process.exit(2);
}

const { db } = await import("@/src/prisma/db");
const { runJob, linkReminderToOrder, reminderReport, customerRemindersOn } = await import("@/src/server/automation");
const { runKey, reminderDedupeKey } = await import("@/src/lib/automation");

const R = Date.now().toString().slice(-7);
const start = new Date(Date.now() - 60_000).toISOString();
// 06:00 Baghdad on 10 Mar 2031, far from real data.
const day1 = new Date("2031-03-10T03:00:00Z");
const key1 = runKey("customer-reminders", day1);
const results: string[] = [];
const check = async (name: string, fn: () => Promise<void>) => {
  try {
    await fn();
    results.push(`PASS  ${name}`);
  } catch (error) {
    results.push(`FAIL  ${name}\n      ${String((error as Error).message).replace(/\s*\n\s*/g, " ").slice(0, 300)}`);
  }
};

const savedSettings = await db.orm.public.SiteSetting.where((s) => s.key.like("automation.%") || s.key.like("loyalty.%")).all();
const setSettings = async (values: Record<string, string>) => {
  for (const [key, value] of Object.entries(values)) {
    const existing = await db.orm.public.SiteSetting.first({ key });
    if (existing) await db.orm.public.SiteSetting.where({ key }).update({ value });
    else await db.orm.public.SiteSetting.create({ key, value, updatedBy: null });
  }
};

const mk = (name: string, tag: string, extra: Record<string, unknown> = {}) => db.orm.public.User.create({ name, phone: `07${tag}${R}`.slice(0, 11), passwordHash: "x", ...extra });
const amal = await mk("أمل التذكير", "51");
const optedOut = await mk("opted out", "52", { renewalReminders: false });
const renewer = await mk("renewed elsewhere", "53");
const pkg = await db.orm.public.Package.create({ name: `rem ${R}`, slug: `rem-${R}`, serviceType: "IPTV", price: 6000, durationMonths: 3, durationLabel: "3", description: "", specifications: "" });
const option = await db.orm.public.PackageOption.create({ packageId: pkg.id, durationMonths: 6, durationLabel: "6 أشهر", price: 10000, renewalPrice: 9000 });
const discount = await db.orm.public.Discount.create({ packageOptionId: option.id, kind: "PERCENT", value: 10, appliesToRenewals: true, createdBy: null });
const sub = (userId: number, expiryDate: string, extra: Record<string, unknown> = {}) =>
  db.orm.public.Subscription.create({ userId, serviceType: "IPTV", packageName: `rem ${R}`, packageId: pkg.id, startDate: "2031-01-01", expiryDate, ...extra });
// On 10 Mar: 15 Mar is T-5, 10 Mar T-0, 7 Mar T+3.
const s5 = await sub(amal.id, "2031-03-15");
const s0 = await sub(amal.id, "2031-03-10", { serviceType: "VIP", packageId: null });
const s3 = await sub(amal.id, "2031-03-07", { status: "EXPIRED" });
const sOpen = await sub(amal.id, "2031-03-15", { serviceType: "DIGITAL", packageId: null });
const sSuspended = await sub(amal.id, "2031-03-15", { status: "SUSPENDED", serviceType: "DIGITAL", packageId: null });
const sOptedOut = await sub(optedOut.id, "2031-03-15");
// Was due 15 Mar, already renewed: the same subscription now ends 15 Sep, so nothing is due.
const sRenewed = await sub(renewer.id, "2031-09-15");
const subIds = [s5.id, s0.id, s3.id, sOpen.id, sSuspended.id, sOptedOut.id, sRenewed.id];
const order = (userId: number, subscriptionId: number, status: string, extra: Record<string, unknown> = {}) =>
  db.orm.public.SubscriptionRequest.create({ userId, planSlug: pkg.slug, serviceType: "IPTV", serviceName: "rem", requestType: "RENEW", price: 9000, durationMonths: 6, durationLabel: "6", status, subscriptionId, ...extra });
// s5 was last renewed on the 6-month option; sOpen has an unpaid renewal waiting.
await order(amal.id, s5.id, "COMPLETED", { packageOptionId: option.id });
const openOrder = await order(amal.id, sOpen.id, "AWAITING_PAYMENT");
await db.orm.public.LoyaltyAccount.create({ userId: amal.id, balance: 25 });
const baseline = await reminderReport(30);

try {
  await check("the job ships off: master or job switch off → SKIPPED, and the dashboard keeps its on-visit reminders", async () => {
    await setSettings({ "automation.enabled": "on", "automation.job.customerReminders": "off", "automation.dryRun": "off" });
    assert.equal(((await runJob("customer-reminders", { trigger: "SCHEDULE", now: day1 })) as { reason?: string }).reason, "JOB_OFF");
    assert.equal(await customerRemindersOn(), false);
  });

  await check("dry run: counts the due reminders, creates no notification, and never blocks the real cycle", async () => {
    await setSettings({ "automation.job.customerReminders": "on", "automation.dryRun": "on", "loyalty.enabled": "on" });
    const run = await runJob("customer-reminders", { trigger: "SCHEDULE", now: day1 });
    assert.equal(run.ok && run.status, "SUCCEEDED");
    assert.equal((await db.orm.public.Notification.where((n) => n.userId.in([amal.id, optedOut.id, renewer.id])).all()).length, 0);
    const rows = await db.orm.public.OutboxMessage.where((m) => m.userId.in([amal.id])).all();
    assert.equal(rows.length, 4);
    assert.ok(rows.every((row) => row.status === "SKIPPED" && row.dedupeKey.startsWith("dryrun:")));
    assert.ok(((run as { stats?: { recorded: number } }).stats?.recorded ?? 0) >= 4);
    // The owner can't re-run a claimed day; the test clears the claim to run the real pass on the same data.
    await db.orm.public.AutomationRun.where({ runKey: key1 }).deleteAndCount();
  });

  await check("a run creates the right notifications once: T-5, T-0, T+3 and the open order; suspended, opted-out and renewed get none", async () => {
    await setSettings({ "automation.dryRun": "off" });
    assert.equal(await customerRemindersOn(), true);
    const run = await runJob("customer-reminders", { trigger: "SCHEDULE", now: day1 });
    assert.equal(run.ok && run.status, "SUCCEEDED");
    const stats = (run as { stats?: { created: number; openOrders: number; skipped: Record<string, number> } }).stats!;
    assert.ok(stats.created >= 4);
    assert.ok(stats.openOrders >= 1);
    assert.ok(stats.skipped.SUSPENDED >= 1 && stats.skipped.OPTED_OUT >= 1);

    const notes = await db.orm.public.Notification.where({ userId: amal.id }).all();
    const byKey = new Map(notes.map((note) => [note.dedupeKey, note]));
    const n5 = byKey.get(reminderDedupeKey("before-expiry", s5.id, "2031-03-15"));
    const n0 = byKey.get(reminderDedupeKey("expiry-day", s0.id, "2031-03-10"));
    const n3 = byKey.get(reminderDedupeKey("win-back", s3.id, "2031-03-07"));
    const nOpen = byKey.get(reminderDedupeKey("before-expiry", sOpen.id, "2031-03-15"));
    assert.equal(notes.length, 4);
    assert.equal(n5?.title, "اشتراكك ينتهي بعد 5 أيام");
    assert.equal(n0?.title, "اشتراكك ينتهي اليوم");
    assert.equal(n3?.title, "انتهى اشتراكك قبل 3 أيام");
    assert.equal(n3?.type, "SUBSCRIPTION_EXPIRED");
    assert.match(String(n5?.body), /عندك 25 نقطة/);
    assert.match(String(n5?.body), /خصم/);
    const outbox5 = await db.orm.public.OutboxMessage.first({ dedupeKey: reminderDedupeKey("before-expiry", s5.id, "2031-03-15") });
    assert.equal(outbox5?.status, "SENT");
    assert.equal(outbox5?.channel, "IN_APP");
    assert.equal(n5?.link, `/checkout?renew=${s5.id}&option=${option.id}&r=${outbox5?.id}`);
    assert.equal(nOpen?.link, `/orders/${openOrder.id}`);
    assert.match(String(nOpen?.body), /طلب التجديد مالتك جاهز/);
    const payload = JSON.parse(String(outbox5?.payload));
    assert.equal(payload.pushEligible, true);
    assert.equal(payload.en.title, "Your subscription ends in 5 days");
    assert.doesNotMatch(String(outbox5?.payload), new RegExp(amal.phone.slice(1)));
    assert.equal((await db.orm.public.Notification.where((n) => n.userId.in([optedOut.id, renewer.id])).all()).length, 0);
  });

  await check("a second run is a no-op, and even a cleared claim never sends the same cycle twice", async () => {
    const again = await runJob("customer-reminders", { trigger: "SCHEDULE", now: day1 });
    assert.equal((again as { reason?: string }).reason, "DUPLICATE");
    await db.orm.public.AutomationRun.where({ runKey: key1 }).deleteAndCount();
    const rerun = await runJob("customer-reminders", { trigger: "SCHEDULE", now: day1 });
    assert.equal((rerun as { stats?: { created: number } }).stats?.created, 0);
    assert.equal((await db.orm.public.Notification.where({ userId: amal.id }).all()).length, 4);
  });

  await check("tracking: an order from the reminder link is tagged; a forged r for another customer or subscription is ignored", async () => {
    const outbox5 = (await db.orm.public.OutboxMessage.first({ dedupeKey: reminderDedupeKey("before-expiry", s5.id, "2031-03-15") }))!;
    const outbox0 = (await db.orm.public.OutboxMessage.first({ dedupeKey: reminderDedupeKey("expiry-day", s0.id, "2031-03-10") }))!;
    const mine = await order(amal.id, s5.id, "SUBMITTED", { packageOptionId: option.id });
    const theirs = await order(renewer.id, sRenewed.id, "SUBMITTED");
    const otherSub = await order(amal.id, s3.id, "SUBMITTED");

    assert.equal(await linkReminderToOrder(renewer.id, theirs.id, String(outbox5.id)), false, "another customer's reminder");
    assert.equal(await linkReminderToOrder(amal.id, otherSub.id, String(outbox0.id)), false, "a reminder for another subscription");
    assert.equal(await linkReminderToOrder(amal.id, mine.id, "abc"), false);
    assert.equal(await linkReminderToOrder(amal.id, mine.id, String(outbox5.id)), true);
    assert.equal(await linkReminderToOrder(amal.id, mine.id, String(outbox5.id)), false, "only once");
    assert.equal((await db.orm.public.SubscriptionRequest.first({ id: mine.id }))?.reminderOutboxId, outbox5.id);
    assert.equal((await db.orm.public.SubscriptionRequest.first({ id: theirs.id }))?.reminderOutboxId ?? null, null);
  });

  await check("measurement: reminders per template, renewals started and completed from a reminder, conversion, and renewals without one", async () => {
    const tagged = (await db.orm.public.SubscriptionRequest.where({ userId: amal.id }).where((o) => o.reminderOutboxId.isNotNull()).first())!;
    await db.orm.public.SubscriptionRequest.where({ id: tagged.id }).update({ status: "COMPLETED" });
    const without = await order(renewer.id, sRenewed.id, "COMPLETED");
    const report = await reminderReport(30);

    assert.equal(report.perTemplate["before-expiry"] - baseline.perTemplate["before-expiry"], 2);
    assert.equal(report.perTemplate["expiry-day"] - baseline.perTemplate["expiry-day"], 1);
    assert.equal(report.perTemplate["win-back"] - baseline.perTemplate["win-back"], 1);
    assert.equal(report.started - baseline.started, 1);
    assert.equal(report.completed - baseline.completed, 1);
    assert.equal(report.completedWithout - baseline.completedWithout, 1, "the renewal completed without a reminder");
    assert.ok(report.conversion !== null && report.conversion > 0);
    assert.ok(without.id > 0);
  });
} finally {
  const users = [amal.id, optedOut.id, renewer.id];
  await db.orm.public.OutboxMessage.where((m) => m.userId.in(users)).deleteAndCount();
  await db.orm.public.Notification.where((n) => n.userId.in(users)).deleteAndCount();
  await db.orm.public.AutomationRun.where({ runKey: key1 }).deleteAndCount();
  await db.orm.public.ActivityEvent.where((event) => event.createdAt.gte(start)).deleteAndCount();
  await db.orm.public.LoyaltyEntry.where((e) => e.userId.in(users)).deleteAndCount();
  await db.orm.public.LoyaltyAccount.where((a) => a.userId.in(users)).deleteAndCount();
  await db.orm.public.SubscriptionRequest.where((o) => o.userId.in(users)).deleteAndCount();
  await db.orm.public.Subscription.where((s) => s.id.in(subIds)).deleteAndCount();
  await db.orm.public.Discount.where({ id: discount.id }).deleteAndCount();
  await db.orm.public.PackageOption.where({ packageId: pkg.id }).deleteAndCount();
  await db.orm.public.Package.where({ id: pkg.id }).deleteAndCount();
  await db.orm.public.SiteSetting.where((s) => s.key.like("automation.%") || s.key.like("loyalty.%")).deleteAndCount();
  for (const row of savedSettings) await db.orm.public.SiteSetting.create({ key: row.key, value: row.value, updatedBy: row.updatedBy ?? null });
  for (const id of users) await db.orm.public.User.where({ id }).deleteAndCount();
  const failed = results.filter((line) => line.startsWith("FAIL")).length;
  console.log(results.join("\n"));
  console.log(`\n${results.length - failed}/${results.length} passed`);
  await db.close();
  process.exitCode = failed ? 1 : 0;
}
