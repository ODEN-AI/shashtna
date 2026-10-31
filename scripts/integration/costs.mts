/**
 * Integration check of real costs and supplier orders against a LOCAL
 * database, through the services (no server needed):
 *
 *   node --experimental-strip-types --import ./tests/register-alias.mjs scripts/integration/costs.mts
 *
 * Credit purchases and the rate, the cost snapshot on completion, supplier
 * subscriptions, no loyalty points for them, the finance split, and owner-only
 * permissions. It creates throwaway rows and removes them. Refuses any
 * non-local DATABASE_URL.
 */
import assert from "node:assert/strict";

await import("dotenv/config");

const host = (() => {
  try {
    return new URL(process.env.DATABASE_URL ?? "").hostname;
  } catch {
    return "";
  }
})();

if (host !== "localhost" && host !== "127.0.0.1") {
  console.error("Refusing to run: DATABASE_URL must point at a local database.");
  process.exit(2);
}

const { db } = await import("@/src/prisma/db");
const Costs = await import("@/src/server/costs");
const { createSupplierSubscription } = await import("@/src/server/supplier-orders");
const { awardForOrder, missingAwards } = await import("@/src/server/loyalty");
const { completeOrderWithSubscription } = await import("@/src/server/orders");
const { savePackageOptions } = await import("@/src/server/package-options");
const { getFinanceSnapshot } = await import("@/src/server/finance");

const R = Date.now().toString().slice(-7);
const start = new Date(Date.now() - 60_000).toISOString();
const results: string[] = [];
const check = async (name: string, fn: () => Promise<void>) => {
  try {
    await fn();
    results.push(`PASS  ${name}`);
  } catch (error) {
    results.push(`FAIL  ${name}\n      ${String((error as Error).message).split("\n")[0]}`);
  }
};

const owner = await db.orm.public.User.create({ name: "cost owner", phone: `0791${R}`, passwordHash: "x", role: "OWNER" });
// Not full access: owner-only means OWNER or legacy ADMIN (isFullAccess), so the refused actor is an OPERATOR.
const admin = await db.orm.public.User.create({ name: "cost operator", phone: `0792${R}`, passwordHash: "x", role: "OPERATOR" });
const customer = await db.orm.public.User.create({ name: "cost customer", phone: `0793${R}`, passwordHash: "x" });
const ownerActor = { id: owner.id, role: "OWNER" };
const adminActor = { id: admin.id, role: "OPERATOR" };
const pkg = await db.orm.public.Package.create({ name: `cost ${R}`, slug: `cost-${R}`, serviceType: "IPTV", price: 6000, durationMonths: 3, durationLabel: "3", description: "", specifications: "" });
const ids: Record<string, number> = {};
const savedSettings = await db.orm.public.SiteSetting.where((s) => s.key.like("loyalty.%")).all();

