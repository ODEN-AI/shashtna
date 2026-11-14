/**
 * Integration check of phone push (chapter 2) against a LOCAL database, with
 * a fake Expo sender (never the real push service):
 *
 *   node --experimental-strip-types --import ./tests/register-alias.mjs scripts/integration/push.mts
 *
 * A token is stored for the account and moves to whoever registers it last;
 * sign-out switches it off; with the owner's switch off notify() sends
 * nothing; with it on, notify() pushes the in-app notification to the
 * customer's active phones only; a dedupe repeat sends nothing; Expo's
 * DeviceNotRegistered switches the phone off; a network failure never breaks
 * the notification. Refuses any non-local DATABASE_URL; removes its rows.
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
const push = await import("@/src/server/push");
const { notify } = await import("@/src/server/notifications");

const o = db.orm.public;
const R = Date.now().toString(36);
const start = new Date(Date.now() - 1000).toISOString();
const [a, b] = await o.User.where({ role: "CUSTOMER" }).limit(2).all();
assert.ok(a && b, "the local database needs two CUSTOMER users");
const tokenA = `ExponentPushToken[testA${R}]`;
const tokenB = `ExponentPushToken[testB${R}]`;
const before = (await o.SiteSetting.first({ key: "push.enabled" }))?.value ?? null;
const setSwitch = async (value: "on" | "off") => {
  if (await o.SiteSetting.first({ key: "push.enabled" })) await o.SiteSetting.where({ key: "push.enabled" }).update({ value });
  else await o.SiteSetting.create({ key: "push.enabled", value });
};

type Sent = { url: string; messages: { to: string; title: string; data: { notificationId: number; link: string | null } }[] };
let sent: Sent[] = [];
let answer: (tokens: string[]) => unknown = (tokens) => ({ data: tokens.map(() => ({ status: "ok", id: "x" })) });
push.setPushFetchForTests(async (url, init) => {
  const messages = JSON.parse(init.body) as Sent["messages"];
  sent.push({ url, messages });
  return { ok: true, status: 200, json: async () => answer(messages.map((message) => message.to)) };
});

const results: string[] = [];
const check = async (name: string, fn: () => Promise<void>) => {
  try {
    sent = [];
    await fn();
    results.push(`PASS  ${name}`);
  } catch (error) {
    results.push(`FAIL  ${name}\n      ${String((error as Error).message).replace(/\s*\n\s*/g, " ").slice(0, 300)}`);
  }
};

await check("a phone's token is stored for the account and moves to whoever registers it last", async () => {
  const id = await push.registerDevice(a.id, { token: tokenA, platform: "ANDROID", deviceName: "Test", appVersion: "2.0.0" });
  assert.ok(id > 0);
  assert.equal((await o.PushDevice.first({ token: tokenA }))?.userId, a.id);

  await push.registerDevice(b.id, { token: tokenA, platform: "ANDROID", deviceName: "Test", appVersion: "2.0.0" });
  assert.equal((await o.PushDevice.first({ token: tokenA }))?.userId, b.id, "the same phone signed in as someone else");
  assert.equal((await o.PushDevice.where({ token: tokenA }).all()).length, 1, "one row per token");

  await push.registerDevice(a.id, { token: tokenA, platform: "ANDROID", deviceName: "Test", appVersion: "2.0.1" });
  await push.registerDevice(b.id, { token: tokenB, platform: "IOS", deviceName: null, appVersion: null });
  assert.equal(await push.countActiveDevices(a.id), 1);
});

await check("with the owner's switch off, notify() sends nothing", async () => {
  await setSwitch("off");
  const row = await notify({ userId: a.id, type: "ORDER_STATUS", title: "اختبار", body: "متوقف", link: "/orders/1" });
  assert.ok(row);
  assert.equal(sent.length, 0);
});

await check("with it on, notify() pushes the same title, text and link to that customer's phones only", async () => {
  await setSwitch("on");
  const row = await notify({ userId: a.id, type: "ORDER_STATUS", title: "تم تأكيد الدفع", body: "شكرًا", link: "/orders/12", dedupeKey: `push-test:${R}` });
  assert.ok(row);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].url, "https://exp.host/--/api/v2/push/send");
  assert.deepEqual(sent[0].messages.map((message) => message.to), [tokenA], "not customer B's phone");
  assert.equal(sent[0].messages[0].title, "تم تأكيد الدفع");
  assert.deepEqual(sent[0].messages[0].data, { notificationId: row!.id, type: "ORDER_STATUS", link: "/orders/12" });

  sent = [];
  await notify({ userId: a.id, type: "ORDER_STATUS", title: "تم تأكيد الدفع", body: "شكرًا", link: "/orders/12", dedupeKey: `push-test:${R}` });
  assert.equal(sent.length, 0, "a deduplicated repeat creates nothing and sends nothing");
});

await check("Expo's DeviceNotRegistered switches the phone off; a network failure never breaks notify()", async () => {
  answer = (tokens) => ({ data: tokens.map(() => ({ status: "error", details: { error: "DeviceNotRegistered" } })) });
  await notify({ userId: a.id, type: "RENEWAL_REMINDER", title: "اشتراكك قرب ينتهي", body: "x", link: "/subscriptions" });
  const gone = await o.PushDevice.first({ token: tokenA });
  assert.equal(gone?.isActive, false);
  assert.equal(gone?.lastError, "DeviceNotRegistered");

  push.setPushFetchForTests(async () => {
    throw new Error("offline");
  });
  const row = await notify({ userId: b.id, type: "TICKET_REPLY", title: "رد", body: "y", link: null });
  assert.ok(row, "the in-app notification is still created");
  assert.equal((await o.PushDevice.first({ token: tokenB }))?.lastError, "NETWORK");
});

await check("sign-out switches the phone off for that account only", async () => {
  await push.unregisterDevice(a.id, tokenB);
  assert.equal((await o.PushDevice.first({ token: tokenB }))?.isActive, true, "another account's phone is untouched");
  await push.unregisterDevice(b.id, tokenB);
  assert.equal((await o.PushDevice.first({ token: tokenB }))?.isActive, false);
});

// Clean up.
push.setPushFetchForTests(null);
await o.PushDevice.where((d) => d.token.in([tokenA, tokenB])).delete();
await o.Notification.where((n) => n.userId.in([a.id, b.id])).where((n) => n.createdAt.gte(start)).delete();
if (before === null) await o.SiteSetting.where({ key: "push.enabled" }).delete();
else await o.SiteSetting.where({ key: "push.enabled" }).update({ value: before });

console.log(results.join("\n"));
const failed = results.filter((line) => line.startsWith("FAIL")).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
