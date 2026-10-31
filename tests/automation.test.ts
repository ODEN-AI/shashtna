import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const a = await import("@/src/lib/automation");
const { automationToken, verifyAutomationToken } = await import("@/src/lib/automation-token");
const { settingProblem } = await import("@/src/lib/system");

// Baghdad is UTC+3: 21:30 UTC on the 31st is already 00:30 on the 1st there.
const at = (iso: string) => new Date(iso);

test("runKey: one key per job per Baghdad day, rolling over at Baghdad midnight", () => {
  assert.equal(a.runKey("daily-digest", at("2026-10-31T03:00:00Z")), "daily-digest:2026-10-31");
  assert.equal(a.runKey("daily-digest", at("2026-10-31T20:59:00Z")), "daily-digest:2026-10-31");
  assert.equal(a.runKey("daily-digest", at("2026-10-31T21:00:00Z")), "daily-digest:2026-11-01");
});

test("daysUntil and reminderFor: Baghdad days, across month and year ends", () => {
  // 06:00 Baghdad on 27 Oct → 1 Nov is 5 days away.
  assert.equal(a.daysUntil("2026-11-01", at("2026-10-27T03:00:00Z")), 5);
  assert.equal(a.reminderFor("2026-11-01", at("2026-10-27T03:00:00Z")), "before-expiry");
  // 26 Feb (non-leap) → 3 Mar is 5 days.
  assert.equal(a.reminderFor("2027-03-03", at("2027-02-26T09:00:00Z")), "before-expiry");
  // 29 Dec → 3 Jan, across the year.
  assert.equal(a.reminderFor("2027-01-03", at("2026-12-29T09:00:00Z")), "before-expiry");
  // Expiry day and win-back.
  assert.equal(a.reminderFor("2026-10-31", at("2026-10-31T09:00:00Z")), "expiry-day");
  assert.equal(a.reminderFor("2026-10-28", at("2026-10-31T09:00:00Z")), "win-back");
  // 30 Nov expired, 3 Dec win-back across the month end.
  assert.equal(a.reminderFor("2026-11-30", at("2026-12-03T09:00:00Z")), "win-back");
  // Late evening UTC is already the next Baghdad day.
  assert.equal(a.reminderFor("2026-11-01", at("2026-10-31T21:30:00Z")), "expiry-day");
  assert.equal(a.reminderFor("2026-11-01", at("2026-10-31T20:30:00Z")), null);
  // A timestamp string is read by its date.
  assert.equal(a.reminderFor("2026-10-31T00:00:00.000Z", at("2026-10-31T09:00:00Z")), "expiry-day");
  for (const days of [1, 2, 3, 4, 6, -1, -2, -4]) {
    const day = new Date(Date.UTC(2026, 9, 31 + days)).toISOString().slice(0, 10);
    assert.equal(a.reminderFor(day, at("2026-10-31T09:00:00Z")), null, String(days));
  }
  assert.equal(a.daysUntil("not a date", at("2026-10-31T09:00:00Z")), null);
});

test("whatsappDedupeKey: one message per template, subscription and end date", () => {
  assert.equal(a.whatsappDedupeKey("before-expiry", 12, "2026-11-01T00:00:00Z"), "wa:before-expiry:12:2026-11-01");
  assert.notEqual(a.whatsappDedupeKey("expiry-day", 12, "2026-11-01"), a.whatsappDedupeKey("before-expiry", 12, "2026-11-01"));
  // A renewal moves the end date, so the next cycle gets a fresh key.
  assert.notEqual(a.whatsappDedupeKey("before-expiry", 12, "2026-12-01"), a.whatsappDedupeKey("before-expiry", 12, "2026-11-01"));
});

