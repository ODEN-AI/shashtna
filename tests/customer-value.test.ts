import assert from "node:assert/strict";
import { test } from "node:test";

const f = await import("@/src/lib/finance");
const v = await import("@/src/lib/customer-value");

const order = (id: number, userId: number, price: number, at: string, extra: Record<string, unknown> = {}) => ({
  id,
  userId,
  status: "COMPLETED",
  requestType: "NEW",
  planSlug: "iptv",
  serviceType: "IPTV",
  serviceName: "IPTV",
  price,
  devicePrice: null,
  deviceName: null,
  createdAt: at,
  updatedAt: at,
  durationMonths: 3,
  ...extra,
});

// 10 customers (ids 1..10) paying 10k..100k once; customer 1 also renews; staff (99) buys; a reward never counts.
const orders = [
  ...Array.from({ length: 10 }, (_, i) => order(i + 1, i + 1, (i + 1) * 10_000, i < 5 ? "2026-09-10T10:00:00Z" : "2026-10-10T10:00:00Z")),
  order(11, 1, 5_000, "2026-11-01T10:00:00Z", { requestType: "RENEW" }),
  order(12, 99, 50_000, "2026-09-15T10:00:00Z"),
  order(13, 2, 0, "2026-11-02T10:00:00Z", { loyaltyReward: true }),
];
const sales = f.recognizeSales({ orders, receipts: [], paidAt: new Map() });

const result = v.customerValue({ sales, staffIds: new Set([99]), activeUserIds: new Set([1, 2, 10]), today: "2026-11-13" });

test("customer value: actual totals per customer; staff and loyalty rewards left out", () => {
  assert.equal(result.summary.payingCustomers, 10);
  assert.equal(result.summary.totalPaid, 550_000 + 5_000);
  assert.equal(result.rows.some((row) => row.userId === 99), false, "staff purchases are not customers");

  const one = result.rows.find((row) => row.userId === 1)!;
  assert.equal(one.totalPaid, 15_000);
  assert.equal(one.purchases, 2);
  assert.equal(one.firstPurchase, "2026-09-10");
  assert.equal(one.lastPurchase, "2026-11-01");
  assert.equal(one.monthsAsCustomer, 2);
  assert.equal(result.rows.find((row) => row.userId === 2)!.purchases, 1, "the reward isn't a purchase");
});

test("customer value: ranked by total paid; tiers are top 20%, next 30%, the rest", () => {
  assert.deepEqual(result.rows.slice(0, 3).map((row) => row.userId), [10, 9, 8]);
  assert.deepEqual(
    result.rows.map((row) => row.tier),
    ["TOP", "TOP", "MIDDLE", "MIDDLE", "MIDDLE", "BASE", "BASE", "BASE", "BASE", "BASE"],
  );
  assert.equal(result.tiers.TOP.customers, 2);
  assert.equal(result.tiers.TOP.revenue, 190_000);
  assert.equal(result.tiers.TOP.revenueSharePct, 34.2, "190,000 ÷ 555,000");
  assert.equal(result.tiers.TOP.minPaid, 90_000);
});

test("customer value: average, median, repeat buyers and active now", () => {
  assert.equal(result.summary.averagePaid, 55_500);
  assert.equal(result.summary.medianPaid, 55_000, "middle of 10 values: (50,000 + 60,000) ÷ 2");
  assert.equal(result.summary.repeatBuyers, 1);
  assert.equal(result.summary.activeNow, 3);
});

test("customer value: cohorts by first-purchase month, newest first", () => {
  assert.deepEqual(result.cohorts, [
    { month: "2026-10", customers: 5, revenue: 400_000, activeNow: 1, repeatBuyers: 0 },
    { month: "2026-09", customers: 5, revenue: 155_000, activeNow: 2, repeatBuyers: 1 },
  ]);
});

test("customer value: no sales gives an empty, honest result", () => {
  const none = v.customerValue({ sales: [], staffIds: new Set(), activeUserIds: new Set(), today: "2026-11-13" });

  assert.equal(none.summary.payingCustomers, 0);
  assert.equal(none.summary.averagePaid, null);
  assert.equal(none.summary.medianPaid, null);
  assert.equal(none.tiers.TOP.customers, 0);
  assert.deepEqual(none.cohorts, []);
});
