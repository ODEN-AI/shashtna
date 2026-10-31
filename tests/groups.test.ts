import assert from "node:assert/strict";
import { test } from "node:test";

const g = await import("@/src/lib/groups");
const { normalizeServiceType, normalizeDeviceServiceType } = await import("@/src/lib/catalogue");
const loyalty = await import("@/src/lib/loyalty");
const { costSnapshot } = await import("@/src/lib/costs");
const { parsePackageOptions } = await import("@/src/lib/package-options");

test("contrast: every preset passes WCAG AA on the dark UI, and the math matches known pairs", () => {
  assert.equal(Number(g.contrast("#ffffff", "#000000").toFixed(1)), 21);
  assert.equal(Number(g.contrast("#777777", "#ffffff").toFixed(2)), 4.48);
  for (const preset of g.PALETTE) {
    const check = g.checkColours(preset.accent, preset.surface);
    assert.ok(check.ok, `${preset.key}: ${check.accentOnSurface.toFixed(2)}`);
    assert.ok(check.accentOnSurface >= 4.5 && check.textOnSurface >= 4.5 && check.buttonLabel >= 4.5);
  }
});

test("contrast: a failing pair is refused with a compliant suggestion in the same hue", () => {
  const check = g.checkColours("#e50914", "#2a0a0a");
  assert.equal(check.ok, false);
  assert.ok(check.suggestion);
  assert.ok(g.checkColours(check.suggestion.accent, check.suggestion.surface).ok, "the suggestion passes");
  assert.equal(g.checkColours("#zzzzzz", "#000000").ok, false);
  assert.equal(g.buttonText("#f1cf7a"), g.DARK_TEXT, "dark label on a light accent");
  assert.equal(g.buttonText("#1a1aff"), g.LIGHT_TEXT, "light label on a dark accent");
});

