import assert from "node:assert/strict";
import { test } from "node:test";

const loyalty = await import("@/src/lib/loyalty");
const { settingProblem } = await import("@/src/lib/system");
const { parsePackageOptions } = await import("@/src/lib/package-options");
const { recognizeSales } = await import("@/src/lib/finance");
const { rewardJourneySteps } = await import("@/src/lib/order-journey");

const rules = { ...loyalty.DEFAULT_LOYALTY_RULES, enabled: true };
const order = (extra: Partial<{ serviceType: string; requestType: string; price: number; status: string; loyaltyReward: boolean }> = {}) => ({
  serviceType: "IPTV",
  requestType: "RENEW",
  price: 6000,
  status: "COMPLETED",
  loyaltyReward: false,
  ...extra,
});

test("points per length: 1 per 1,000 IQD of the stored price, rounded down", () => {
  assert.equal(loyalty.pointsForOrder(order({ price: 6000 }), null), 6);
  assert.equal(loyalty.pointsForOrder(order({ price: 10000 }), null), 10);
  assert.equal(loyalty.pointsForOrder(order({ price: 15000 }), null), 15);
  assert.equal(loyalty.pointsForOrder(order({ price: 25000 }), null), 25);
  assert.equal(loyalty.pointsForOrder(order({ price: 9999 }), null), 9);
  assert.equal(loyalty.pointsForOrder(order({ price: 999 }), null), 0);
});

test("a package option's pointsEarned overrides the automatic value (0 included)", () => {
  assert.equal(loyalty.pointsForOrder(order({ price: 10000 }), 14), 14);
  assert.equal(loyalty.pointsForOrder(order({ price: 10000 }), 0), 0);
  assert.equal(loyalty.orderPointValue(10000, null), 10);
});

test("only paid, completed IPTV plan orders earn", () => {
  assert.equal(loyalty.earnBlock(order()), null);
  assert.equal(loyalty.earnBlock(order({ requestType: "NEW" })), null);
  assert.equal(loyalty.earnBlock(order({ requestType: "UPGRADE" })), null);
  assert.equal(loyalty.earnBlock(order({ serviceType: "VIP" })), "NOT_IPTV");
  assert.equal(loyalty.earnBlock(order({ serviceType: "DEVICE", requestType: "DEVICE_PURCHASE" })), "NOT_IPTV");
  assert.equal(loyalty.earnBlock(order({ requestType: "DEVICE_PURCHASE" })), "WRONG_TYPE");
  assert.equal(loyalty.earnBlock(order({ loyaltyReward: true, price: 0 })), "REWARD");
  assert.equal(loyalty.earnBlock(order({ price: 0 })), "FREE");
  for (const status of ["SUBMITTED", "AWAITING_PAYMENT", "PAID", "FULFILLING", "CANCELLED", "REJECTED"]) {
    assert.equal(loyalty.earnBlock(order({ status })), "NOT_COMPLETED", status);
  }
  // Legacy ACCEPTED reads as COMPLETED.
  assert.equal(loyalty.earnBlock(order({ status: "ACCEPTED" })), null);
  assert.equal(loyalty.pointsForOrder(order({ serviceType: "VIP", price: 35000 }), 99), 0);
});

test("preview points are IPTV only", () => {
  assert.equal(loyalty.previewPoints("IPTV", 15000, null), 15);
  assert.equal(loyalty.previewPoints("VIP", 35000, null), 0);
});

test("pending points unlock after availableAt; deductions count at once", () => {
  const now = new Date("2026-11-01T00:00:00Z");
  const split = loyalty.splitBalance(
    [
      { points: 10, availableAt: "2026-10-01T00:00:00Z" },
      { points: 6, availableAt: "2026-11-05T00:00:00Z" },
      { points: 15, availableAt: "2026-11-03T00:00:00Z" },
      { points: -4, availableAt: "2026-11-09T00:00:00Z" },
    ],
    now,
  );

  assert.deepEqual(split, { balance: 27, pending: 21, available: 6, nextUnlock: "2026-11-03T00:00:00.000Z" });
  assert.equal(loyalty.unlockDate(new Date("2026-11-01T10:00:00Z"), rules).toISOString(), "2026-11-08T10:00:00.000Z");
});

test("a reversal can leave the available balance negative", () => {
  const split = loyalty.splitBalance([{ points: 6, availableAt: "2026-01-01T00:00:00Z" }, { points: -10, availableAt: "2026-01-02T00:00:00Z" }], new Date("2026-02-01T00:00:00Z"));
  assert.equal(split.available, -4);
});

