import assert from "node:assert/strict";
import { test } from "node:test";

const time = await import("@/src/lib/business-time");
const fin = await import("@/src/lib/finance");

const order = (id: number, extra: Record<string, unknown> = {}) => ({
  id,
  userId: 1,
  status: "COMPLETED",
  requestType: "NEW",
  planSlug: "iptv-1y",
  serviceType: "IPTV",
  serviceName: "IPTV سنة",
  price: 35000,
  devicePrice: null,
  deviceName: null,
  createdAt: "2026-09-01T10:00:00Z",
  updatedAt: "2026-09-02T10:00:00Z",
  ...extra,
});

test("business periods use the Baghdad calendar (UTC+3), weeks start Saturday", () => {
  // 2026-10-01 00:30 Baghdad = 2026-09-30 21:30 UTC — already October in Iraq.
  const now = new Date("2026-09-30T21:30:00Z");
  assert.equal(time.businessDay(now), "2026-10-01");
  assert.equal(time.startOfDay(now).toISOString(), "2026-09-30T21:00:00.000Z");
  assert.equal(time.startOfMonth(now).toISOString(), "2026-09-30T21:00:00.000Z");
  assert.equal(time.startOfYear(now).toISOString(), "2025-12-31T21:00:00.000Z");
  // 2026-10-01 is a Thursday → week began Saturday 2026-09-26.
  assert.equal(time.businessDay(time.startOfWeek(now)), "2026-09-26");
});

test("current periods compare with the same elapsed part of the previous period", () => {
  const now = new Date("2026-09-15T09:00:00Z");
  const { current, previous } = time.resolveRange("month", now);
  assert.equal(time.businessDay(current.start), "2026-09-01");
  assert.equal(time.businessDay(previous.start), "2026-08-01");
  assert.equal(previous.end.getTime() - previous.start.getTime(), current.end.getTime() - current.start.getTime());
  const custom = time.resolveRange("custom", now, { from: "2026-09-01", to: "2026-09-10" });
  assert.equal(custom.current.end.getTime() - custom.current.start.getTime(), 10 * 86400000);
  assert.equal(time.businessDay(custom.previous.start), "2026-08-22");
  assert.equal(time.businessDay(time.resolveRange("custom", now, { from: "bad", to: "x" }).current.start), "2026-09-01", "invalid custom → this month");
});

test("revenue: paid orders only, receipts win over list price, device counted once", () => {
  const sales = fin.recognizeSales({
    orders: [
      order(1, { status: "COMPLETED" }),
      order(2, { status: "SUBMITTED" }),
      order(3, { status: "CANCELLED" }),
      order(4, { status: "PAID", planSlug: "vip-3m", serviceType: "VIP", serviceName: "VIP 3", price: 45000, devicePrice: 80000, deviceName: "صندوق VIP 4K" }),
      order(5, { status: "COMPLETED", requestType: "DEVICE_PURCHASE", planSlug: "device:box", serviceType: "DEVICE", serviceName: "صندوق VIP 4K", price: 80000, devicePrice: 80000, deviceName: "صندوق VIP 4K" }),
      order(6, { status: "ACCEPTED" }),
    ],
    receipts: [
      { id: 10, orderId: 1, userId: 1, price: 30000, serviceName: "IPTV سنة", serviceType: "IPTV", createdAt: "2026-09-03T10:00:00Z" },
      { id: 11, orderId: null, userId: 2, price: 20000, serviceName: "قديم", serviceType: "IPTV", createdAt: "2026-08-15T10:00:00Z" },
    ],
    paidAt: new Map([[1, "2026-09-02T08:00:00Z"]]),
  });
  const byKey = new Map(sales.map((sale) => [sale.key, sale]));
  assert.equal(byKey.has("order:2"), false, "unpaid orders are not revenue");
  assert.equal(byKey.has("order:3"), false, "cancelled orders are not revenue");
  assert.equal(byKey.get("order:1")?.amount, 30000, "the issued receipt amount is used");
  assert.equal(byKey.get("order:1")?.at.toISOString(), "2026-09-02T08:00:00.000Z", "dated at payment confirmation");
  assert.equal(byKey.get("order:4")?.amount, 125000, "plan + device");
  assert.equal(byKey.get("order:5")?.amount, 80000, "device-only order counted once");
  assert.equal(byKey.get("order:6")?.amount, 35000, "legacy ACCEPTED counts as completed");
  assert.equal(byKey.get("receipt:11")?.amount, 20000, "unlinked receipts count on their own date");
  const all = { start: new Date("2026-01-01T00:00:00Z"), end: new Date("2027-01-01T00:00:00Z") };
  assert.deepEqual(fin.sumSales(sales, all), { amount: 30000 + 125000 + 80000 + 35000 + 20000, count: 5 });
});

test("net profit is never invented: incomplete until expenses are recorded", () => {
  assert.deepEqual(fin.netProfit(100000, 0, false), { status: "incomplete", reason: "NO_EXPENSES_RECORDED" });
  assert.deepEqual(fin.netProfit(100000, 30000, true), { status: "ok", amount: 70000 });
  assert.equal(fin.percentChange(120, 100), 20);
  assert.equal(fin.percentChange(5, 0), null, "no base → no percentage");
});

test("product performance, most sold and breakdown use real lines only", () => {
  const range = { start: new Date("2026-09-01T00:00:00Z"), end: new Date("2026-10-01T00:00:00Z") };
  const sales = fin.recognizeSales({
    orders: [order(1), order(2), order(3, { planSlug: "vip-3m", serviceName: "VIP 3", price: 45000 })],
    receipts: [],
    paidAt: new Map(),
  });
  const rows = fin.productPerformance(sales, range);
  assert.equal(rows[0].product, "package:iptv-1y");
  assert.equal(rows[0].units, 2);
  assert.equal(rows[0].revenue, 70000);
  assert.equal(Math.round(rows[0].share), 61);
  assert.equal(rows[0].averageOrderValue, 35000);
  assert.equal(fin.mostSold(rows)?.product, "package:iptv-1y");
  assert.equal(fin.mostSold(rows.map((row) => ({ ...row, units: 2 }))), null, "a tie is not a most-sold");
  assert.equal(fin.mostSold(rows, 5), null, "not enough sales data");
  assert.equal(fin.revenueBreakdown(rows, 1).at(-1)?.label, "OTHER");
});

test("expenses are summed by range and category; trend buckets cover the range", () => {
  const expenses = [
    { id: 1, amount: 10000, category: "HOSTING", spentOn: "2026-09-05" },
    { id: 2, amount: 5000, category: "ADVERTISING", spentOn: "2026-09-20" },
    { id: 3, amount: 7000, category: "HOSTING", spentOn: "2026-08-20" },
  ];
  const sept = { start: time.parseBusinessDay("2026-09-01")!, end: time.parseBusinessDay("2026-10-01")! };
  assert.equal(fin.sumExpenses(expenses, sept), 15000);
  assert.equal(fin.sumExpenses(expenses, sept, "HOSTING"), 10000);
  const points = fin.trendSeries([], expenses, sept, "day");
  assert.equal(points.length, 30);
  assert.equal(points.find((point) => point.key === "2026-09-05")?.expenses, 10000);
  assert.equal(points.find((point) => point.key === "2026-09-05")?.profit, -10000);
});