test("quiet hours: 22:00–09:00 Baghdad by default, wrapping past midnight; malformed falls back", () => {
  assert.deepEqual(a.parseQuietHours("22:00-09:00"), { start: 1320, end: 540 });
  assert.deepEqual(a.parseQuietHours("nonsense"), { start: 1320, end: 540 });
  assert.equal(a.isQuietHours("22:00-09:00", at("2026-10-31T19:30:00Z")), true); // 22:30
  assert.equal(a.isQuietHours("22:00-09:00", at("2026-10-31T05:59:00Z")), true); // 08:59
  assert.equal(a.isQuietHours("22:00-09:00", at("2026-10-31T06:00:00Z")), false); // 09:00
  assert.equal(a.isQuietHours("22:00-09:00", at("2026-10-31T18:59:00Z")), false); // 21:59
  assert.equal(a.isQuietHours("13:00-15:00", at("2026-10-31T10:30:00Z")), true); // 13:30, same-day range
  assert.equal(a.isQuietHours("13:00-15:00", at("2026-10-31T12:30:00Z")), false);
  assert.equal(a.isQuietHours("10:00-10:00", at("2026-10-31T07:00:00Z")), false);
});

test("canRunHere: only the production deploy or a local database — never a preview on the shared database", () => {
  assert.equal(a.canRunHere({ CONTEXT: "production" }, "ep-x.neon.tech"), true);
  assert.equal(a.canRunHere({ CONTEXT: "deploy-preview" }, "ep-x.neon.tech"), false);
  assert.equal(a.canRunHere({ CONTEXT: "branch-deploy" }, "ep-x.neon.tech"), false);
  assert.equal(a.canRunHere({}, "ep-x.neon.tech"), false);
  assert.equal(a.canRunHere({}, "localhost"), true);
  assert.equal(a.canRunHere({}, "127.0.0.1"), true);
});

test("iraqiWhatsapp: every stored form becomes 9647…; anything else is refused", () => {
  for (const phone of ["07701234567", "7701234567", "+964 770 123 4567", "009647701234567", "964-770-123-4567"]) {
    assert.equal(a.iraqiWhatsapp(phone), "9647701234567", phone);
  }
  for (const phone of ["", null, undefined, "0770123456", "06701234567", "+1 202 555 0100", "abc"]) {
    assert.equal(a.iraqiWhatsapp(phone), null, String(phone));
  }
});

test("renderReminder: Iraqi Arabic with the first name, package, date, renewal link; points and discount only when present", () => {
  const data = { firstName: a.firstName("  علي حسن "), packageName: "IPTV 4K", endDate: "2026-11-05", points: 0, discountLabel: null, renewUrl: "https://shashtna.netlify.app/checkout?renew=12" };
  const before = a.renderReminder("before-expiry", data);

  assert.match(before, /^هلا علي 👋/);
  assert.match(before, /«IPTV 4K» ينتهي بعد 5 أيام/);
  assert.match(before, /رابط التجديد: https:\/\/shashtna\.netlify\.app\/checkout\?renew=12/);
  assert.match(before, /فريق شاشتنا$/);
  assert.doesNotMatch(before, /نقطة|خصم/);

  const rich = a.renderReminder("expiry-day", { ...data, points: 40, discountLabel: "خصم 10%" });
  assert.match(rich, /ينتهي اليوم/);
  assert.match(rich, /عندك 40 نقطة/);
  assert.match(rich, /خصم 10%/);
  assert.match(a.renderReminder("win-back", data), /خلص من 3 أيام/);
  assert.match(a.renderReminder("win-back", { ...data, firstName: "" }), /^هلا 👋/);
  assert.match(a.renderReminder("before-expiry", data, "en"), /^Hi علي 👋\nYour «IPTV 4K» subscription ends in 5 days/);

  const link = a.waLink("9647701234567", before);
  assert.ok(link.startsWith("https://wa.me/9647701234567?text="));
  assert.equal(decodeURIComponent(link.split("?text=")[1]), before);
});

test("automation settings: on/off switches and a quiet-hours range, refused otherwise", () => {
  assert.equal(settingProblem("automation.enabled", "on"), null);
  assert.equal(settingProblem("automation.dryRun", "off"), null);
  assert.ok(settingProblem("automation.job.dailyDigest", "yes"));
  assert.equal(settingProblem("automation.quietHours", "22:00-09:00"), null);
  assert.ok(settingProblem("automation.quietHours", "10pm-9am"));
});