test("the balance expires expiryMonths after the latest IPTV expiry (clamped to month end)", () => {
  assert.equal(loyalty.pointsExpiryDate("2026-12-15", rules), "2027-06-15");
  assert.equal(loyalty.pointsExpiryDate("2026-08-31", rules), "2027-02-28");
  assert.equal(loyalty.pointsExpiryDate(null, rules), null);
  assert.equal(loyalty.isPointsExpired("2027-06-15", new Date("2027-06-14T12:00:00Z")), false);
  assert.equal(loyalty.isPointsExpired("2027-06-15", new Date("2027-06-17T00:00:00Z")), true);
  assert.equal(loyalty.isPointsExpired(null), false);
});

test("the progress sentence counts renewals in natural Arabic", () => {
  assert.equal(loyalty.progressSentence(18, rules, 6, "ar"), "باقي لك تجديدين وتاخذ 3 أشهر مجاناً.");
  assert.equal(loyalty.progressSentence(24, rules, 6, "ar"), "باقي لك تجديد واحد وتاخذ 3 أشهر مجاناً.");
  assert.equal(loyalty.progressSentence(0, rules, 6, "ar"), "باقي لك 5 تجديدات وتاخذ 3 أشهر مجاناً.");
  assert.equal(loyalty.progressSentence(28, rules, null, "ar"), "باقي لك نقطتين وتاخذ 3 أشهر مجاناً.");
  assert.equal(loyalty.progressSentence(30, rules, 6, "ar"), "نقاطك تكفي لـ 3 أشهر مجاناً.");
  assert.equal(loyalty.progressSentence(60, rules, 6, "ar"), "نقاطك تكفي لـ 6 أشهر مجاناً.");
  assert.equal(loyalty.progressSentence(18, rules, 6, "en"), "2 more renewals and you get 3 free months.");
  assert.equal(loyalty.progressFraction(15, rules), 0.5);
  assert.equal(loyalty.progressFraction(-5, rules), 0);
});

test("redemption checks run in a fixed order with clear Arabic reasons", () => {
  const base = {
    rules,
    account: { status: "ACTIVE", balance: 40, openRewardOrderId: null, lastRedeemedAt: null },
    available: 40,
    reward: "3m" as const,
    hasIptvSubscription: true,
    rewardOptionActive: true,
    now: new Date("2026-11-01T00:00:00Z"),
  };

  assert.equal(loyalty.redeemProblem(base), null);
  assert.equal(loyalty.redeemProblem({ ...base, rules: { ...rules, enabled: false } })?.code, "DISABLED");
  assert.equal(loyalty.redeemProblem({ ...base, account: { ...base.account, status: "SUSPENDED" } })?.code, "SUSPENDED");
  assert.equal(loyalty.redeemProblem({ ...base, account: { ...base.account, balance: -2 }, available: -2 })?.code, "NEGATIVE");
  assert.equal(loyalty.redeemProblem({ ...base, available: 29 })?.code, "INSUFFICIENT");
  assert.equal(loyalty.redeemProblem({ ...base, reward: "6m" })?.code, "INSUFFICIENT");
  assert.equal(loyalty.redeemProblem({ ...base, account: { ...base.account, openRewardOrderId: 9 } })?.code, "OPEN_REWARD");
  const cooldown = loyalty.redeemProblem({ ...base, account: { ...base.account, lastRedeemedAt: "2026-09-01T00:00:00Z" } });
  assert.equal(cooldown?.code, "COOLDOWN");
  assert.equal(cooldown?.until, "2026-11-30T00:00:00.000Z");
  assert.equal(loyalty.redeemProblem({ ...base, account: { ...base.account, lastRedeemedAt: "2026-07-01T00:00:00Z" } }), null);
  assert.equal(loyalty.redeemProblem({ ...base, hasIptvSubscription: false })?.code, "NO_SUBSCRIPTION");
  assert.equal(loyalty.redeemProblem({ ...base, rewardOptionActive: false })?.code, "NOT_CONFIGURED");
  assert.equal(loyalty.redeemProblem({ ...base, account: null })?.code, undefined);
  assert.match(loyalty.redeemProblemText(cooldown!, "ar"), /^تكدر تستبدل مكافأة وحدة كل فترة\. الاستبدال الجاي متاح من تاريخ .+\.$/);
});

