/**
 * Integration check of discounts against a LOCAL database, through the
 * services (no server needed):
 *
 *   node --experimental-strip-types --import ./tests/register-alias.mjs scripts/integration/discounts.mts
 *
 * Orders store list price / discount / price; renewal scope; a reused unpaid
 * order is repriced; reward and supplier orders are untouched; loyalty earns
 * on the price paid; overlaps are refused; full-access only. It creates
 * throwaway rows and removes them. Refuses any non-local DATABASE_URL.
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
const { saveDiscount, endDiscount, activeDiscountFor } = await import("@/src/server/discounts");
const { createOrder, completeOrderWithSubscription } = await import("@/src/server/orders");
const { createSupplierSubscription } = await import("@/src/server/supplier-orders");
const { getActivePackages } = await import("@/src/server/catalog");
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

const admin = await db.orm.public.User.create({ name: "discount admin", phone: `0794${R}`, passwordHash: "x", role: "ADMIN" });
const operator = await db.orm.public.User.create({ name: "discount operator", phone: `0795${R}`, passwordHash: "x", role: "OPERATOR" });
const customer = await db.orm.public.User.create({ name: "discount customer", phone: `0796${R}`, passwordHash: "x" });
const full = { id: admin.id, role: "ADMIN" };
const pkg = await db.orm.public.Package.create({ name: `disc ${R}`, slug: `disc-${R}`, serviceType: "IPTV", price: 6000, durationMonths: 3, durationLabel: "3", description: "", specifications: "" });
const o3 = await db.orm.public.PackageOption.create({ packageId: pkg.id, durationMonths: 3, durationLabel: "3 أشهر", price: 6000, renewalPrice: 5000 });
const o6 = await db.orm.public.PackageOption.create({ packageId: pkg.id, durationMonths: 6, durationLabel: "6 أشهر", price: 10000 });
const savedSettings = await db.orm.public.SiteSetting.where((s) => s.key.like("loyalty.%")).all();
const ids: Record<string, number> = {};

try {
  await check("only full-access staff manage discounts; bad values and overlaps are refused", async () => {
    assert.equal((await saveDiscount({ id: operator.id, role: "OPERATOR" }, o3.id, { kind: "PERCENT", value: "20" })).ok, false);
    assert.equal((await saveDiscount(full, o3.id, { kind: "PERCENT", value: "95" })).ok, false);
    const created = await saveDiscount(full, o3.id, { kind: "PERCENT", value: "20" });
    assert.ok(created.ok);
    ids.d3 = created.ok ? created.id : 0;
    const clash = await saveDiscount(full, o3.id, { kind: "AMOUNT", value: "500", startsAt: "2030-01-01T00:00" });
    assert.equal(clash.ok, false, "an open-ended discount blocks any later one");
    assert.match(clash.ok ? "" : clash.error, /خصم ثاني/);
    const audit = await db.orm.public.ActivityEvent.where({ action: "DISCOUNT_CREATED", entityType: "PACKAGE", entityId: String(pkg.id) }).all();
    assert.equal(audit.length, 1);
    assert.match(String(audit[0].details), /→ 20%/);
  });

  await check("the catalogue shows the active discount with the price it gives", async () => {
    const plan = (await getActivePackages()).find((row) => row.slug === pkg.slug);
    const three = plan?.options.find((option) => option.id === o3.id);
    assert.deepEqual([three?.discount?.kind, three?.discount?.value, three?.discount?.price, three?.discount?.renewalPrice], ["PERCENT", 20, 4800, null]);
    assert.equal(plan?.options.find((option) => option.id === o6.id)?.discount, null);
  });

  await check("a NEW order stores list price, discount and the price paid (client price ignored)", async () => {
    const r = await createOrder(customer.id, { requestType: "NEW", planSlug: pkg.slug, optionId: o3.id, price: 1 } as never);
    assert.ok(r.ok);
    if (!r.ok) return;
    ids.newOrder = r.order.id;
    const row = await db.orm.public.SubscriptionRequest.first({ id: r.order.id });
    assert.deepEqual([row?.listPrice, row?.discountIqd, row?.discountId, row?.price], [6000, 1200, ids.d3, 4800]);
  });

  await check("renewals keep their price unless the discount covers them", async () => {
    const sub = await db.orm.public.Subscription.create({ userId: customer.id, serviceType: "IPTV", packageName: "x", startDate: "2026-10-01", expiryDate: "2027-01-01" });
    ids.sub = sub.id;
    const plain = await createOrder(customer.id, { requestType: "RENEW", planSlug: pkg.slug, optionId: o3.id, subscriptionId: sub.id });
    assert.ok(plain.ok);
    if (!plain.ok) return;
    let row = await db.orm.public.SubscriptionRequest.first({ id: plain.order.id });
    assert.deepEqual([row?.listPrice, row?.discountIqd, row?.price], [5000, null, 5000]);

    const edited = await saveDiscount(full, o3.id, { kind: "PERCENT", value: "20", appliesToRenewals: "on" }, ids.d3);
    assert.ok(edited.ok);
    // The same unpaid renewal checked out again is repriced at today's price.
    const again = await createOrder(customer.id, { requestType: "RENEW", planSlug: pkg.slug, optionId: o3.id, subscriptionId: sub.id });
    assert.ok(again.ok && again.alreadyExists && again.order.id === plain.order.id, "the unpaid order is reused");
    row = await db.orm.public.SubscriptionRequest.first({ id: plain.order.id });
    assert.deepEqual([row?.listPrice, row?.discountIqd, row?.price], [5000, 1000, 4000]);
    ids.renewOrder = plain.order.id;
  });

  await check("ending the discount reprices a reused unpaid order back to the list price", async () => {
    assert.ok((await endDiscount(full, ids.d3)).ok);
    assert.equal(await activeDiscountFor(o3.id), null);
    const again = await createOrder(customer.id, { requestType: "NEW", planSlug: pkg.slug, optionId: o3.id });
    assert.ok(again.ok && again.order.id === ids.newOrder);
    const row = await db.orm.public.SubscriptionRequest.first({ id: ids.newOrder });
    assert.deepEqual([row?.listPrice, row?.discountIqd, row?.discountId, row?.price], [6000, null, null, 6000]);
    assert.equal((await endDiscount({ id: operator.id, role: "OPERATOR" }, ids.d3)).ok, false);
  });

  await check("a paid order never changes; loyalty earns on the price paid", async () => {
    const set = async (key: string, value: string) => {
      const existing = await db.orm.public.SiteSetting.first({ key });
      if (existing) await db.orm.public.SiteSetting.where({ key }).update({ value });
      else await db.orm.public.SiteSetting.create({ key, value });
    };
    await set("loyalty.enabled", "on");
    const d6 = await saveDiscount(full, o6.id, { kind: "AMOUNT", value: "2500" });
    assert.ok(d6.ok);
    ids.d6 = d6.ok ? d6.id : 0;
    const r = await createOrder(customer.id, { requestType: "NEW", planSlug: pkg.slug, optionId: o6.id });
    assert.ok(r.ok);
    if (!r.ok) return;
    await db.orm.public.SubscriptionRequest.where({ id: r.order.id }).update({ status: "PAID" });
    await completeOrderWithSubscription(full, r.order.id, ids.sub, { price: 7500, durationMonths: 6, durationLabel: "6", bonusYears: 0 });
    const earn = await db.orm.public.LoyaltyEntry.first({ idempotencyKey: `earn:order:${r.order.id}` });
    assert.equal(earn?.points, 7, "7,500 paid → 7 points, not 10");
    await saveDiscount(full, o6.id, { kind: "AMOUNT", value: "1000" }, ids.d6);
    const row = await db.orm.public.SubscriptionRequest.first({ id: r.order.id });
    assert.deepEqual([row?.listPrice, row?.discountIqd, row?.price, row?.status], [10000, 2500, 7500, "COMPLETED"]);
    ids.paidOrder = r.order.id;
  });

  await check("supplier orders and reward orders are never discounted", async () => {
    const supplier = await createSupplierSubscription(full, customer.id, { months: "24", price: "15000", supplierShare: "10000", username: `disc${R}` });
    assert.ok(supplier.ok);
    if (!supplier.ok) return;
    const row = await db.orm.public.SubscriptionRequest.first({ id: supplier.orderId });
    assert.deepEqual([row?.price, row?.listPrice ?? null, row?.discountIqd ?? null], [15000, null, null]);
    const rewards = await db.orm.public.SubscriptionRequest.where({ loyaltyReward: true }).where((order) => order.discountIqd.gt(0)).all();
    assert.equal(rewards.length, 0);
  });

  await check("finance counts discounted sales and the discount given", async () => {
    const snapshot = await getFinanceSnapshot({ period: "custom", from: "2026-10-01", to: "2027-12-31", view: "month" }, new Date("2027-12-30T00:00:00Z"));
    assert.ok(snapshot.discounts.current.sales >= 1);
    assert.ok(snapshot.discounts.current.amount >= 2500);
  });
} finally {
  await db.orm.public.LoyaltyEntry.where({ userId: customer.id }).deleteAndCount();
  await db.orm.public.LoyaltyAccount.where({ userId: customer.id }).deleteAndCount();
  await db.orm.public.Receipt.where({ userId: customer.id }).deleteAndCount();
  await db.orm.public.Notification.where({ userId: customer.id }).deleteAndCount();
  await db.orm.public.ActivityEvent.where((event) => event.createdAt.gte(start)).deleteAndCount();
  await db.orm.public.SubscriptionRequest.where({ userId: customer.id }).deleteAndCount();
  await db.orm.public.Subscription.where({ userId: customer.id }).deleteAndCount();
  await db.orm.public.Discount.where((row) => row.packageOptionId.in([o3.id, o6.id])).deleteAndCount();
  await db.orm.public.PackageOption.where({ packageId: pkg.id }).deleteAndCount();
  await db.orm.public.Package.where({ id: pkg.id }).deleteAndCount();
  await db.orm.public.SiteSetting.where((s) => s.key.like("loyalty.%")).deleteAndCount();
  for (const row of savedSettings) await db.orm.public.SiteSetting.create({ key: row.key, value: row.value, updatedBy: row.updatedBy ?? null });
  for (const id of [customer.id, operator.id, admin.id]) await db.orm.public.User.where({ id }).deleteAndCount();
  const failed = results.filter((line) => line.startsWith("FAIL")).length;
  console.log(results.join("\n"));
  console.log(`\n${results.length - failed}/${results.length} passed`);
  await db.close();
  process.exitCode = failed ? 1 : 0;
}
