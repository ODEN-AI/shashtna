import assert from "node:assert/strict";
import { test } from "node:test";

const a = await import("@/src/lib/bi-audit");

test("bi audit: one receipt rebuilds start + months (bonus months are already in the receipt)", () => {
  assert.equal(a.replayExpiry("2026-01-31", [{ durationMonths: 1, createdAt: "2026-01-31T10:00:00Z" }]), "2026-02-28", "month-end clamped like activation");
  assert.equal(a.replayExpiry("2026-01-10", [{ durationMonths: 36, createdAt: "2026-01-10T10:00:00Z" }]), "2029-01-10");
  assert.equal(a.replayExpiry("2026-01-10", []), null);
});

test("bi audit: an early renewal extends the running expiry; a late one starts on the paid day (Baghdad)", () => {
  const early = a.replayExpiry("2026-01-01", [
    { durationMonths: 3, createdAt: "2026-01-01T09:00:00Z" },
    { durationMonths: 3, createdAt: "2026-03-20T09:00:00Z" },
  ]);
  assert.equal(early, "2026-07-01");

  const late = a.replayExpiry("2026-01-01", [
    { durationMonths: 3, createdAt: "2026-01-01T09:00:00Z" },
    { durationMonths: 3, createdAt: "2026-05-10T22:30:00Z" }, // 01:30 on 11 May in Baghdad
  ]);
  assert.equal(late, "2026-08-11");

  const unordered = a.replayExpiry("2026-01-01", [
    { durationMonths: 3, createdAt: "2026-03-20T09:00:00Z" },
    { durationMonths: 3, createdAt: "2026-01-01T09:00:00Z" },
  ]);
  assert.equal(unordered, "2026-07-01", "receipts are replayed in date order");
});

test("bi audit: counts, replay buckets, gaps and the verdict — never names or ids", () => {
  const subscriptions = [
    { id: 1, userId: 10, serviceType: "IPTV", status: "ACTIVE", startDate: "2026-01-01", expiryDate: "2026-07-01", createdAt: "2026-01-01T00:00:00Z" }, // exact
    { id: 2, userId: 11, serviceType: "IPTV", status: "ACTIVE", startDate: "2026-02-01", expiryDate: "2026-05-04", createdAt: "2026-02-01T00:00:00Z" }, // close (3 days)
    { id: 3, userId: 12, serviceType: "VIP", status: "ACTIVE", startDate: "2026-02-01", expiryDate: "2027-02-01", createdAt: "2026-02-01T00:00:00Z" }, // off (manual edit)
    { id: 4, userId: 12, serviceType: "VIP", status: "EXPIRED", startDate: "2025-01-01", expiryDate: "2025-04-01", createdAt: "2025-01-01T00:00:00Z" }, // no receipts
  ];
  const receipts = [
    { subscriptionId: 1, durationMonths: 3, createdAt: "2026-01-01T09:00:00Z", orderId: 100 },
    { subscriptionId: 1, durationMonths: 3, createdAt: "2026-03-20T09:00:00Z", orderId: 101 },
    { subscriptionId: 2, durationMonths: 3, createdAt: "2026-02-01T09:00:00Z", orderId: 102 },
    { subscriptionId: 3, durationMonths: 3, createdAt: "2026-02-01T09:00:00Z", orderId: null },
    { subscriptionId: 99, durationMonths: 3, createdAt: "2026-02-01T09:00:00Z", orderId: null },
  ];
  const orders = [
    { id: 100, status: "COMPLETED", requestType: "NEW", channel: "SITE", subscriptionId: 1, loyaltyReward: false },
    { id: 101, status: "COMPLETED", requestType: "RENEW", channel: "SUPPLIER", subscriptionId: 1, loyaltyReward: false },
    { id: 102, status: "COMPLETED", requestType: "NEW", channel: "SITE", subscriptionId: 2, loyaltyReward: false },
    { id: 103, status: "COMPLETED", requestType: "RENEW", channel: "SITE", subscriptionId: null, loyaltyReward: true },
    { id: 104, status: "COMPLETED", requestType: "DEVICE_PURCHASE", channel: "SITE", subscriptionId: null, loyaltyReward: false },
    { id: 105, status: "CANCELLED", requestType: "NEW", channel: "SITE", subscriptionId: null, loyaltyReward: false },
  ];
  const events = [
    { action: "SUBSCRIPTION_UPDATED", entityId: "3" },
    { action: "SUBSCRIPTION_UPDATED", entityId: "3" },
    { action: "ORDER_COMPLETED", entityId: "100" },
  ];

  const result = a.buildAudit({ subscriptions, receipts, orders, events }, "2026-06-01");

  assert.deepEqual(result.history.replay, { exact: 1, close: 1, off: 1, noReceipts: 1, exactOrClosePct: 66.7 });
  assert.equal(result.history.coveragePct, 50);
  assert.equal(result.verdict, "PARTIAL");
  assert.deepEqual(result.history.receiptsPerSubscription, { one: 2, two: 1, threeOrMore: 0 });
  assert.deepEqual(result.subscriptions.byService, { IPTV: 2, VIP: 2, DIGITAL: 0, other: 0 });
  assert.equal(result.subscriptions.expiredNow, 2, "current expiry before today");
  assert.equal(result.subscriptions.customersWithSeveralOfOneService, 1);
  assert.equal(result.receipts.forUnknownSubscription, 1);
  assert.equal(result.receipts.withoutOrder, 2);
  assert.deepEqual(result.orders.completedByType, { NEW: 2, RENEW: 2, UPGRADE: 0, DEVICE_PURCHASE: 1, other: 0 });
  assert.equal(result.orders.completedWithoutSubscription, 1, "device purchases don't count");
  assert.equal(result.orders.completedWithoutReceipt, 1);
  assert.equal(result.orders.supplierCompleted, 1);
  assert.equal(result.orders.rewardCompleted, 1);
  assert.deepEqual(result.manualEdits, { events: 2, subscriptions: 1 });

  const text = JSON.stringify(result);
  assert.doesNotMatch(text, /"(id|userId|subscriptionId|orderId|name|phone)"/, "no ids or personal fields in the output");
});

test("bi audit: verdict thresholds", () => {
  assert.equal(a.auditVerdict(95), "FULL");
  assert.equal(a.auditVerdict(90), "FULL");
  assert.equal(a.auditVerdict(60), "PARTIAL");
  assert.equal(a.auditVerdict(10), "FORWARD_ONLY");
  assert.equal(a.auditVerdict(0), "FORWARD_ONLY");
});
