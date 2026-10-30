import assert from "node:assert/strict";
import { test } from "node:test";

const costs = await import("@/src/lib/costs");
const { earnBlock, missedAwards } = await import("@/src/lib/loyalty");
const { parsePackageOptions } = await import("@/src/lib/package-options");
const { recognizeSales, costProfit } = await import("@/src/lib/finance");

const purchase = { id: 7, creditCents: 20000, iqdPaid: 180000, purchasedOn: "2026-10-30T09:00:00.000Z" }; // $200 for 180,000 IQD

test("dollars become whole cents; anything else is refused", () => {
  assert.equal(costs.dollarsToCents("200"), 20000);
  assert.equal(costs.dollarsToCents("1.5"), 150);
  assert.equal(costs.dollarsToCents("0.25"), 25);
  assert.equal(costs.dollarsToCents(" 8 "), 800);
  for (const bad of ["-1", "1.234", "abc", "", "1,5", "1e3"]) assert.equal(costs.dollarsToCents(bad), null, bad);
  assert.equal(costs.centsToDollars(20000), "200");
  assert.equal(costs.centsToDollars(150), "1.50");
});

test("the rate is the latest purchase: 900 IQD per credit dollar", () => {
  assert.equal(costs.rateIqdPerUsd(purchase), 900);
  const older = { id: 3, creditCents: 10000, iqdPaid: 95000, purchasedOn: "2026-09-01T09:00:00.000Z" };
  const sameDayLater = { id: 9, creditCents: 10000, iqdPaid: 91000, purchasedOn: "2026-10-30T09:00:00.000Z" };
  assert.equal(costs.currentRate([older, purchase])?.id, 7);
  assert.equal(costs.currentRate([purchase, sameDayLater, older])?.id, 9, "same day: the newer entry wins");
  assert.equal(costs.currentRate([]), null);
});

test("an order's credit cost at the rate: 3m $1 = 900, 6m $2 = 1,800, 1y $4 = 3,600, 2y $8 = 7,200", () => {
  assert.deepEqual([100, 200, 400, 800].map((cents) => costs.creditCostIqd(cents, purchase)), [900, 1800, 3600, 7200]);
  // A rate that isn't a whole number rounds the cost to the dinar.
  assert.equal(costs.creditCostIqd(100, { creditCents: 30000, iqdPaid: 271000 }), 903);
});

test("cost snapshot: known, unknown (no credit or no purchase), and the supplier's known zero", () => {
  assert.deepEqual(costs.costSnapshot("SITE", 200, purchase), { creditCostCents: 200, creditCostIqd: 1800, creditPurchaseId: 7 });
  assert.deepEqual(costs.costSnapshot("SITE", null, purchase), { creditCostCents: null, creditCostIqd: null, creditPurchaseId: null });
  assert.deepEqual(costs.costSnapshot("SITE", 200, null), { creditCostCents: null, creditCostIqd: null, creditPurchaseId: null });
  assert.deepEqual(costs.costSnapshot("SUPPLIER", 200, purchase), { creditCostCents: 0, creditCostIqd: 0, creditPurchaseId: null });
  assert.equal(costs.costSnapshot("SITE", 0, purchase).creditCostIqd, 0, "a length set to $0 is a known zero");
});

test("credit purchase validation: integers only, positive, a real date", () => {
  assert.deepEqual(costs.parseCreditPurchase({ purchasedOn: "2026-10-30", creditUsd: "200", iqdPaid: "180,000", note: " panel " }), {
    ok: true,
    value: { purchasedOn: "2026-10-30", creditCents: 20000, iqdPaid: 180000, note: "panel" },
  });
  assert.equal(costs.parseCreditPurchase({ purchasedOn: "2026-10-30", creditUsd: "0", iqdPaid: "1" }).ok, false);
  assert.equal(costs.parseCreditPurchase({ purchasedOn: "2026-10-30", creditUsd: "10", iqdPaid: "1.5" }).ok, false);
  assert.equal(costs.parseCreditPurchase({ purchasedOn: "2026-10-30", creditUsd: "10", iqdPaid: "-5" }).ok, false);
  assert.equal(costs.parseCreditPurchase({ purchasedOn: "30/10/2026", creditUsd: "10", iqdPaid: "9000" }).ok, false);
});

test("supplier order: defaults are valid, the share can't exceed the price, a new one needs a username", () => {
  const ok = costs.parseSupplierOrder({ months: "24", price: "15000", supplierShare: "10000", username: "abc" });
  assert.ok(ok.ok);
  assert.deepEqual(ok.value, { months: 24, price: 15000, supplierShare: 10000, username: "abc", password: null, macAddress: null, subscriptionId: null });
  assert.equal(costs.parseSupplierOrder({ months: "24", price: "15000", supplierShare: "15001", username: "abc" }).ok, false);
  assert.equal(costs.parseSupplierOrder({ months: "61", price: "15000", supplierShare: "0", username: "abc" }).ok, false);
  assert.equal(costs.parseSupplierOrder({ months: "24", price: "0", supplierShare: "0", username: "abc" }).ok, false);
  assert.equal(costs.parseSupplierOrder({ months: "24", price: "15000.5", supplierShare: "0", username: "abc" }).ok, false);
  assert.equal(costs.parseSupplierOrder({ months: "24", price: "15000", supplierShare: "10000", username: "" }).ok, false);
  assert.ok(costs.parseSupplierOrder({ months: "24", price: "15000", supplierShare: "10000", username: "", subscriptionId: "12" }).ok, "a renewal keeps its credentials");
});

