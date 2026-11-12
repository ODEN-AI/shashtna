/**
 * Integration check of automation hardening (phase 4, step 3) against a
 * LOCAL database, through the services (no server needed):
 *
 *   node --experimental-strip-types --import ./tests/register-alias.mjs scripts/integration/automation-retries.mts
 *
 * A failed run waits out its backoff, is retried by the hourly pass and then
 * succeeds once; three failures give up for good; a cut-off run is re-claimed;
 * a job switched off mid-retry stops; outbox retries never duplicate a
 * notification and give up after three attempts; the 09:00 heartbeat is raised
 * once per day; manual retries are owner-only.
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
const { automationMaintenance, deliverOutbox, retryOutboxMessage, runJob } = await import("@/src/server/automation");
const sql = db.raw.sql;

const R = Date.now().toString().slice(-7);
const start = new Date(Date.now() - 60_000).toISOString();
// Fixed April 2031 days, far from real data. Times are UTC (Baghdad = +3).
const t = (iso: string) => new Date(iso);
const D1 = "2031-04-10";
const D2 = "2031-04-11";
const D3 = "2031-04-12";
const D4 = "2031-04-13";
const keys = [D1, D2, D3, D4].map((day) => `daily-digest:${day}`);
const results: string[] = [];
const check = async (name: string, fn: () => Promise<void>) => {
  try {
    await fn();
    results.push(`PASS  ${name}`);
  } catch (error) {
    results.push(`FAIL  ${name}\n      ${String((error as Error).message).replace(/\s*\n\s*/g, " ").slice(0, 300)}`);
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
// The daily list reads every subscription first; making that throw makes the job fail.
const subscriptions = db.orm.public.Subscription as unknown as { all: (...args: unknown[]) => unknown };
const realAll = subscriptions.all.bind(db.orm.public.Subscription);
const breakJob = () => {
  subscriptions.all = () => {
    throw new Error("simulated outage for 07701234567");
  };
};
const fixJob = () => {
  subscriptions.all = realAll;
};
const run = (day: string) => db.orm.public.AutomationRun.first({ runKey: `daily-digest:${day}` });

const owner = await db.orm.public.User.create({ name: "retry owner", phone: `0781${R}`, passwordHash: "x", role: "ADMIN" });
const operator = await db.orm.public.User.create({ name: "retry operator", phone: `0782${R}`, passwordHash: "x", role: "OPERATOR" });
const customer = await db.orm.public.User.create({ name: "retry customer", phone: `0783${R}`, passwordHash: "x" });
const ownerActor = { id: owner.id, role: "ADMIN" };

try {
  await setSettings({ "automation.enabled": "on", "automation.job.dailyDigest": "on", "automation.job.customerReminders": "off", "automation.dryRun": "off" });

  await check("a failed run waits out its backoff, then the hourly pass retries it and it succeeds once", async () => {
    breakJob();
    const first = await runJob("daily-digest", { trigger: "SCHEDULE", now: t(`${D1}T03:00:00Z`) });
    assert.equal(first.ok && first.status, "FAILED");
    // 15 minutes after the failure (the run's own elapsed time is counted, so allow a second).
    const retryAt = Date.parse(String((first as { retryAt?: string }).retryAt));
    assert.ok(retryAt >= Date.parse(`${D1}T03:15:00.000Z`) && retryAt < Date.parse(`${D1}T03:15:01.000Z`), `retryAt ${retryAt}`);
    let row = await run(D1);
    assert.equal(row?.attempts, 1);
    assert.doesNotMatch(String(row?.error), /07701234567/, "the phone in the error is masked");

    const early = await automationMaintenance(t(`${D1}T03:05:00Z`));
    assert.equal((early as { retried?: Record<string, string> }).retried?.["daily-digest"], undefined, "not due yet: left alone, nothing logged");
    assert.equal((await run(D1))?.attempts, 1);

    fixJob();
    const retry = await automationMaintenance(t(`${D1}T03:20:00Z`));
    assert.equal((retry as { retried?: Record<string, string> }).retried?.["daily-digest"], "SUCCEEDED");
    row = await run(D1);
    assert.equal(row?.status, "SUCCEEDED");
    assert.equal(row?.attempts, 2);
    assert.equal(row?.trigger, "RETRY");
    assert.equal(JSON.parse(String(row?.errorLog)).length, 1);
    assert.equal((await db.orm.public.Notification.where({ dedupeKey: `daily-digest:${D1}:${owner.id}` }).all()).length, 1);

    // A SUCCEEDED run is never re-run: the hourly pass leaves it alone, «شغّل هسه» says it ran.
    const later = await automationMaintenance(t(`${D1}T04:20:00Z`));
    assert.equal((later as { retried?: Record<string, string> }).retried?.["daily-digest"], undefined);
    assert.equal(((await runJob("daily-digest", { trigger: "MANUAL", actor: ownerActor, now: t(`${D1}T04:30:00Z`) })) as { reason?: string }).reason, "DUPLICATE");
    assert.equal((await run(D1))?.attempts, 2);
    const retries = await db.orm.public.ActivityEvent.where({ action: "AUTOMATION_RETRY" }).where((e) => e.createdAt.gte(start)).all();
    assert.ok(retries.some((event) => String(event.details).includes(keys[0])));
  });

  await check("three failures become FAILED for good: no more retries, not even by hand; the history keeps all three", async () => {
    breakJob();
    await runJob("daily-digest", { trigger: "SCHEDULE", now: t(`${D2}T03:00:00Z`) });
    await automationMaintenance(t(`${D2}T03:20:00Z`));
    await automationMaintenance(t(`${D2}T04:21:00Z`));
    const row = await run(D2);
    assert.equal(row?.status, "FAILED");
    assert.equal(row?.attempts, 3);
    assert.equal(row?.nextAttemptAt ?? null, null);
    assert.equal(JSON.parse(String(row?.errorLog)).length, 3);
    fixJob();
    assert.equal(((await automationMaintenance(t(`${D2}T05:21:00Z`))) as { retried?: Record<string, string> }).retried?.["daily-digest"], undefined, "given up: left alone, nothing logged");
    assert.equal(((await runJob("daily-digest", { trigger: "MANUAL", actor: ownerActor, now: t(`${D2}T05:30:00Z`) })) as { reason?: string }).reason, "GAVE_UP");
    assert.equal((await run(D2))?.attempts, 3);
  });

  await check("the 09:00 heartbeat: raised once per day for a switched-on job with no SUCCEEDED run, never before 09:00", async () => {
    // D2 gave up. 08:59 Baghdad → nothing; 09:21 → one alert; 10:21 → still one.
    assert.deepEqual(((await automationMaintenance(t(`${D2}T05:59:00Z`))) as { missed?: string[] }).missed, []);
    const raised = await automationMaintenance(t(`${D2}T06:21:00Z`));
    assert.deepEqual((raised as { missed?: string[] }).missed, ["daily-digest"]);
    await automationMaintenance(t(`${D2}T07:21:00Z`));
    const alerts = await db.orm.public.Notification.where({ userId: owner.id, type: "AUTOMATION_ALERT" }).all();
    assert.equal(alerts.length, 1);
    assert.equal(alerts[0].title, "المهمة الصباحية ما اشتغلت اليوم");
    assert.equal(alerts[0].dedupeKey, `heartbeat:${D2}:${owner.id}`);
    assert.equal((await db.orm.public.Notification.where({ userId: operator.id, type: "AUTOMATION_ALERT" }).all()).length, 0, "full-access staff only");
    // D1 succeeded: no alert that day.
    assert.deepEqual(((await automationMaintenance(t(`${D1}T08:21:00Z`))) as { missed?: string[] }).missed, []);
  });

  await check("a cut-off RUNNING run is re-claimed after 30 minutes and finishes", async () => {
    await db.orm.public.AutomationRun.create({ job: "daily-digest", runKey: keys[2], status: "RUNNING", attempts: 1, trigger: "SCHEDULE", startedAt: `${D3}T03:00:00.000Z` });
    assert.equal(((await automationMaintenance(t(`${D3}T03:20:00Z`))) as { retried?: Record<string, string> }).retried?.["daily-digest"], undefined, "still fresh: left alone");
    assert.equal(((await automationMaintenance(t(`${D3}T03:40:00Z`))) as { retried?: Record<string, string> }).retried?.["daily-digest"], "SUCCEEDED");
    const row = await run(D3);
    assert.equal(row?.attempts, 2);
    assert.match(String(row?.errorLog), /cut off/);
  });

  await check("a cut-off LAST attempt is closed as FAILED for good (never left RUNNING), with the cut-off in its history", async () => {
    await db.orm.public.AutomationRun.where({ runKey: keys[2] }).update({ status: "RUNNING", attempts: 3, startedAt: `${D3}T04:00:00.000Z`, finishedAt: null });
    assert.equal(((await automationMaintenance(t(`${D3}T04:20:00Z`))) as { retried?: Record<string, string> }).retried?.["daily-digest"], undefined, "fresh: left alone");
    const closed = await automationMaintenance(t(`${D3}T04:40:00Z`));
    assert.equal((closed as { retried?: Record<string, string> }).retried?.["daily-digest"], "SKIPPED:GAVE_UP");
    const row = await run(D3);
    assert.equal(row?.status, "FAILED");
    assert.equal(row?.attempts, 3);
    assert.equal(row?.nextAttemptAt ?? null, null);
    assert.match(String(row?.errorLog), /"attempt":3,[^}]*cut off/);
    // Once given up, the hourly pass doesn't touch (or log) it again.
    const quiet = await automationMaintenance(t(`${D3}T05:40:00Z`));
    assert.equal((quiet as { retried?: Record<string, string> }).retried?.["daily-digest"], undefined);
  });

  await check("heartbeat: no false alarm for a job switched on after that day's 06:00 run", async () => {
    // D3's run gave up above. Pin when the job switch was saved, then check at 15:00 Baghdad that day.
    const savedAt = async (iso: string) =>
      db.runtime().query(sql`UPDATE "public"."siteSetting" SET "updatedAt" = ${iso}::timestamptz WHERE "key" = 'automation.job.dailyDigest' RETURNING "id"`.returnsRow({ id: "pg/int4@1" }).build()).toArray();
    await savedAt(`${D3}T11:00:00.000Z`);
    assert.deepEqual(((await automationMaintenance(t(`${D3}T12:00:00Z`))) as { missed?: string[] }).missed, [], "switched on at 14:00, after the 06:00 run");
    await savedAt(`${D3}T02:00:00.000Z`);
    assert.deepEqual(((await automationMaintenance(t(`${D3}T12:00:00Z`))) as { missed?: string[] }).missed, ["daily-digest"], "switched on before 06:00: it should have run");
  });

  await check("kill switch: a job switched off mid-retry stops cleanly (SKIPPED) and stays FAILED", async () => {
    breakJob();
    await runJob("daily-digest", { trigger: "SCHEDULE", now: t(`${D4}T03:00:00Z`) });
    fixJob();
    await setSettings({ "automation.job.dailyDigest": "off" });
    const pass = await automationMaintenance(t(`${D4}T03:20:00Z`));
    assert.deepEqual((pass as { retried?: Record<string, string> }).retried, {});
    assert.equal(((await runJob("daily-digest", { trigger: "MANUAL", actor: ownerActor, now: t(`${D4}T03:25:00Z`) })) as { reason?: string }).reason, "JOB_OFF");
    await setSettings({ "automation.enabled": "off", "automation.job.dailyDigest": "on" });
    assert.equal(((await automationMaintenance(t(`${D4}T03:30:00Z`))) as { reason?: string }).reason, "AUTOMATION_OFF");
    const row = await run(D4);
    assert.equal(row?.status, "FAILED");
    assert.equal(row?.attempts, 1);
    await setSettings({ "automation.enabled": "on" });
  });

  await check("outbox retries never duplicate: a delivered-but-unmarked row is marked SENT, a lost one is created once, a payload with no notification is closed as SKIPPED", async () => {
    const notification = { type: "RENEWAL_REMINDER", title: "retry test", body: "body", link: "/subscriptions" };
    const mk = (key: string, extra: Record<string, unknown>) =>
      db.orm.public.OutboxMessage.create({ channel: "IN_APP", template: "before-expiry", userId: customer.id, dedupeKey: `${key}:${R}`, status: "FAILED", attempts: 1, nextAttemptAt: "2031-04-01T00:00:00.000Z", payload: JSON.stringify({ notification }), ...extra });
    // a) the notification exists already (it was created, the SENT mark was lost)
    const delivered = await mk("retry-a", {});
    await db.orm.public.Notification.create({ userId: customer.id, type: notification.type, title: notification.title, body: notification.body, link: notification.link, dedupeKey: delivered.dedupeKey });
    // b) never delivered
    const lost = await mk("retry-b", {});
    // c) undeliverable (no notification in the payload)
    const broken = await mk("retry-c", { payload: "{}" });

    const now = t(`${D1}T05:20:00Z`);
    await automationMaintenance(now);
    await automationMaintenance(new Date(now.getTime() + 2 * 3_600_000));
    await automationMaintenance(new Date(now.getTime() + 4 * 3_600_000));

    const rowOf = (id: number) => db.orm.public.OutboxMessage.first({ id });
    const count = async (key: string) => (await db.orm.public.Notification.where({ dedupeKey: key }).all()).length;
    assert.equal((await rowOf(delivered.id))?.status, "SENT");
    assert.equal(await count(delivered.dedupeKey), 1, "no duplicate of an existing notification");
    assert.equal((await rowOf(lost.id))?.status, "SENT");
    assert.equal(await count(lost.dedupeKey), 1);
    // A pre-step-3 row has nothing to deliver: closed as SKIPPED, not a failure nobody can fix.
    const closed = await rowOf(broken.id);
    assert.equal(closed?.status, "SKIPPED");
    assert.equal(closed?.nextAttemptAt ?? null, null);
    assert.equal(await count(broken.dedupeKey), 0);
  });

  await check("two deliveries of the same row at once: one notification, and the row ends SENT", async () => {
    const row = await db.orm.public.OutboxMessage.create({ channel: "IN_APP", template: "expiry-day", userId: customer.id, dedupeKey: `retry-race:${R}`, status: "PENDING", attempts: 0, payload: JSON.stringify({ notification: { type: "RENEWAL_REMINDER", title: "race", body: "b", link: null } }) });
    const results = await Promise.all([deliverOutbox(row.id), deliverOutbox(row.id), deliverOutbox(row.id)]);
    assert.ok(results.some((result) => result.delivered));
    assert.equal((await db.orm.public.Notification.where({ dedupeKey: row.dedupeKey }).all()).length, 1);
    assert.equal((await db.orm.public.OutboxMessage.first({ id: row.id }))?.status, "SENT");
  });

  await check("manual outbox retry: owner only, idempotent, logged", async () => {
    const row = await db.orm.public.OutboxMessage.create({ channel: "IN_APP", template: "win-back", userId: customer.id, dedupeKey: `retry-manual:${R}`, status: "FAILED", attempts: 3, payload: JSON.stringify({ notification: { type: "SUBSCRIPTION_EXPIRED", title: "manual", body: "b", link: null } }) });

    assert.equal((await retryOutboxMessage({ id: operator.id, role: "OPERATOR" }, row.id)).ok, false);
    const first = await retryOutboxMessage(ownerActor, row.id);
    const second = await retryOutboxMessage(ownerActor, row.id);
    assert.deepEqual([first.ok && first.delivered, second.ok && second.delivered], [true, true]);
    assert.equal((await db.orm.public.Notification.where({ dedupeKey: row.dedupeKey }).all()).length, 1);
    const logged = await db.orm.public.ActivityEvent.where({ action: "AUTOMATION_OUTBOX_RETRY" }).where((e) => e.createdAt.gte(start)).all();
    assert.ok(logged.some((event) => event.actorUserId === owner.id));
  });
} finally {
  fixJob();
  await db.orm.public.AutomationRun.where((r) => r.runKey.in(keys)).deleteAndCount();
  await db.orm.public.OutboxMessage.where((m) => m.userId.in([owner.id, operator.id, customer.id])).deleteAndCount();
  // Other local full-access staff got the digest and heartbeat for these days too.
  for (const pattern of ["daily-digest:2031-04-%", "heartbeat:2031-04-%"]) {
    await db.orm.public.OutboxMessage.where((m) => m.dedupeKey.like(pattern)).deleteAndCount();
    await db.orm.public.Notification.where((n) => n.dedupeKey.like(pattern)).deleteAndCount();
  }
  await db.orm.public.Notification.where((n) => n.userId.in([owner.id, operator.id, customer.id])).deleteAndCount();
  await db.orm.public.ActivityEvent.where((event) => event.createdAt.gte(start)).deleteAndCount();
  await db.orm.public.SiteSetting.where((s) => s.key.like("automation.%")).deleteAndCount();
  for (const row of savedSettings) await db.orm.public.SiteSetting.create({ key: row.key, value: row.value, updatedBy: row.updatedBy ?? null });
  for (const id of [customer.id, operator.id, owner.id]) await db.orm.public.User.where({ id }).deleteAndCount();
  const failed = results.filter((line) => line.startsWith("FAIL")).length;
  console.log(results.join("\n"));
  console.log(`\n${results.length - failed}/${results.length} passed`);
  await db.close();
  process.exitCode = failed ? 1 : 0;
}
