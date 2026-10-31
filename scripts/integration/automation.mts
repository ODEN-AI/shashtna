/**
 * Integration check of automation (phase 4, step 1) against a LOCAL database,
 * through the services (no server needed):
 *
 *   node --experimental-strip-types --import ./tests/register-alias.mjs scripts/integration/automation.mts
 *
 * Switches and dry run; one run per Baghdad day (a repeat or a parallel run
 * is a no-op); the owner's morning notification once; the daily list picks
 * the right subscriptions; a WhatsApp link is recorded SENT once; owner-only.
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
const { dailyList, markWhatsAppOpened, runJob } = await import("@/src/server/automation");
const { runKey, whatsappDedupeKey } = await import("@/src/lib/automation");

const R = Date.now().toString().slice(-7);
const start = new Date(Date.now() - 60_000).toISOString();
// Fixed days far from today, so nothing real collides: 06:00 Baghdad.
const day1 = new Date("2031-03-10T03:00:00Z");
const day2 = new Date("2031-03-11T03:00:00Z");
const day3 = new Date("2031-03-12T03:00:00Z");
const keys = [day1, day2, day3].map((day) => runKey("daily-digest", day));
const results: string[] = [];
const check = async (name: string, fn: () => Promise<void>) => {
  try {
    await fn();
    results.push(`PASS  ${name}`);
  } catch (error) {
    results.push(`FAIL  ${name}\n      ${String((error as Error).message).split("\n")[0]}`);
  }
};

const savedSettings = await db.orm.public.SiteSetting.where((s) => s.key.like("automation.%")).all();
const setSettings = async (values: Record<string, string>) => {
  for (const [key, value] of Object.entries(values)) {
    const existing = await db.orm.public.SiteSetting.first({ key });
    if (existing) await db.orm.public.SiteSetting.where({ key }).update({ value });
    else await db.orm.public.SiteSetting.create({ key, value, updatedBy: null });
  }
};

const owner = await db.orm.public.User.create({ name: "automation owner", phone: `0791${R}`, passwordHash: "x", role: "ADMIN" });
const operator = await db.orm.public.User.create({ name: "automation operator", phone: `0792${R}`, passwordHash: "x", role: "OPERATOR" });
const customer = await db.orm.public.User.create({ name: "حسين التجربة", phone: `0770${R}`.slice(0, 11), passwordHash: "x" });
const noPhone = await db.orm.public.User.create({ name: "no phone", phone: `+1555${R}`, passwordHash: "x" });
const ownerActor = { id: owner.id, role: "ADMIN" };
const sub = (userId: number, expiryDate: string, extra: Record<string, string> = {}) =>
  db.orm.public.Subscription.create({ userId, serviceType: "IPTV", packageName: `auto ${R}`, startDate: "2031-01-01", expiryDate, ...extra });
// On day1 (10 Mar): 15 Mar is before-expiry, 10 Mar expiry-day, 7 Mar win-back, 14 Mar nothing.
const before = await sub(customer.id, "2031-03-15");
const today = await sub(customer.id, "2031-03-10", { serviceType: "VIP" });
const winBack = await sub(customer.id, "2031-03-07", { status: "EXPIRED" });
const quiet = await sub(customer.id, "2031-03-14");
const suspended = await sub(customer.id, "2031-03-15", { status: "SUSPENDED" });
const foreign = await sub(noPhone.id, "2031-03-15");

try {
  await check("everything off by default → SKIPPED; job switch respected; operator can't run it", async () => {
    await setSettings({ "automation.enabled": "off", "automation.job.dailyDigest": "off", "automation.dryRun": "off" });
    assert.equal(((await runJob("daily-digest", { trigger: "SCHEDULE", now: day1 })) as { reason?: string }).reason, "AUTOMATION_OFF");
    await setSettings({ "automation.enabled": "on" });
    assert.equal(((await runJob("daily-digest", { trigger: "SCHEDULE", now: day1 })) as { reason?: string }).reason, "JOB_OFF");
    const refused = await runJob("daily-digest", { trigger: "MANUAL", actor: { id: operator.id, role: "OPERATOR" }, now: day1 });
    assert.equal(refused.ok, false);
    assert.equal((await db.orm.public.AutomationRun.where((r) => r.runKey.in(keys)).all()).length, 0, "no run row while skipped");
  });

  await check("the daily list: 5 days before, the day, 3 days after; suspended and off-days left out; links only for Iraqi numbers", async () => {
    const list = await dailyList(day1);
    const mine = list.subscriptions.filter((row) => [before.id, today.id, winBack.id, quiet.id, suspended.id, foreign.id].includes(row.subscriptionId));
    const of = (id: number) => mine.find((row) => row.subscriptionId === id);

    assert.equal(of(before.id)?.reminder, "before-expiry");
    assert.equal(of(today.id)?.reminder, "expiry-day");
    assert.equal(of(today.id)?.serviceType, "VIP");
    assert.equal(of(winBack.id)?.reminder, "win-back");
    assert.equal(of(quiet.id), undefined);
    assert.equal(of(suspended.id), undefined);
    assert.equal(of(foreign.id)?.link, null);
    const link = of(before.id)?.link ?? "";
    assert.ok(link.startsWith(`https://wa.me/964${customer.phone.slice(1)}?text=`), link.slice(0, 40));
    const text = decodeURIComponent(link.split("?text=")[1]);
    assert.match(text, /^هلا حسين/);
    assert.match(text, new RegExp(`checkout\\?renew=${before.id}`));
    assert.doesNotMatch(text, /password|username/i);
  });

  await check("a run claims the day once: repeat → DUPLICATE, parallel → exactly one SUCCEEDED; owner notified once", async () => {
    await setSettings({ "automation.job.dailyDigest": "on" });
    const results = await Promise.all([runJob("daily-digest", { trigger: "SCHEDULE", now: day1 }), runJob("daily-digest", { trigger: "SCHEDULE", now: day1 })]);
    const statuses = results.map((r) => (r.ok ? r.status : "ERR")).sort();
    assert.deepEqual(statuses, ["SKIPPED", "SUCCEEDED"]);
    const again = await runJob("daily-digest", { trigger: "MANUAL", actor: ownerActor, now: day1 });
    assert.equal(again.ok && again.status, "SKIPPED");
    assert.equal((again as { reason?: string }).reason, "DUPLICATE");
    const runs = await db.orm.public.AutomationRun.where({ runKey: keys[0] }).all();
    assert.equal(runs.length, 1);
    assert.equal(runs[0].status, "SUCCEEDED");
    assert.ok(JSON.parse(runs[0].stats ?? "{}").subscriptions >= 3);
    const notes = await db.orm.public.Notification.where({ userId: owner.id, type: "DAILY_DIGEST" }).all();
    assert.equal(notes.length, 1);
    assert.equal(notes[0].dedupeKey, `daily-digest:2031-03-10:${owner.id}`);
    assert.equal((await db.orm.public.Notification.where({ userId: operator.id, type: "DAILY_DIGEST" }).all()).length, 0, "only full-access staff");
    const logged = await db.orm.public.ActivityEvent.where({ action: "AUTOMATION_RUN" }).where((e) => e.createdAt.gte(start)).all();
    assert.ok(logged.some((event) => String(event.details).includes(keys[0])));
  });

  await check("a WhatsApp link is recorded SENT once, owner only, never for a reminder not due; the list shows «أُرسلت»", async () => {
    assert.equal((await markWhatsAppOpened({ id: operator.id, role: "OPERATOR" }, before.id, "before-expiry", day1)).ok, false);
    assert.equal(((await markWhatsAppOpened(ownerActor, before.id, "win-back", day1)) as { status?: number }).status, 409);
    const first = await markWhatsAppOpened(ownerActor, before.id, "before-expiry", day1);
    const second = await markWhatsAppOpened(ownerActor, before.id, "before-expiry", day1);
    assert.deepEqual([first.ok && first.created, second.ok && second.created], [true, false]);
    const rows = await db.orm.public.OutboxMessage.where({ dedupeKey: whatsappDedupeKey("before-expiry", before.id, "2031-03-15") }).all();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].status, "SENT");
    assert.equal(rows[0].sentBy, owner.id);
    assert.equal(rows[0].channel, "WHATSAPP_LINK");
    assert.doesNotMatch(rows[0].payload, new RegExp(customer.phone.slice(1)));
    const list = await dailyList(day1);
    assert.equal(list.subscriptions.find((row) => row.subscriptionId === before.id)?.sent?.status, "SENT");
    assert.equal(list.subscriptions.find((row) => row.subscriptionId === today.id)?.sent, null);
  });

  await check("dry run: the run is recorded, but no notification and links are SKIPPED, not SENT", async () => {
    await setSettings({ "automation.dryRun": "on" });
    const run = await runJob("daily-digest", { trigger: "MANUAL", actor: ownerActor, now: day2 });
    assert.equal(run.ok && run.status, "SUCCEEDED");
    assert.equal((run as { stats?: { dryRun?: boolean; notified?: number } }).stats?.dryRun, true);
    assert.equal((run as { stats?: { notified?: number } }).stats?.notified, 0);
    assert.equal((await db.orm.public.Notification.where({ userId: owner.id, type: "DAILY_DIGEST" }).all()).length, 1, "still only day1's");
    // The sub that ended 10 Mar is due its win-back on 13 Mar.
    const marked = await markWhatsAppOpened(ownerActor, today.id, "win-back", new Date("2031-03-13T03:00:00Z"));
    assert.ok(marked.ok && marked.created);
    const row = await db.orm.public.OutboxMessage.first({ dedupeKey: whatsappDedupeKey("win-back", today.id, "2031-03-10") });
    assert.equal(row?.status, "SKIPPED");
  });

  await check("a failing job is recorded FAILED with the error text, and the day stays claimed", async () => {
    await setSettings({ "automation.dryRun": "off" });
    const original = db.orm.public.Subscription.all.bind(db.orm.public.Subscription);
    (db.orm.public.Subscription as unknown as { all: () => never }).all = () => {
      throw new Error("simulated failure");
    };
    try {
      const run = await runJob("daily-digest", { trigger: "MANUAL", actor: ownerActor, now: day3 });
      assert.equal(run.ok && run.status, "FAILED");
    } finally {
      (db.orm.public.Subscription as unknown as { all: typeof original }).all = original;
    }
    const row = await db.orm.public.AutomationRun.first({ runKey: keys[2] });
    assert.equal(row?.status, "FAILED");
    assert.match(String(row?.error), /simulated failure/);
    const list = await dailyList(day3);
    assert.equal(list.health.lastRun?.status, "FAILED");
    assert.equal(list.health.ranToday, false);
  });
} finally {
  const subIds = [before.id, today.id, winBack.id, quiet.id, suspended.id, foreign.id];
  await db.orm.public.OutboxMessage.where((m) => m.userId.in([customer.id, noPhone.id])).deleteAndCount();
  await db.orm.public.AutomationRun.where((r) => r.runKey.in(keys)).deleteAndCount();
  await db.orm.public.Notification.where((n) => n.userId.in([owner.id, operator.id])).deleteAndCount();
  // Other local full-access staff got day notifications too; they carry the 2031 dedupe keys.
  await db.orm.public.Notification.where((n) => n.dedupeKey.like("daily-digest:2031-03-%")).deleteAndCount();
  await db.orm.public.ActivityEvent.where((event) => event.createdAt.gte(start)).deleteAndCount();
  await db.orm.public.Subscription.where((s) => s.id.in(subIds)).deleteAndCount();
  await db.orm.public.SiteSetting.where((s) => s.key.like("automation.%")).deleteAndCount();
  for (const row of savedSettings) await db.orm.public.SiteSetting.create({ key: row.key, value: row.value, updatedBy: row.updatedBy ?? null });
  for (const id of [customer.id, noPhone.id, operator.id, owner.id]) await db.orm.public.User.where({ id }).deleteAndCount();
  const failed = results.filter((line) => line.startsWith("FAIL")).length;
  console.log(results.join("\n"));
  console.log(`\n${results.length - failed}/${results.length} passed`);
  await db.close();
  process.exitCode = failed ? 1 : 0;
}
