import assert from "node:assert/strict";
import { test } from "node:test";

const d = await import("@/src/lib/discounts");
const { recognizeSales, discountTotals } = await import("@/src/lib/finance");

const rule = (extra: Partial<{ id: number; kind: "PERCENT" | "AMOUNT"; value: number; appliesToRenewals: boolean; startsAt: string | null; endsAt: string | null; endedAt: string | null }> = {}) => ({
  id: 1,
  kind: "PERCENT" as const,
  value: 20,
  appliesToRenewals: false,
  startsAt: null,
  endsAt: null,
  endedAt: null,
  ...extra,
});

test("price math: percent and fixed amount, rounded down to whole IQD, never below 0", () => {
  assert.equal(d.discountAmount(6000, rule({ value: 20 })), 1200);
  assert.equal(6999 - d.discountAmount(6999, rule({ value: 15 })), 5949, "6999 × 0.85 = 5949.15 → 5949");
  assert.equal(d.discountAmount(10000, rule({ kind: "AMOUNT", value: 2000 })), 2000);
  assert.equal(d.discountAmount(1000, rule({ kind: "AMOUNT", value: 5000 })), 1000, "never below 0");
  assert.equal(d.discountAmount(0, rule()), 0);
  for (const price of [1, 7, 999, 15001]) {
    const after = price - d.discountAmount(price, rule({ value: 33 }));
    assert.ok(Number.isInteger(after) && after >= 0, `${price}`);
  }
});

test("window: active inside [startsAt, endsAt), until ended; open ends run forever", () => {
  const now = new Date("2026-11-10T12:00:00Z");
  assert.equal(d.isActiveAt(rule(), now), true);
  assert.equal(d.isActiveAt(rule({ startsAt: "2026-11-11T00:00:00Z" }), now), false);
  assert.equal(d.isScheduled(rule({ startsAt: "2026-11-11T00:00:00Z" }), now), true);
  assert.equal(d.isActiveAt(rule({ endsAt: "2026-11-10T12:00:00Z" }), now), false, "the end is exclusive");
  assert.equal(d.isActiveAt(rule({ endsAt: "2026-11-10T12:00:01Z" }), now), true);
  assert.equal(d.isActiveAt(rule({ endedAt: "2026-11-09T00:00:00Z" }), now), false);
  assert.equal(d.isScheduled(rule({ startsAt: "2026-11-20T00:00:00Z", endedAt: "2026-11-09T00:00:00Z" }), now), false, "ended before it started");
});

test("overlap: two discounts of an option may not share a moment", () => {
  const a = rule({ startsAt: "2026-11-01T00:00:00Z", endsAt: "2026-11-10T00:00:00Z" });
  assert.equal(d.overlaps(a, rule({ startsAt: "2026-11-10T00:00:00Z", endsAt: "2026-11-20T00:00:00Z" })), false, "back to back is fine");
  assert.equal(d.overlaps(a, rule({ startsAt: "2026-11-09T23:59:00Z", endsAt: null })), true);
  assert.equal(d.overlaps(rule(), rule({ startsAt: "2030-01-01T00:00:00Z" })), true, "an open-ended one overlaps anything later");
  assert.equal(d.overlaps(rule({ endedAt: "2026-11-05T00:00:00Z" }), rule({ startsAt: "2026-11-06T00:00:00Z" })), false, "an ended one frees the time after");
});

test("scope: NEW and UPGRADE always, renewals only when ticked; VIP device stays full price", () => {
  const option = { price: 10000, renewalPrice: 9000 };
  assert.deepEqual(d.orderPricing(option, "NEW", null, rule()), { listPrice: 10000, price: 8000, discountIqd: 2000, discountId: 1 });
  assert.deepEqual(d.orderPricing(option, "UPGRADE", null, rule()), { listPrice: 10000, price: 8000, discountIqd: 2000, discountId: 1 });
  assert.deepEqual(d.orderPricing(option, "RENEW", null, rule()), { listPrice: 9000, price: 9000, discountIqd: 0, discountId: null });
  assert.deepEqual(d.orderPricing(option, "RENEW", null, rule({ appliesToRenewals: true })), { listPrice: 9000, price: 7200, discountIqd: 1800, discountId: 1 });
  // VIP: package 45,000 + device 30,000; 20% on the package part only.
  assert.deepEqual(d.orderPricing({ price: 45000 }, "NEW", 30000, rule()), { listPrice: 75000, price: 66000, discountIqd: 9000, discountId: 1 });
  assert.deepEqual(d.orderPricing(option, "NEW", null, null), { listPrice: 10000, price: 10000, discountIqd: 0, discountId: null });
});