test("every entry stores the rule it was computed with, so a rule change never rewrites history", () => {
  const before = JSON.parse(loyalty.ruleSnapshot(rules, { orderId: 7 }));
  const changed = loyalty.parseLoyaltyRules({ "loyalty.enabled": "on", "loyalty.reward3mPoints": "40", "loyalty.pendingDays": "3" });
  const after = JSON.parse(loyalty.ruleSnapshot(changed, { orderId: 8 }));

  assert.equal(before.reward3mPoints, 30);
  assert.equal(before.pendingDays, 7);
  assert.equal(before.pointValueIqd, 1000);
  assert.equal(before.orderId, 7);
  assert.equal(after.reward3mPoints, 40);
  assert.equal(after.pendingDays, 3);
  assert.equal("enabled" in before, false);
});

test("settings: the program ships off, numbers are validated, bad values fall back", () => {
  assert.equal(loyalty.parseLoyaltyRules({}).enabled, false);
  assert.deepEqual(loyalty.parseLoyaltyRules({}), loyalty.DEFAULT_LOYALTY_RULES);
  assert.equal(loyalty.parseLoyaltyRules({ "loyalty.cooldownDays": "abc" }).cooldownDays, 90);
  assert.equal(loyalty.parseLoyaltyRules({ "loyalty.reward3mOptionId": "12" }).reward3mOptionId, 12);
  // 6 months must cost more than 3 months.
  assert.ok(loyalty.parseLoyaltyRules({ "loyalty.reward3mPoints": "70" }).reward6mPoints > 70);

  assert.equal(settingProblem("loyalty.enabled", "on"), null);
  assert.ok(settingProblem("loyalty.enabled", "yes"));
  assert.ok(settingProblem("loyalty.reward3mPoints", "1.5"));
  assert.ok(settingProblem("loyalty.reward3mPoints", "-3"));
  assert.ok(settingProblem("loyalty.reward3mPoints", ""));
  assert.ok(settingProblem("loyalty.pendingDays", "91"));
  assert.equal(settingProblem("loyalty.pendingDays", "0"), null);
  assert.equal(settingProblem("loyalty.reward6mOptionId", ""), null);
});

test("the package form's pointsEarned: whole numbers or empty; VIP is always cleared", () => {
  const iptv = parsePackageOptions(
    [
      { durationValue: 3, durationUnit: "MONTH", price: 6000, pointsEarned: 8 },
      { durationValue: 6, durationUnit: "MONTH", price: 10000, pointsEarned: null },
      { durationValue: 1, durationUnit: "YEAR", price: 15000 },
    ],
    "IPTV",
  );

  assert.ok(iptv.ok);
  assert.deepEqual(iptv.options.map((option) => option.pointsEarned), [8, null, undefined]);
  assert.equal(parsePackageOptions([{ durationValue: 3, durationUnit: "MONTH", price: 6000, pointsEarned: 2.5 }], "IPTV").ok, false);
  assert.equal(parsePackageOptions([{ durationValue: 3, durationUnit: "MONTH", price: 6000, pointsEarned: "8" }], "IPTV").ok, false);

  const vip = parsePackageOptions([{ price: 35000, pointsEarned: 50 }], "VIP");
  assert.ok(vip.ok);
  assert.equal(vip.options[0].pointsEarned, null);
});

test("reward orders are never revenue, a sale or a product row", () => {
  const base = { userId: 1, planSlug: "iptv-3m", serviceType: "IPTV", serviceName: "IPTV", devicePrice: null, deviceName: null, createdAt: "2026-10-01T10:00:00Z", updatedAt: "2026-10-02T10:00:00Z" };
  const sales = recognizeSales({
    orders: [
      { ...base, id: 1, status: "COMPLETED", requestType: "RENEW", price: 6000 },
      { ...base, id: 2, status: "COMPLETED", requestType: "RENEW", price: 0, loyaltyReward: true },
    ],
    receipts: [{ id: 9, orderId: 2, userId: 1, price: 0, serviceName: "IPTV", serviceType: "IPTV", createdAt: "2026-10-02T10:00:00Z" }],
    paidAt: new Map(),
  });

  assert.deepEqual(sales.map((sale) => sale.key), ["order:1"]);
});

