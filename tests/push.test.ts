import assert from "node:assert/strict";
import { test } from "node:test";

const p = await import("@/src/lib/push");

const TOKEN = "ExponentPushToken[abcDEF123456_-xyz]";

test("push: Expo tokens are checked; anything else is refused", () => {
  assert.equal(p.isExpoToken(TOKEN), true);
  assert.equal(p.isExpoToken("ExpoPushToken[abcDEF123456]"), true);
  assert.equal(p.isExpoToken("ExponentPushToken[]"), false);
  assert.equal(p.isExpoToken("fcm:abcdef"), false);
  assert.equal(p.isExpoToken(`ExponentPushToken[${"a".repeat(181)}]`), false);
  assert.equal(p.isExpoToken(42), false);
  assert.equal(p.maskToken(TOKEN).endsWith("…"), true);
  assert.equal(p.maskToken(TOKEN).includes("xyz"), false, "never the full token");
});

test("push: the app's registration body is validated and cleaned", () => {
  assert.deepEqual(p.checkDeviceInput({ token: TOKEN, platform: "android", deviceName: "  Galaxy   A15 ", appVersion: "2.0.0" }), {
    ok: true,
    value: { token: TOKEN, platform: "ANDROID", deviceName: "Galaxy A15", appVersion: "2.0.0" },
  });
  assert.equal(p.checkDeviceInput({ token: "bad", platform: "ANDROID" }).ok, false);
  assert.equal(p.checkDeviceInput({ token: TOKEN, platform: "WEB" }).ok, false);
  const missing = p.checkDeviceInput({ token: TOKEN, platform: "IOS" });
  assert.equal(missing.ok && missing.value.deviceName, null);
});

test("push: notification types map to the app's three Android channels", () => {
  assert.equal(p.channelFor("ORDER_STATUS"), "account");
  assert.equal(p.channelFor("RENEWAL_REMINDER"), "account");
  assert.equal(p.channelFor("CHAT_REPLY"), "account");
  assert.equal(p.channelFor("INCIDENT"), "service");
  assert.equal(p.channelFor("OFFER"), "offers");
  assert.equal(p.channelFor("ANNOUNCEMENT"), "offers");
});

test("push: messages carry the in-app notification's title, text and link", () => {
  const [message] = p.buildMessages([TOKEN], { id: 7, type: "ORDER_STATUS", title: "تم تأكيد الدفع", body: "x".repeat(400), link: "/orders/12" });

  assert.equal(message.to, TOKEN);
  assert.equal(message.title, "تم تأكيد الدفع");
  assert.equal(message.body.length, 300);
  assert.deepEqual(message.data, { notificationId: 7, type: "ORDER_STATUS", link: "/orders/12" });
  assert.equal(message.channelId, "account");
  assert.equal(message.priority, "high");
  assert.equal(p.buildMessages([TOKEN], { id: 8, type: "OFFER", title: "t", body: "b", link: null })[0].priority, "normal");
});

test("push: batches of 100", () => {
  assert.deepEqual(p.chunk(Array.from({ length: 250 }, (_, i) => i)).map((batch) => batch.length), [100, 100, 50]);
  assert.deepEqual(p.chunk([]), []);
});

test("push: Expo tickets — ok, gone (DeviceNotRegistered), other errors, malformed answers", () => {
  const tokens = ["A", "B", "C"];
  const outcomes = p.readTickets(tokens, {
    data: [{ status: "ok", id: "1" }, { status: "error", message: "x", details: { error: "DeviceNotRegistered" } }, { status: "error", details: { error: "MessageRateExceeded" } }],
  });

  assert.deepEqual(outcomes, [
    { token: "A", ok: true, gone: false, error: null },
    { token: "B", ok: false, gone: true, error: "DeviceNotRegistered" },
    { token: "C", ok: false, gone: false, error: "MessageRateExceeded" },
  ]);
  assert.ok(p.readTickets(tokens, null).every((outcome) => !outcome.ok && !outcome.gone));
  assert.equal(p.readTickets(tokens, { data: [{ status: "ok" }] })[1].error, "NO_TICKET");
});