test("group validation: slug, colours, delivery and contrast are checked on the server", () => {
  const base = { name: "باقات Netflix", slug: "netflix", accent: "#ff5a64", surface: "#1a0b10", delivery: "ACCOUNT", sortOrder: "5", isActive: "on" };
  const ok = g.parseGroup(base);
  assert.ok(ok.ok);
  assert.equal(ok.value.sortOrder, 5);
  assert.equal(ok.value.isActive, true);
  assert.equal(g.parseGroup({ ...base, slug: "Net Flix" }).ok, false);
  assert.equal(g.parseGroup({ ...base, accent: "red" }).ok, false);
  assert.equal(g.parseGroup({ ...base, delivery: "SMS" }).ok, false);
  assert.equal(g.parseGroup({ ...base, logoUrl: "javascript:alert(1)" }).ok, false);
  assert.ok(g.parseGroup({ ...base, logoUrl: "/uploads/netflix.png" }).ok);
  const low = g.parseGroup({ ...base, accent: "#e50914", surface: "#2a0a0a" });
  assert.equal(low.ok, false);
  assert.match(low.ok ? "" : low.error, /جرّب: اللون #/);
});

test("delivery: account deliveries renew, a code is one-off; the customer e-mail is validated", () => {
  assert.equal(g.deliveryRenews("ACCOUNT"), true);
  assert.equal(g.deliveryRenews("CUSTOMER_EMAIL"), true);
  assert.equal(g.deliveryRenews("CODE"), false);
  assert.equal(g.normalizeDelivery("code"), "CODE");
  assert.equal(g.normalizeDelivery("bogus"), "ACCOUNT");
  assert.equal(g.parseDeliveryEmail(" Me@Example.COM "), "me@example.com");
  for (const bad of ["me", "me@", "a b@c.de", "", null]) assert.equal(g.parseDeliveryEmail(bad), null, String(bad));
});

test("service separation: DIGITAL is its own service; devices stay IPTV / VIP", () => {
  assert.equal(normalizeServiceType("digital"), "DIGITAL");
  assert.equal(normalizeServiceType("VIP"), "VIP");
  assert.equal(normalizeServiceType("anything"), "IPTV", "unknown values keep the old meaning");
  assert.equal(normalizeDeviceServiceType("DIGITAL"), "IPTV");
  assert.equal(g.isBuiltInGroup("iptv"), true);
  assert.equal(g.isBuiltInGroup("netflix"), false);
});

test("platform points: few points (1 per 5,000 IQD), overridable; VIP still earns nothing", () => {
  assert.equal(loyalty.orderPointValue(12000, null, "DIGITAL"), 2);
  assert.equal(loyalty.orderPointValue(4999, null, "DIGITAL"), 0);
  assert.equal(loyalty.orderPointValue(12000, 5, "DIGITAL"), 5, "the option's pointsEarned wins");
  assert.equal(loyalty.orderPointValue(12000, null, "IPTV"), 12, "IPTV unchanged");
  const order = { serviceType: "DIGITAL", requestType: "NEW", price: 15000, status: "COMPLETED", loyaltyReward: false };
  assert.equal(loyalty.pointsForOrder(order, null), 3);
  assert.equal(loyalty.pointsForOrder({ ...order, serviceType: "VIP" }, null), 0);
  assert.equal(loyalty.previewPoints("DIGITAL", 10000, null), 2);
  assert.equal(loyalty.earnsPoints("DIGITAL"), true);
  assert.equal(loyalty.earnsPoints("VIP"), false);
});

test("platform cost: a fixed IQD cost is a known cost; credit still wins; unknown stays null", () => {
  const rate = { id: 1, creditCents: 20000, iqdPaid: 180000 };
  assert.deepEqual(costSnapshot("SITE", null, null, 9000), { creditCostCents: null, creditCostIqd: 9000, creditPurchaseId: null });
  assert.deepEqual(costSnapshot("SITE", 100, rate, 9000), { creditCostCents: 100, creditCostIqd: 900, creditPurchaseId: 1 });
  assert.deepEqual(costSnapshot("SITE", null, null, null), { creditCostCents: null, creditCostIqd: null, creditPurchaseId: null });
  const parsed = parsePackageOptions([{ durationValue: 1, durationUnit: "MONTH", price: 12000, costIqd: 9000 }], "DIGITAL");
  assert.ok(parsed.ok);
  assert.equal(parsed.options[0].costIqd, 9000);
  assert.equal(parsePackageOptions([{ durationValue: 1, durationUnit: "MONTH", price: 12000, costIqd: 9.5 }], "DIGITAL").ok, false);
});

test("plan groups migrations: additive, the data step only touches ungrouped IPTV / VIP rows, chained", async () => {
  const { readFileSync } = await import("node:fs");
  const read = (path: string) => JSON.parse(readFileSync(new URL(`../migrations/app/${path}`, import.meta.url), "utf8"));
  const ops: { id: string; operationClass: string; execute?: { sql: string }[] }[] = read("20261031T0738_plan_groups/ops.json");

  assert.deepEqual(ops.filter((op) => op.operationClass !== "additive").map((op) => op.id), ["data.public.packageGroup.builtin_iptv_vip"]);
  for (const id of ["table.packageGroup", "column.public.package.groupId", "column.public.packageOption.costIqd", "column.public.subscriptionRequest.deliveryEmail", "column.public.subscriptionRequest.deliveryCode"]) {
    assert.ok(ops.some((op) => op.id === id), id);
  }

  const data = ops.find((op) => op.operationClass === "data")!.execute!.map((step) => step.sql).join("\n");
  assert.match(data, /ON CONFLICT \("slug"\) DO NOTHING/, "the built-in groups are created once");
  assert.match(data, /WHERE p\."groupId" IS NULL/, "only packages without a group are placed");
  assert.match(data, /IN \('IPTV', 'VIP'\)/);
  assert.doesNotMatch(data, /DELETE|DROP/);

  const email: { id: string; operationClass: string }[] = read("20261031T0742_platform_account_email/ops.json");
  assert.deepEqual(email.map((op) => [op.id, op.operationClass]), [["column.public.subscription.accountEmail", "additive"]]);

  assert.equal(read("20261031T0738_plan_groups/migration.json").from, read("20261031T0021_discounts/migration.json").to);
  assert.equal(read("20261031T0742_platform_account_email/migration.json").from, read("20261031T0738_plan_groups/migration.json").to);
  assert.equal(read("20261031T1006_automation_core/migration.json").from, read("20261031T0742_platform_account_email/migration.json").to);
});