test("a reward order's journey has no payment step", () => {
  assert.deepEqual(rewardJourneySteps("PAYMENT_PENDING").map((step) => `${step.key}:${step.state}`), ["REWARD:done", "APPROVE:current", "ACTIVATE:upcoming"]);
  assert.deepEqual(rewardJourneySteps("PAID").map((step) => step.state), ["done", "done", "current"]);
  assert.deepEqual(rewardJourneySteps("ACTIVATED").map((step) => step.state), ["done", "done", "done"]);
});

test("liability: every reward3mPoints points ≈ $1", () => {
  assert.equal(loyalty.liabilityUsd(90, rules), 3);
  assert.equal(loyalty.liabilityUsd(-10, rules), 0);
});

test("loyalty migration: additive only, chained after package options, followed by real costs", async () => {
  const { readFileSync } = await import("node:fs");
  const read = (path: string) => JSON.parse(readFileSync(new URL(`../migrations/app/${path}`, import.meta.url), "utf8"));
  const ops: { id: string; operationClass: string }[] = read("20261030T1747_loyalty_points/ops.json");

  assert.ok(ops.length > 0);
  assert.ok(ops.every((op) => op.operationClass === "additive"), "nothing dropped, rewritten or backfilled");
  for (const id of ["table.loyaltyAccount", "table.loyaltyEntry", "column.public.packageOption.pointsEarned", "column.public.subscriptionRequest.loyaltyReward", "unique.loyaltyEntry.loyaltyEntry_idempotencyKey_key", "unique.loyaltyAccount.loyaltyAccount_userId_key"]) {
    assert.ok(ops.some((op) => op.id === id), id);
  }

  const migration = read("20261030T1747_loyalty_points/migration.json");
  assert.equal(migration.from, read("20261030T1021_package_options/migration.json").to);
  assert.equal(migration.to, read("20261030T2329_real_costs/migration.json").from);
});

test("enabled periods come from the settings audit trail; the program starts off", () => {
  const intervals = loyalty.enabledIntervals([
    { at: "2026-11-10T00:00:00Z", details: "loyalty.enabled: on → off" },
    { at: "2026-11-01T00:00:00Z", details: "loyalty.cooldownDays: 90 → 60\nloyalty.enabled: off → on" },
    { at: "2026-11-20T00:00:00Z", details: "loyalty.enabled: off → on" },
    { at: "2026-11-21T00:00:00Z", details: "contact.phone: — → 0770" },
  ]);

  assert.deepEqual(intervals, [
    { from: Date.parse("2026-11-01T00:00:00Z"), to: Date.parse("2026-11-10T00:00:00Z") },
    { from: Date.parse("2026-11-20T00:00:00Z"), to: null },
  ]);
  assert.equal(loyalty.wasEnabledAt(intervals, "2026-10-31T23:00:00Z"), false);
  assert.equal(loyalty.wasEnabledAt(intervals, "2026-11-05T00:00:00Z"), true);
  assert.equal(loyalty.wasEnabledAt(intervals, "2026-11-15T00:00:00Z"), false);
  assert.equal(loyalty.wasEnabledAt(intervals, "2026-12-01T00:00:00Z"), true);
  assert.deepEqual(loyalty.enabledIntervals([]), []);
});

test("a missed award: eligible, completed while on, and no EARN entry", () => {
  const intervals = [{ from: Date.parse("2026-11-01T00:00:00Z"), to: null }];
  const orders = [
    { id: 1, ...order() }, // missed
    { id: 2, ...order() }, // already earned
    { id: 3, ...order({ serviceType: "VIP", price: 35000 }) }, // VIP never earns
    { id: 4, ...order({ loyaltyReward: true, price: 0 }) }, // reward
    { id: 5, ...order() }, // completed before launch
    { id: 6, ...order({ status: "PAID" }) }, // not completed
    { id: 7, ...order() }, // no completion event
  ];
  const completedAt = new Map([
    [1, "2026-11-05T00:00:00Z"],
    [2, "2026-11-05T00:00:00Z"],
    [3, "2026-11-05T00:00:00Z"],
    [4, "2026-11-05T00:00:00Z"],
    [5, "2026-10-20T00:00:00Z"],
    [6, "2026-11-05T00:00:00Z"],
  ]);

  assert.deepEqual(loyalty.missedAwards(orders, completedAt, new Set([2]), intervals).map((row) => row.id), [1]);
  assert.deepEqual(loyalty.missedAwards(orders, completedAt, new Set(), []), [], "never enabled → nothing missed");
});
