import assert from "node:assert/strict";
import { test } from "node:test";

const push = await import("@/src/lib/push");

const DAY = 24 * 60 * 60 * 1000;
const day = (offset: number) => new Date(Date.now() + offset * DAY).toISOString().slice(0, 10);

const data = {
  users: [
    { id: 1, marketingOptIn: true },
    { id: 2, marketingOptIn: false },
    { id: 3, marketingOptIn: false },
    { id: 4, marketingOptIn: true },
    { id: 5, marketingOptIn: false },
  ],
  subscriptions: [
    { userId: 1, status: "ACTIVE", expiryDate: day(100) },
    { userId: 2, status: "ACTIVE", expiryDate: day(3) },
    { userId: 3, status: "ACTIVE", expiryDate: day(-10) },
    { userId: 4, status: "SUSPENDED", expiryDate: day(50) },
  ],
  orders: [
    { id: 10, userId: 3, status: "SUBMITTED" },
    { id: 11, userId: 4, status: "AWAITING_PAYMENT" },
    { id: 12, userId: 5, status: "PAID" },
    { id: 13, userId: 1, status: "COMPLETED" },
    { id: 14, userId: 2, status: "PENDING" },
  ],
  ordersWithProof: new Set([11]),
};

test("audiences resolve from real subscription and order state", () => {
  assert.deepEqual(push.resolveAudience("ALL", "MESSAGE", data), [1, 2, 3, 4, 5]);
  assert.deepEqual(push.resolveAudience("ACTIVE_SUBSCRIBERS", "MESSAGE", data), [1, 2]);
  assert.deepEqual(push.resolveAudience("EXPIRING", "MESSAGE", data), [2]);
  assert.deepEqual(push.resolveAudience("PENDING_ORDERS", "MESSAGE", data), [2, 3, 4, 5]);
  // Order 11 already has a proof, so user 4 is under review, not awaiting payment.
  assert.deepEqual(push.resolveAudience("AWAITING_PAYMENT", "MESSAGE", data), [2, 3]);
});

test("a specific customer gets exactly one recipient, and only if the account exists", () => {
  assert.deepEqual(push.resolveAudience("CUSTOMER", "MESSAGE", data, { targetUserId: 3 }), [3]);
  assert.deepEqual(push.resolveAudience("CUSTOMER", "MESSAGE", data, { targetUserId: 99 }), []);
  assert.deepEqual(push.resolveAudience("CUSTOMER", "MESSAGE", data), []);
});

test("offers to a group only reach customers who opted in", () => {
  assert.deepEqual(push.resolveAudience("ALL", "OFFER", data), [1, 4]);
  assert.deepEqual(push.resolveAudience("ACTIVE_SUBSCRIBERS", "OFFER", data), [1]);
  // A one-to-one offer from staff is a direct message, not marketing.
  assert.deepEqual(push.resolveAudience("CUSTOMER", "OFFER", data, { targetUserId: 2 }), [2]);
});

test("broadcast permission is enforced per role", () => {
  assert.ok(push.canSendToAudience("OWNER", "ALL"));
  assert.ok(push.canSendToAudience("ADMIN", "EXPIRING"));
  assert.ok(push.canSendToAudience("OPERATOR", "ALL"));
  assert.ok(push.canSendToAudience("CONTENT", "ALL"));
  assert.ok(push.canSendToAudience("SUPPORT", "CUSTOMER"));
  assert.ok(!push.canSendToAudience("SUPPORT", "ALL"));
  assert.ok(!push.canSendToAudience("CUSTOMER", "CUSTOMER"));
  assert.ok(!push.canSendToAudience("", "CUSTOMER"));
});

test("push payloads carry a typed link, never arbitrary data", () => {
  const message = push.buildPushMessage("ExponentPushToken[abcdefghijklmnop]", {
    id: 55,
    type: "ORDER_STATUS",
    title: "تحديث الطلب",
    body: "تم الدفع",
    link: "/orders/12",
    imageUrl: "https://cdn.example/x.jpg",
  });

  assert.equal(message.to, "ExponentPushToken[abcdefghijklmnop]");
  assert.deepEqual(message.data, { notificationId: 55, type: "ORDER_STATUS", link: "/orders/12" });
  assert.equal(message.channelId, "account");
  assert.equal(message.priority, "high");
  assert.deepEqual(message.richContent, { image: "https://cdn.example/x.jpg" });

  const offer = push.buildPushMessage("ExponentPushToken[abcdefghijklmnop]", {
    id: 1,
    type: "OFFER",
    title: "t",
    body: "b",
    link: null,
    imageUrl: "http://insecure.example/x.jpg",
  });

  assert.equal(offer.channelId, "offers");
  assert.equal(offer.richContent, undefined);
});

test("only Expo push tokens are accepted", () => {
  assert.ok(push.isExpoPushToken("ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]"));
  assert.ok(push.isExpoPushToken("ExpoPushToken[xxxxxxxxxxxxxxxxxxxxxx]"));
  assert.ok(!push.isExpoPushToken("fcm-raw-token"));
  assert.ok(!push.isExpoPushToken("ExponentPushToken[]"));
  assert.ok(!push.isExpoPushToken(42));
});

test("chunking and permanent token errors", () => {
  assert.deepEqual(push.chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.ok(push.isPermanentTokenError("DeviceNotRegistered"));
  assert.ok(!push.isPermanentTokenError("MessageRateExceeded"));
});