test("admin validation: percent 1–90, amount below the price, real dates in order", () => {
  const prices = { price: 6000, renewalPrice: 5000 };
  assert.ok(d.parseDiscount({ kind: "PERCENT", value: "20" }, prices).ok);
  for (const value of ["0", "91", "12.5", "-5", ""]) assert.equal(d.parseDiscount({ kind: "PERCENT", value }, prices).ok, false, value);
  assert.ok(d.parseDiscount({ kind: "AMOUNT", value: "5999" }, prices).ok);
  assert.equal(d.parseDiscount({ kind: "AMOUNT", value: "6000" }, prices).ok, false, "can't make it free");
  assert.equal(d.parseDiscount({ kind: "AMOUNT", value: "5500", appliesToRenewals: "on" }, prices).ok, false, "with renewals, it must stay below the renewal price");
  assert.equal(d.parseDiscount({ kind: "BOGUS", value: "5" }, prices).ok, false);
  const dated = d.parseDiscount({ kind: "PERCENT", value: "10", startsAt: "2026-11-01T10:00", endsAt: "2026-11-08T10:00" }, prices);
  assert.ok(dated.ok);
  assert.equal(dated.value.startsAt, "2026-11-01T07:00:00.000Z", "Baghdad time (UTC+3)");
  assert.equal(d.parseDiscount({ kind: "PERCENT", value: "10", startsAt: "2026-11-08T10:00", endsAt: "2026-11-01T10:00" }, prices).ok, false);
  assert.equal(d.parseDiscount({ kind: "PERCENT", value: "10", endsAt: "not a date" }, prices).ok, false);
  assert.equal(d.toBaghdadLocal("2026-11-01T07:00:00.000Z"), "2026-11-01T10:00");
});

test("labels: «خصم 20%», «وفّر 2,000 د.ع», «ينتهي خلال X أيام»", () => {
  assert.equal(d.discountBadge(rule(), 1200, "ar"), "خصم 20%");
  assert.equal(d.discountBadge(rule({ kind: "AMOUNT", value: 2000 }), 2000, "ar"), "وفّر 2,000 د.ع");
  assert.equal(d.discountBadge(rule({ kind: "AMOUNT", value: 2000 }), 2000, "en"), "Save 2,000 IQD");
  assert.deepEqual([0, 1, 2, 3, 10, 11].map((days) => d.endsInLabel(days, "ar")), ["ينتهي اليوم", "ينتهي خلال يوم", "ينتهي خلال يومين", "ينتهي خلال 3 أيام", "ينتهي خلال 10 أيام", "ينتهي خلال 11 يوم"]);
  assert.equal(d.daysLeft("2026-11-03T00:00:00Z", new Date("2026-11-01T12:00:00Z")), 2);
  assert.equal(d.daysLeft(null), null);
  assert.equal(d.previewPrice(6000, "PERCENT", "20"), 4800);
  assert.equal(d.previewPrice(6000, "AMOUNT", "6000"), null);
});

test("finance: discounted sales and the discount total; revenue is the price paid", () => {
  const base = { userId: 1, planSlug: "iptv", serviceType: "IPTV", serviceName: "IPTV", devicePrice: null, deviceName: null, createdAt: "2026-11-01T10:00:00Z", updatedAt: "2026-11-01T11:00:00Z", requestType: "NEW", status: "COMPLETED" };
  const sales = recognizeSales({
    orders: [
      { ...base, id: 1, price: 4800, discountIqd: 1200 },
      { ...base, id: 2, price: 6000 },
    ],
    receipts: [],
    paidAt: new Map(),
  });
  const range = { start: new Date("2026-11-01T00:00:00Z"), end: new Date("2026-12-01T00:00:00Z") };

  assert.deepEqual(discountTotals(sales, range), { sales: 1, amount: 1200 });
  assert.equal(sales.reduce((sum, sale) => sum + sale.amount, 0), 10800);
});

test("discounts migration: additive only, chained after real costs, the db ref points at it", async () => {
  const { readFileSync } = await import("node:fs");
  const read = (path: string) => JSON.parse(readFileSync(new URL(`../migrations/app/${path}`, import.meta.url), "utf8"));
  const ops: { id: string; operationClass: string }[] = read("20261031T0021_discounts/ops.json");

  assert.ok(ops.every((op) => op.operationClass === "additive"));
  for (const id of ["table.discount", "column.public.subscriptionRequest.listPrice", "column.public.subscriptionRequest.discountId", "column.public.subscriptionRequest.discountIqd"]) assert.ok(ops.some((op) => op.id === id), id);
  assert.equal(read("20261031T0021_discounts/migration.json").from, read("20261030T2329_real_costs/migration.json").to);
  assert.equal(read("20261031T0021_discounts/migration.json").to, read("20261031T0738_plan_groups/migration.json").from);
});