test("automation token: an HMAC of the day's run key, refused for another day, another secret or no secret", () => {
  const secret = "s".repeat(40);
  const key = "daily-digest:2026-10-31";
  const token = automationToken(secret, key);

  assert.equal(verifyAutomationToken(secret, key, token), true);
  assert.equal(verifyAutomationToken(secret, "daily-digest:2026-11-01", token), false);
  assert.equal(verifyAutomationToken("t".repeat(40), key, token), false);
  assert.equal(verifyAutomationToken(undefined, key, token), false);
  assert.equal(verifyAutomationToken("short", key, automationToken("short", key)), false);
  assert.equal(verifyAutomationToken(secret, key, null), false);
  assert.equal(verifyAutomationToken(secret, key, "abc"), false);
});

test("scheduled function: production-only guard, 03:00 UTC schedule, and the same HMAC input as the server", () => {
  const source = readFileSync(new URL("../netlify/functions/daily-digest.mts", import.meta.url), "utf8");

  assert.match(source, /context\?\.deploy\?\.context \?\? process\.env\.CONTEXT/);
  assert.match(source, /deployContext !== "production"/);
  assert.match(source, /schedule: "0 3 \* \* \*"/);
  assert.match(source, /update\(`automation:\$\{job\}:\$\{day\}`\)/);
  assert.match(source, /\["daily-digest", "customer-reminders"\]/);
  assert.match(source, /\/api\/automation\/run/);
  assert.doesNotMatch(source, /console\.log\([^)]*secret/i);
});

// ------------------------------------------------------------------- step 2: in-app customer reminders

test("in-app reminders: T-5 / T-0 / T+3 in Baghdad days across month end, keyed per cycle so a renewal re-arms them", () => {
  // 06:00 Baghdad on 26 Nov → 1 Dec is T-5; on 3 Dec, 30 Nov is T+3.
  assert.equal(a.reminderFor("2026-12-01", at("2026-11-26T03:00:00Z")), "before-expiry");
  assert.equal(a.reminderFor("2026-11-30", at("2026-12-03T03:00:00Z")), "win-back");
  assert.equal(a.reminderFor("2026-12-31", at("2026-12-31T03:00:00Z")), "expiry-day");
  // 23:30 Baghdad on 25 Nov is still 25 Nov: not yet T-5 for 1 Dec.
  assert.equal(a.reminderFor("2026-12-01", at("2026-11-25T20:30:00Z")), null);

  assert.equal(a.reminderDedupeKey("before-expiry", 7, "2026-12-01T00:00:00Z"), "reminder:before-expiry:7:2026-12-01");
  assert.notEqual(a.reminderDedupeKey("before-expiry", 7, "2027-03-01"), a.reminderDedupeKey("before-expiry", 7, "2026-12-01"), "a renewed end date is a new cycle");
  assert.notEqual(a.reminderDedupeKey("before-expiry", 7, "2026-12-01"), a.whatsappDedupeKey("before-expiry", 7, "2026-12-01"), "separate from the owner's WhatsApp");
  assert.deepEqual(a.CUSTOMER_TEMPLATES, ["before-expiry", "expiry-day", "win-back"]);
});

test("in-app reminders: skip rules — suspended or cancelled, opted out; a renewal moves the end date so it is no longer due", () => {
  const base = { status: "ACTIVE", remindersOn: true };

  assert.equal(a.reminderSkip(base), null);
  assert.equal(a.reminderSkip({ ...base, status: "EXPIRED" }), null, "an expired subscription still gets its win-back");
  assert.equal(a.reminderSkip({ ...base, status: "suspended" }), "SUSPENDED");
  assert.equal(a.reminderSkip({ ...base, status: "CANCELLED" }), "SUSPENDED");
  assert.equal(a.reminderSkip({ ...base, remindersOn: false }), "OPTED_OUT");
  // Renewed from 1 Dec to 1 Mar: on 26 Nov nothing is due any more, and the new cycle has its own key.
  assert.equal(a.reminderFor("2027-03-01", at("2026-11-26T03:00:00Z")), null);
  assert.equal(a.reminderFor("2027-03-01", at("2027-02-24T03:00:00Z")), "before-expiry");
});