try {
  await check("only the owner records a credit purchase; bad values are refused", async () => {
    assert.equal((await Costs.addCreditPurchase(adminActor, { purchasedOn: "2026-10-30", creditUsd: "200", iqdPaid: "180000" })).ok, false);
    const bad = await Costs.addCreditPurchase(ownerActor, { purchasedOn: "2026-10-30", creditUsd: "-1", iqdPaid: "180000" });
    assert.equal(bad.ok, false);
    const older = await Costs.addCreditPurchase(ownerActor, { purchasedOn: "2026-09-01", creditUsd: "100", iqdPaid: "95000", note: `it-${R}` });
    const latest = await Costs.addCreditPurchase(ownerActor, { purchasedOn: "2026-10-30", creditUsd: "200", iqdPaid: "180,000", note: `it-${R}` });
    assert.ok(older.ok && latest.ok);
    ids.older = older.ok ? older.id : 0;
    ids.latest = latest.ok ? latest.id : 0;
    const rate = await Costs.currentCreditRate();
    assert.equal(rate?.id, ids.latest);
    assert.equal(rate?.rate, 900);
  });

  await check("the package form saves credit per length (IPTV 3m $1, 1y $4)", async () => {
    const saved = await savePackageOptions(pkg.id, [
      { id: null, durationMonths: 3, durationUnit: "MONTH", durationLabel: "3 أشهر", price: 6000, renewalPrice: null, creditCostCents: 100, isActive: true },
      { id: null, durationMonths: 12, durationUnit: "MONTH", durationLabel: "سنة", price: 15000, renewalPrice: null, creditCostCents: 400, isActive: true },
      { id: null, durationMonths: 6, durationUnit: "MONTH", durationLabel: "6 أشهر", price: 10000, renewalPrice: null, creditCostCents: null, isActive: true },
    ]);
    assert.ok(saved.ok);
    const options = await db.orm.public.PackageOption.where({ packageId: pkg.id }).all();
    for (const option of options) ids[`m${option.durationMonths}`] = option.id;
    assert.deepEqual(options.map((option) => [option.durationMonths, option.creditCostCents ?? null]).sort((a, b) => Number(a[0]) - Number(b[0])), [[3, 100], [6, null], [12, 400]]);
  });

  const order = async (optionId: number, price: number, months: number) => {
    const sub = await db.orm.public.Subscription.create({ userId: customer.id, serviceType: "IPTV", packageName: "x", startDate: "2026-10-01", expiryDate: "2027-12-01" });
    const row = await db.orm.public.SubscriptionRequest.create({ userId: customer.id, planSlug: pkg.slug, packageOptionId: optionId, serviceType: "IPTV", serviceName: "x", requestType: "RENEW", price, durationMonths: months, durationLabel: String(months), status: "PAID", subscriptionId: sub.id });
    await completeOrderWithSubscription(ownerActor, row.id, sub.id, { price, durationMonths: months, durationLabel: String(months), bonusYears: 0 });
    return db.orm.public.SubscriptionRequest.first({ id: row.id });
  };

  await check("completion snapshots the cost at the current rate; unknown stays null", async () => {
    const year = await order(ids.m12, 15000, 12);
    assert.deepEqual([year?.creditCostCents, year?.creditCostIqd, year?.creditPurchaseId, year?.channel], [400, 3600, ids.latest, "SITE"]);
    ids.yearOrder = year!.id;
    const unknown = await order(ids.m6, 10000, 6);
    assert.deepEqual([unknown?.creditCostCents, unknown?.creditCostIqd, unknown?.creditPurchaseId], [null, null, null]);
  });

  await check("a later rate or credit edit never changes a past order", async () => {
    await Costs.addCreditPurchase(ownerActor, { purchasedOn: "2026-10-31", creditUsd: "100", iqdPaid: "100000", note: `it-${R}` });
    await db.orm.public.PackageOption.where({ id: ids.m12 }).update({ creditCostCents: 999 });
    const past = await db.orm.public.SubscriptionRequest.first({ id: ids.yearOrder });
    assert.equal(past?.creditCostIqd, 3600);
    const next = await order(ids.m3, 6000, 3);
    assert.equal(next?.creditCostIqd, 1000, "the next order uses the new rate (1,000 IQD/$)");
  });

  await check("only the owner records a supplier subscription; it validates on the server", async () => {
    assert.equal((await createSupplierSubscription(adminActor, customer.id, { months: "24", price: "15000", supplierShare: "10000", username: `sup${R}` })).ok, false);
    const tooMuch = await createSupplierSubscription(ownerActor, customer.id, { months: "24", price: "15000", supplierShare: "20000", username: `sup${R}` });
    assert.equal(tooMuch.ok, false);
    assert.equal((await createSupplierSubscription(ownerActor, 999999999, { months: "24", price: "15000", supplierShare: "10000", username: `sup${R}` })).ok, false, "unknown customer");
    assert.equal(await db.orm.public.SubscriptionRequest.where({ userId: customer.id, channel: "SUPPLIER" }).all().then((rows) => rows.length), 0);
  });

  await check("a supplier subscription: COMPLETED order (channel SUPPLIER, cost 0, share), subscription, receipt", async () => {
    const r = await createSupplierSubscription(ownerActor, customer.id, { months: "24", price: "15000", supplierShare: "10000", username: `sup${R}`, password: "secret-x" });
    assert.ok(r.ok, r.ok ? "" : r.error);
    if (!r.ok) return;
    ids.supplierOrder = r.orderId;
    ids.supplierSub = r.subscriptionId;
    const row = await db.orm.public.SubscriptionRequest.first({ id: r.orderId });
    assert.deepEqual([row?.status, row?.channel, row?.price, row?.supplierShareIqd, row?.creditCostIqd, row?.durationMonths, row?.requestType], ["COMPLETED", "SUPPLIER", 15000, 10000, 0, 24, "NEW"]);
    const sub = await db.orm.public.Subscription.first({ id: r.subscriptionId });
    assert.equal(sub?.status, "ACTIVE");
    assert.equal(sub?.password, "secret-x", "stored like every IPTV subscription (masked by the existing views)");
    assert.ok((await db.orm.public.Receipt.first({ orderId: r.orderId }))?.price === 15000);
    const dup = await createSupplierSubscription(ownerActor, customer.id, { months: "24", price: "15000", supplierShare: "10000", username: `sup${R}` });
    assert.equal(dup.ok, false, "the same username can't be used twice");
  });

  await check("renewing through the supplier extends the existing subscription", async () => {
    const before = String((await db.orm.public.Subscription.first({ id: ids.supplierSub }))?.expiryDate).slice(0, 10);
    const r = await createSupplierSubscription(ownerActor, customer.id, { months: "24", price: "15000", supplierShare: "10000", subscriptionId: String(ids.supplierSub) });
    assert.ok(r.ok);
    const after = String((await db.orm.public.Subscription.first({ id: ids.supplierSub }))?.expiryDate).slice(0, 10);
    assert.equal(Number(after.slice(0, 4)) - Number(before.slice(0, 4)), 2);
    assert.equal(after.slice(5), before.slice(5));
  });

  await check("supplier orders never earn points (award and missed-award check)", async () => {
    const set = async (key: string, value: string) => {
      const existing = await db.orm.public.SiteSetting.first({ key });
      if (existing) await db.orm.public.SiteSetting.where({ key }).update({ value });
      else await db.orm.public.SiteSetting.create({ key, value });
    };
    await set("loyalty.enabled", "on");
    await db.orm.public.ActivityEvent.create({ entityType: "LOYALTY", action: "LOYALTY_SETTINGS_CHANGED", summary: "it", details: "loyalty.enabled: off → on", createdAt: start });
    assert.equal((await awardForOrder(ids.supplierOrder)).awarded, 0);
    assert.equal((await awardForOrder(ids.supplierOrder, undefined, { backfill: true })).awarded, 0);
    assert.equal((await db.orm.public.LoyaltyEntry.where({ orderId: ids.supplierOrder }).all()).length, 0);
    assert.ok(!(await missingAwards()).some((row) => row.id === ids.supplierOrder));
  });

  await check("finance splits revenue, credit cost, supplier share and net profit by channel", async () => {
    const snapshot = await getFinanceSnapshot({ period: "custom", from: "2026-10-01", to: "2027-12-31", view: "month" }, new Date("2026-11-30T00:00:00Z"));
    const { site, supplier } = snapshot.costs.current;
    // This run's rows only are known here: assert the supplier side and that unknown costs are flagged.
    assert.ok(supplier.sales >= 2 && supplier.supplierShare >= 20000);
    assert.equal(supplier.creditCost, 0);
    assert.ok(site.unknownCostSales >= 1, "the 6-month order with no credit set is flagged");
    assert.ok(site.creditCost >= 3600 + 1000);
  });
} finally {
  await db.orm.public.LoyaltyEntry.where({ userId: customer.id }).deleteAndCount();
  await db.orm.public.LoyaltyAccount.where({ userId: customer.id }).deleteAndCount();
  await db.orm.public.Receipt.where({ userId: customer.id }).deleteAndCount();
  await db.orm.public.Notification.where({ userId: customer.id }).deleteAndCount();
  await db.orm.public.ActivityEvent.where((event) => event.createdAt.gte(start)).deleteAndCount();
  await db.orm.public.SubscriptionRequest.where({ userId: customer.id }).deleteAndCount();
  await db.orm.public.Subscription.where({ userId: customer.id }).deleteAndCount();
  await db.orm.public.PackageOption.where({ packageId: pkg.id }).deleteAndCount();
  await db.orm.public.Package.where({ id: pkg.id }).deleteAndCount();
  await db.orm.public.CreditPurchase.where((row) => row.note.eq(`it-${R}`)).deleteAndCount();
  await db.orm.public.SiteSetting.where((s) => s.key.like("loyalty.%")).deleteAndCount();
  for (const row of savedSettings) await db.orm.public.SiteSetting.create({ key: row.key, value: row.value, updatedBy: row.updatedBy ?? null });
  for (const id of [customer.id, admin.id, owner.id]) await db.orm.public.User.where({ id }).deleteAndCount();
  console.log(results.join("\n"));
  console.log(`\n${results.filter((line) => line.startsWith("PASS")).length}/${results.length} passed`);
  await db.close();
}