test("supplier-channel orders never earn loyalty points, and are never a missed award", () => {
  const order = { serviceType: "IPTV", requestType: "NEW", price: 15000, status: "COMPLETED", loyaltyReward: false };
  assert.equal(earnBlock({ ...order, channel: "SITE" }), null);
  assert.equal(earnBlock({ ...order }), null, "older rows default to SITE");
  assert.equal(earnBlock({ ...order, channel: "SUPPLIER" }), "SUPPLIER");
  const intervals = [{ from: Date.parse("2026-10-01T00:00:00Z"), to: null }];
  const rows = [{ id: 1, ...order, channel: "SUPPLIER" }, { id: 2, ...order, channel: "SITE" }];
  const at = new Map([[1, "2026-10-31T00:00:00Z"], [2, "2026-10-31T00:00:00Z"]]);
  assert.deepEqual(missedAwards(rows, at, new Set(), intervals).map((row) => row.id), [2]);
});

test("profit by channel: revenue − credit − supplier share; unknown cost is flagged, never zero", () => {
  const split = costs.profitByChannel([
    { amount: 15000, channel: "SITE", costIqd: 3600, supplierShareIqd: null },
    { amount: 6000, channel: "SITE", costIqd: null, supplierShareIqd: null },
    { amount: 15000, channel: "SUPPLIER", costIqd: 0, supplierShareIqd: 10000 },
  ]);

  assert.deepEqual(split.site, { sales: 2, revenue: 21000, creditCost: 3600, supplierShare: 0, netProfit: 11400, unknownCostSales: 1, unknownCostRevenue: 6000 });
  assert.deepEqual(split.supplier, { sales: 1, revenue: 15000, creditCost: 0, supplierShare: 10000, netProfit: 5000, unknownCostSales: 0, unknownCostRevenue: 0 });
  assert.deepEqual(split.total, { sales: 3, revenue: 36000, creditCost: 3600, supplierShare: 10000, netProfit: 16400, unknownCostSales: 1, unknownCostRevenue: 6000 });
});

test("recognised sales carry the channel and cost; old orders and unlinked receipts are unknown cost", () => {
  const base = { userId: 1, planSlug: "iptv", serviceType: "IPTV", serviceName: "IPTV", devicePrice: null, deviceName: null, createdAt: "2026-10-30T10:00:00Z", updatedAt: "2026-10-30T11:00:00Z", requestType: "NEW", status: "COMPLETED" };
  const sales = recognizeSales({
    orders: [
      { ...base, id: 1, price: 15000, creditCostIqd: 3600 },
      { ...base, id: 2, price: 6000 },
      { ...base, id: 3, price: 15000, channel: "SUPPLIER", creditCostIqd: 0, supplierShareIqd: 10000 },
    ],
    receipts: [{ id: 9, orderId: null, userId: 1, price: 10000, serviceName: "old", serviceType: "IPTV", createdAt: "2026-10-30T12:00:00Z" }],
    paidAt: new Map(),
  });

  assert.deepEqual(
    sales.map((sale) => [sale.key, sale.channel, sale.costIqd, sale.supplierShareIqd]),
    [
      ["order:1", "SITE", 3600, null],
      ["order:2", "SITE", null, null],
      ["order:3", "SUPPLIER", 0, 10000],
      ["receipt:9", "SITE", null, null],
    ],
  );
  const range = { start: new Date("2026-10-01T00:00:00Z"), end: new Date("2026-11-01T00:00:00Z") };
  assert.equal(costProfit(sales, range).total.netProfit, 15000 - 3600 + 15000 - 10000);
  assert.equal(costProfit(sales, range).total.unknownCostSales, 2);
});

test("the package form's credit per length: cents or empty; VIP keeps its own", () => {
  const iptv = parsePackageOptions(
    [
      { durationValue: 3, durationUnit: "MONTH", price: 6000, creditCostCents: 100 },
      { durationValue: 6, durationUnit: "MONTH", price: 10000, creditCostCents: null },
      { durationValue: 1, durationUnit: "YEAR", price: 15000 },
    ],
    "IPTV",
  );
  assert.ok(iptv.ok);
  assert.deepEqual(iptv.options.map((option) => option.creditCostCents), [100, null, undefined]);
  assert.equal(parsePackageOptions([{ durationValue: 3, durationUnit: "MONTH", price: 6000, creditCostCents: "1.5" }], "IPTV").ok, false);
  assert.equal(parsePackageOptions([{ durationValue: 3, durationUnit: "MONTH", price: 6000, creditCostCents: 1.5 }], "IPTV").ok, false);
  const vip = parsePackageOptions([{ price: 35000, creditCostCents: 1500 }], "VIP");
  assert.ok(vip.ok);
  assert.equal(vip.options[0].creditCostCents, 1500);
});

test("real costs migration: additive only, chained after loyalty, the db ref points at it", async () => {
  const { readFileSync } = await import("node:fs");
  const read = (path: string) => JSON.parse(readFileSync(new URL(`../migrations/app/${path}`, import.meta.url), "utf8"));
  const ops: { id: string; operationClass: string }[] = read("20261030T2329_real_costs/ops.json");

  assert.ok(ops.every((op) => op.operationClass === "additive"), "nothing dropped, rewritten or backfilled");
  for (const id of ["table.creditPurchase", "column.public.packageOption.creditCostCents", "column.public.subscriptionRequest.channel", "column.public.subscriptionRequest.supplierShareIqd", "column.public.subscriptionRequest.creditCostIqd", "column.public.subscriptionRequest.creditPurchaseId", "column.public.subscriptionRequest.creditCostCents"]) {
    assert.ok(ops.some((op) => op.id === id), id);
  }

  const migration = read("20261030T2329_real_costs/migration.json");
  assert.equal(migration.from, read("20261030T1747_loyalty_points/migration.json").to);
  assert.equal(migration.to, read("refs/db.json").hash);
});