test("in-app reminders: text in Arabic first, with points and discount only when present, and the English twin", () => {
  const data = { packageName: "IPTV 4K", endDate: "2026-12-01", points: 0, discountLabel: null, openOrder: false };
  const plain = a.renderInAppReminder("before-expiry", data);

  assert.equal(plain.title, "اشتراكك ينتهي بعد 5 أيام");
  assert.match(plain.body, /«IPTV 4K» — ينتهي/);
  assert.match(plain.body, /جدّده هسه/);
  assert.doesNotMatch(plain.body, /نقطة|التجديد هسه عليه/);
  assert.equal(a.renderInAppReminder("expiry-day", data).title, "اشتراكك ينتهي اليوم");
  assert.equal(a.renderInAppReminder("win-back", data).title, "انتهى اشتراكك قبل 3 أيام");
  assert.match(a.renderInAppReminder("win-back", data).body, /انتهى .* اشتقنالك/);

  const rich = a.renderInAppReminder("expiry-day", { ...data, points: 25, discountLabel: "خصم 10%" });
  assert.match(rich.body, /التجديد هسه عليه خصم 10%/);
  assert.match(rich.body, /عندك 25 نقطة/);
  assert.match(a.renderInAppReminder("before-expiry", { ...data, openOrder: true }).body, /طلب التجديد مالتك جاهز/);

  const en = a.renderInAppReminder("before-expiry", { ...data, points: 25 }, "en");
  assert.equal(en.title, "Your subscription ends in 5 days");
  assert.match(en.body, /You have 25 Shashtna points/);
});

test("in-app reminders: the link opens the renewal checkout for that subscription and length, tagged with the outbox id; or the open order", () => {
  assert.equal(a.reminderLink({ subscriptionId: 12, optionId: 40, outboxId: 9, openOrderId: null }), "/checkout?renew=12&option=40&r=9");
  assert.equal(a.reminderLink({ subscriptionId: 12, optionId: null, outboxId: 9, openOrderId: null }), "/checkout?renew=12&r=9");
  assert.equal(a.reminderLink({ subscriptionId: 12, optionId: 40, outboxId: 9, openOrderId: 77 }), "/orders/77");

  assert.equal(a.reminderRef("9"), 9);
  assert.equal(a.reminderRef(" 123 "), 123);
  for (const value of ["", "0", "-1", "1.5", "abc", "9e3", "1234567890", null, undefined]) assert.equal(a.reminderRef(value), null, String(value));
});

test("in-app reminders: conversion is completed renewals over reminders sent; none sent → null", () => {
  const sent = { "before-expiry": 6, "expiry-day": 3, "win-back": 1 };
  const result = a.reminderConversion({ sent, started: 4, completed: 3, completedWithout: 5 });

  assert.equal(result.sent, 10);
  assert.equal(result.conversion, 30);
  assert.equal(result.completedWithout, 5);
  assert.equal(a.reminderConversion({ sent: { "before-expiry": 0, "expiry-day": 0, "win-back": 0 }, started: 0, completed: 0, completedWithout: 2 }).conversion, null);
  assert.equal(a.reminderConversion({ sent: { "before-expiry": 3, "expiry-day": 0, "win-back": 0 }, started: 1, completed: 1, completedWithout: 0 }).conversion, 33.3);
});

test("automation settings: the customer reminders switch is on/off like the others", () => {
  assert.equal(settingProblem("automation.job.customerReminders", "on"), null);
  assert.ok(settingProblem("automation.job.customerReminders", "maybe"));
  assert.deepEqual(a.JOBS, ["daily-digest", "customer-reminders"]);
});
