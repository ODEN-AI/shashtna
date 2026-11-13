import assert from "node:assert/strict";
import { test } from "node:test";

const f = await import("@/src/lib/finance");
const p = await import("@/src/lib/package-performance");

const range = { start: new Date("2026-10-01T00:00:00Z"), end: new Date("2026-11-01T00:00:00Z") };
const order = (extra: Record<string, unknown>) => ({
  id: 1,
  userId: 1,
  status: "COMPLETED",
  requestType: "NEW",
  planSlug: "iptv",
  serviceType: "IPTV",
  serviceName: "IPTV",
  price: 10_000,
  devicePrice: null,
  deviceName: null,
  createdAt: "2026-10-05T10:00:00Z",
  updatedAt: "2026-10-05T10:00:00Z",
  durationMonths: 3,
  ...extra,
});

const sales = f.recognizeSales({
  orders: [
    order({ id: 1, price: 10_000, creditCostIqd: 4_000, durationMonths: 3 }),
    order({ id: 2, price: 9_000, creditCostIqd: 4_000, discountIqd: 1_000, durationMonths: 3 }),
    order({ id: 3, price: 10_000, creditCostIqd: null, durationMonths: 3 }), // unknown cost
    order({ id: 4, price: 30_000, creditCostIqd: 12_000, durationMonths: 12 }),
    order({ id: 5, price: 15_000, channel: "SUPPLIER", creditCostIqd: 0, supplierShareIqd: 5_000, durationMonths: 6 }),
    order({ id: 6, planSlug: "vip", serviceType: "VIP", serviceName: "VIP", price: 50_000, devicePrice: 40_000, deviceName: "Box", durationMonths: 3 }),
    order({ id: 7, price: 0, loyaltyReward: true, durationMonths: 3 }), // reward: never a sale
    order({ id: 8, price: 10_000, creditCostIqd: 4_000, createdAt: "2026-11-05T10:00:00Z", updatedAt: "2026-11-05T10:00:00Z" }), // outside the range
    order({ id: 9, status: "CANCELLED" }),
  ],
  receipts: [],
  paidAt: new Map(),
});

test("package performance: one row per package and length; reward, cancelled and out-of-range orders left out", () => {
  const { rows } = p.packagePerformance(sales, range);

  assert.deepEqual(rows.map((row) => [row.product, row.durationMonths, row.units]), [
    ["package:vip", 3, 1],
    ["package:iptv", 12, 1], // 30,000: most revenue first, not most units
    ["package:iptv", 3, 3], // 29,000
    ["package:iptv", 6, 1],
  ]);
});

test("package performance: profit only on known costs; unknown cost counted apart, never as zero", () => {
  const { rows } = p.packagePerformance(sales, range);
  const three = rows.find((row) => row.product === "package:iptv" && row.durationMonths === 3)!;

  assert.equal(three.revenue, 29_000);
  assert.equal(three.averagePrice, 9_667);
  assert.equal(three.knownCostUnits, 2);
  assert.equal(three.creditCost, 8_000);
  assert.equal(three.profit, 11_000, "(10,000 − 4,000) + (9,000 − 4,000)");
  assert.equal(three.marginPct, 57.9, "11,000 ÷ 19,000");
  assert.equal(three.unknownCostUnits, 1);
  assert.equal(three.unknownCostRevenue, 10_000);
  assert.equal(three.discount, 1_000);
  assert.equal(three.discountedUnits, 1);
});

test("package performance: supplier share is taken off; a VIP device is not package revenue", () => {
  const { rows, total } = p.packagePerformance(sales, range);
  const supplier = rows.find((row) => row.durationMonths === 6)!;
  const vip = rows.find((row) => row.product === "package:vip")!;

  assert.equal(supplier.profit, 10_000, "15,000 − 0 credit − 5,000 supplier share");
  assert.equal(supplier.supplierShare, 5_000);
  assert.equal(vip.revenue, 50_000, "the 40,000 device line is not in the package row");
  assert.equal(vip.marginPct, null, "no known cost → no margin");
  assert.equal(total.units, 6);
  assert.equal(total.revenue, 29_000 + 30_000 + 15_000 + 50_000);
  assert.equal(total.profit, 11_000 + 18_000 + 10_000);
  assert.equal(total.unknownCostUnits, 2);
});

test("package performance: receipt-only sales keep their length", () => {
  const fromReceipt = f.recognizeSales({ orders: [], receipts: [{ id: 1, orderId: null, userId: 2, price: 8_000, serviceName: "IPTV 3", serviceType: "IPTV", createdAt: "2026-10-10T10:00:00Z", durationMonths: 3 }], paidAt: new Map() });
  const { rows } = p.packagePerformance(fromReceipt, range);

  assert.equal(rows[0].durationMonths, 3);
  assert.equal(rows[0].unknownCostUnits, 1);
});

test("package performance: the most profitable package needs a clear, known-cost leader", () => {
  const { rows } = p.packagePerformance(sales, range);

  assert.equal(p.mostProfitable(rows)?.durationMonths, 3, "the only row with 2+ known-cost sales");
  assert.equal(p.mostProfitable(rows.filter((row) => row.durationMonths !== 3)), null, "single sales are too thin");
  assert.equal(p.mostProfitable([]), null);
});
