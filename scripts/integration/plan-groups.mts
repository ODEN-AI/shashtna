/**
 * Integration check of plan groups and digital platforms against a LOCAL
 * database, through the services (no server needed):
 *
 *   node --experimental-strip-types --import ./tests/register-alias.mjs scripts/integration/plan-groups.mts
 *
 * The built-in group backfill is idempotent; groups are validated and
 * audited; a platform order with each delivery type (CODE, ACCOUNT,
 * CUSTOMER_EMAIL); fulfilment masking and the audited reveal; renewals stay
 * in the same group; discounts and costs on platform options; platform points
 * and no loyalty reward for platforms. Throwaway rows are removed at the end.
 * Refuses any non-local DATABASE_URL.
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
const { readFileSync } = await import("node:fs");
const { saveGroup, groupForPackage } = await import("@/src/server/groups");
const { createOrder, serializeOrder } = await import("@/src/server/orders");
const { fulfilPlatformOrder, revealDeliveryCode, ownDeliveryCode } = await import("@/src/server/platform-orders");
const { getActivePackages } = await import("@/src/server/catalog");
const { saveDiscount } = await import("@/src/server/discounts");
const { getLoyalty } = await import("@/src/server/loyalty");

const sql = db.raw.sql;
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

const owner = await db.orm.public.User.create({ name: "groups owner", phone: `0797${R}`, passwordHash: "x", role: "ADMIN" });
const support = await db.orm.public.User.create({ name: "groups support", phone: `0798${R}`, passwordHash: "x", role: "SUPPORT" });
const a = await db.orm.public.User.create({ name: "groups customer a", phone: `0799${R}`, passwordHash: "x" });
const b = await db.orm.public.User.create({ name: "groups customer b", phone: `0790${R}`, passwordHash: "x" });
const full = { id: owner.id, role: "ADMIN" };
const ids: Record<string, number> = {};
const groupIds: number[] = [];
const packageIds: number[] = [];
const savedSettings = await db.orm.public.SiteSetting.where((s) => s.key.like("loyalty.%")).all();

const groupRows = async () => (await db.orm.public.PackageGroup.all()).length;
const ungrouped = async () => (await db.orm.public.Package.where((p) => p.groupId.isNull()).all()).filter((p) => ["IPTV", "VIP"].includes(String(p.serviceType).toUpperCase())).length;

async function platformPackage(groupId: number, name: string, price: number, extra: { costIqd?: number; pointsEarned?: number } = {}) {
  const pkg = await db.orm.public.Package.create({ name, slug: `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${R}`, serviceType: "DIGITAL", groupId, price, durationMonths: 1, durationLabel: "شهر", description: "", specifications: "" });
  const option = await db.orm.public.PackageOption.create({ packageId: pkg.id, durationMonths: 1, durationLabel: "شهر", price, costIqd: extra.costIqd ?? null, pointsEarned: extra.pointsEarned ?? null });
  packageIds.push(pkg.id);
  return { pkg, option };
}

const paid = async (orderId: number) => db.orm.public.SubscriptionRequest.where({ id: orderId }).update({ status: "PAID" });

try {
  await check("built-in group backfill is idempotent (running its SQL again changes nothing)", async () => {
    const ops = JSON.parse(readFileSync(new URL("../../migrations/app/20261031T0738_plan_groups/ops.json", import.meta.url), "utf8")) as { operationClass: string; execute?: { sql: string }[] }[];
    const steps = ops.find((op) => op.operationClass === "data")!.execute!;
    const before = [await groupRows(), await ungrouped()];
    const grouping = (await db.orm.public.Package.select("id", "groupId").all()).map((p) => `${p.id}:${p.groupId}`).join(",");
    for (const step of steps) {
      // The migration's own statements, run a second time on the same database.
      const text = step.sql;
      await db.runtime().query(sql([text] as unknown as TemplateStringsArray).returnsRow({}).build()).toArray().catch(async () => {
        await db.runtime().query(sql([`${text} RETURNING 1 AS "one"`] as unknown as TemplateStringsArray).returnsRow({ one: "pg/int4@1" }).build()).toArray();
      });
    }
    assert.deepEqual([await groupRows(), await ungrouped()], before);
    assert.equal((await db.orm.public.Package.select("id", "groupId").all()).map((p) => `${p.id}:${p.groupId}`).join(","), grouping, "no package moved");
    assert.equal(before[1], 0, "no IPTV / VIP package without a group");
  });

  await check("groups: catalogue permission, contrast and slug rules on the server; audited", async () => {
    assert.equal((await saveGroup({ id: support.id, role: "SUPPORT" }, { name: "X", slug: `x-${R}`, accent: "#ff5a64", surface: "#1a0b10", delivery: "CODE" })).ok, false);
    const low = await saveGroup(full, { name: "Netflix low", slug: `nflow-${R}`, accent: "#e50914", surface: "#2a0a0a", delivery: "ACCOUNT" });
    assert.equal(low.ok, false);
    assert.equal((await saveGroup(full, { name: "IPTV copy", slug: "iptv", accent: "#ff5a64", surface: "#1a0b10", delivery: "ACCOUNT" })).ok, false, "built-in slug reserved");
    for (const [key, delivery] of [["code", "CODE"], ["account", "ACCOUNT"], ["email", "CUSTOMER_EMAIL"]] as const) {
      const r = await saveGroup(full, { name: `منصة ${key}`, slug: `p-${key}-${R}`, accent: "#ff5a64", surface: "#1a0b10", delivery, sortOrder: "20", isActive: "on" });
      assert.ok(r.ok, r.ok ? "" : r.error);
      if (r.ok) {
        ids[key] = r.id;
        groupIds.push(r.id);
      }
    }
    assert.equal((await db.orm.public.PackageGroup.first({ id: ids.code }))?.serviceType, "DIGITAL");
    assert.ok((await db.orm.public.ActivityEvent.where({ action: "GROUP_CREATED" }).all()).length >= 3);
    const iptvGroup = await db.orm.public.PackageGroup.first({ slug: "iptv" });
    assert.equal((await groupForPackage(iptvGroup!.id, "DIGITAL")).ok, false, "a platform package can't join the IPTV group");
    assert.equal((await groupForPackage(ids.code, "IPTV")).ok, false, "an IPTV package can't join a platform group");
    assert.equal((await groupForPackage(null, "DIGITAL")).ok, false, "a platform package needs a group");
  });

  const code = await platformPackage(ids.code, "Gift Card", 10000, { costIqd: 7500 });
  const account = await platformPackage(ids.account, "Netflix Premium", 12000, { pointsEarned: 4 });
  const email = await platformPackage(ids.email, "Disney Plus", 9000);

  await check("the catalogue sells platform packages only inside an active digital group", async () => {
    let slugs = (await getActivePackages()).filter((p) => p.serviceType === "DIGITAL").map((p) => p.slug);
    assert.ok([code.pkg.slug, account.pkg.slug, email.pkg.slug].every((slug) => slugs.includes(slug)));
    await db.orm.public.PackageGroup.where({ id: ids.email }).update({ isActive: false });
    slugs = (await getActivePackages()).filter((p) => p.serviceType === "DIGITAL").map((p) => p.slug);
    assert.ok(!slugs.includes(email.pkg.slug), "a hidden group hides its packages");
    const blocked = await createOrder(a.id, { requestType: "NEW", planSlug: email.pkg.slug, optionId: email.option.id, deliveryEmail: "a@example.com" });
    assert.equal(blocked.ok, false, "and they can't be ordered");
    await db.orm.public.PackageGroup.where({ id: ids.email }).update({ isActive: true });
  });

  await check("CODE: one-off order, the code is masked for staff, audited reveal, shown to its owner only", async () => {
    const r = await createOrder(a.id, { requestType: "NEW", planSlug: code.pkg.slug, optionId: code.option.id });
    assert.ok(r.ok);
    if (!r.ok) return;
    await paid(r.order.id);
    assert.equal((await fulfilPlatformOrder({ id: support.id, role: "SUPPORT" }, r.order.id, { code: "GIFT-ABC-123" })).ok, false, "no subscriptions permission");
    assert.equal((await fulfilPlatformOrder(full, r.order.id, { code: "x" })).ok, false, "too short");
    const done = await fulfilPlatformOrder(full, r.order.id, { code: "GIFT-ABC-123" });
    assert.deepEqual(done, { ok: true, subscriptionId: null });
    const row = await db.orm.public.SubscriptionRequest.first({ id: r.order.id });
    assert.deepEqual([row?.status, row?.deliveryCode, row?.creditCostIqd], ["COMPLETED", "GIFT-ABC-123", 7500], "fixed cost snapshotted");
    const shaped = serializeOrder(row!, { staff: true });
    assert.equal(JSON.stringify(shaped).includes("GIFT-ABC-123"), false, "the staff order shape never carries the code");
    assert.equal(shaped.hasDeliveryCode, true);
    assert.equal(await ownDeliveryCode(a.id, r.order.id), "GIFT-ABC-123");
    assert.equal(await ownDeliveryCode(b.id, r.order.id), null, "another customer gets nothing");
    assert.equal((await revealDeliveryCode({ id: support.id, role: "SUPPORT" }, r.order.id)).ok, false);
    const reveal = await revealDeliveryCode(full, r.order.id);
    assert.ok(reveal.ok && reveal.code === "GIFT-ABC-123");
    assert.equal((await db.orm.public.ActivityEvent.where({ action: "ORDER_DELIVERY_CODE_REVEALED", entityId: String(r.order.id) }).all()).length, 1);
    assert.equal((await db.orm.public.Subscription.where({ userId: a.id }).all()).length, 0, "no subscription for a code");
    const renew = await createOrder(a.id, { requestType: "RENEW", planSlug: code.pkg.slug, optionId: code.option.id });
    assert.equal(renew.ok, false, "a code can't be renewed");
  });

  await check("ACCOUNT: a ready account becomes a DIGITAL subscription; renewals extend it, same group only", async () => {
    const r = await createOrder(a.id, { requestType: "NEW", planSlug: account.pkg.slug, optionId: account.option.id });
    assert.ok(r.ok);
    if (!r.ok) return;
    await paid(r.order.id);
    assert.equal((await fulfilPlatformOrder(full, r.order.id, { accountEmail: "shared@netflix.test" })).ok, false, "a new ready account needs its password");
    const done = await fulfilPlatformOrder(full, r.order.id, { accountEmail: "shared@netflix.test", password: "pw-1" });
    assert.ok(done.ok && done.subscriptionId);
    if (!done.ok || !done.subscriptionId) return;
    ids.accountSub = done.subscriptionId;
    const sub = await db.orm.public.Subscription.first({ id: done.subscriptionId });
    assert.deepEqual([sub?.serviceType, sub?.accountEmail, sub?.password, sub?.username ?? null, sub?.packageId], ["DIGITAL", "shared@netflix.test", "pw-1", null, account.pkg.id]);

    // The same ready account for another customer (profiles): allowed, the e-mail isn't unique.
    const other = await createOrder(b.id, { requestType: "NEW", planSlug: account.pkg.slug, optionId: account.option.id });
    assert.ok(other.ok);
    if (other.ok) {
      await paid(other.order.id);
      assert.ok((await fulfilPlatformOrder(full, other.order.id, { accountEmail: "shared@netflix.test", password: "pw-1" })).ok);
    }

    const expiry = String(sub?.expiryDate).slice(0, 10);
    const renew = await createOrder(a.id, { requestType: "RENEW", planSlug: account.pkg.slug, optionId: account.option.id, subscriptionId: done.subscriptionId });
    assert.ok(renew.ok, renew.ok ? "" : renew.error);
    if (!renew.ok) return;
    await paid(renew.order.id);
    assert.ok((await fulfilPlatformOrder(full, renew.order.id, {})).ok, "a renewal keeps the account");
    const after = await db.orm.public.Subscription.first({ id: done.subscriptionId });
    assert.notEqual(String(after?.expiryDate).slice(0, 10), expiry);
    assert.equal(after?.password, "pw-1");

    const iptvSub = await db.orm.public.Subscription.create({ userId: a.id, serviceType: "IPTV", packageName: "x", startDate: "2026-10-01", expiryDate: "2027-01-01" });
    ids.iptvSub = iptvSub.id;
    assert.equal((await createOrder(a.id, { requestType: "RENEW", planSlug: account.pkg.slug, optionId: account.option.id, subscriptionId: iptvSub.id })).ok, false, "never renews an IPTV subscription");
  });

  await check("CUSTOMER_EMAIL: the e-mail is required and validated; activation uses it", async () => {
    assert.equal((await createOrder(a.id, { requestType: "NEW", planSlug: email.pkg.slug, optionId: email.option.id })).ok, false);
    assert.equal((await createOrder(a.id, { requestType: "NEW", planSlug: email.pkg.slug, optionId: email.option.id, deliveryEmail: "not-an-email" })).ok, false);
    const r = await createOrder(a.id, { requestType: "NEW", planSlug: email.pkg.slug, optionId: email.option.id, deliveryEmail: " Me@Example.com " });
    assert.ok(r.ok);
    if (!r.ok) return;
    assert.equal(r.order.deliveryEmail, "me@example.com");
    await paid(r.order.id);
    const done = await fulfilPlatformOrder(full, r.order.id, {});
    assert.ok(done.ok && done.subscriptionId);
    const sub = done.ok && done.subscriptionId ? await db.orm.public.Subscription.first({ id: done.subscriptionId }) : null;
    assert.deepEqual([sub?.accountEmail, sub?.password ?? null], ["me@example.com", null]);
    // Renewing a Disney subscription with the Netflix package: refused.
    assert.equal((await createOrder(a.id, { requestType: "RENEW", planSlug: account.pkg.slug, optionId: account.option.id, subscriptionId: sub!.id })).ok, false, "a renewal stays in its group");
  });

  await check("discounts apply to platform options like any option", async () => {
    const d = await saveDiscount(full, account.option.id, { kind: "PERCENT", value: "25" });
    assert.ok(d.ok);
    const r = await createOrder(b.id, { requestType: "NEW", planSlug: account.pkg.slug, optionId: account.option.id });
    assert.ok(r.ok);
    if (!r.ok) return;
    const row = await db.orm.public.SubscriptionRequest.first({ id: r.order.id });
    assert.deepEqual([row?.listPrice, row?.discountIqd, row?.price], [12000, 3000, 9000]);
  });

  await check("platform points (option override or 1 per 5,000); platforms never redeem rewards", async () => {
    const set = async (key: string, value: string) => {
      const existing = await db.orm.public.SiteSetting.first({ key });
      if (existing) await db.orm.public.SiteSetting.where({ key }).update({ value });
      else await db.orm.public.SiteSetting.create({ key, value });
    };
    await set("loyalty.enabled", "on");
    const r = await createOrder(b.id, { requestType: "NEW", planSlug: code.pkg.slug, optionId: code.option.id });
    assert.ok(r.ok);
    if (!r.ok) return;
    await paid(r.order.id);
    await fulfilPlatformOrder(full, r.order.id, { code: "GIFT-POINTS-1" });
    assert.equal((await db.orm.public.LoyaltyEntry.first({ idempotencyKey: `earn:order:${r.order.id}` }))?.points, 2, "10,000 IQD → 2 points");
    // B only has platform subscriptions: rewards (IPTV renewals) are not open to them.
    const view = await getLoyalty(b.id);
    assert.equal(view.subscriptions.length, 0);
    assert.ok(view.rewards.every((reward) => reward.problem !== null));
  });
} finally {
  for (const user of [a, b]) {
    await db.orm.public.LoyaltyEntry.where({ userId: user.id }).deleteAndCount();
    await db.orm.public.LoyaltyAccount.where({ userId: user.id }).deleteAndCount();
    await db.orm.public.Receipt.where({ userId: user.id }).deleteAndCount();
    await db.orm.public.Notification.where({ userId: user.id }).deleteAndCount();
    await db.orm.public.SubscriptionRequest.where({ userId: user.id }).deleteAndCount();
    await db.orm.public.Subscription.where({ userId: user.id }).deleteAndCount();
  }
  await db.orm.public.ActivityEvent.where((event) => event.createdAt.gte(start)).deleteAndCount();
  if (packageIds.length) {
    const options = await db.orm.public.PackageOption.where((o) => o.packageId.in(packageIds)).all();
    if (options.length) await db.orm.public.Discount.where((d) => d.packageOptionId.in(options.map((o) => o.id))).deleteAndCount();
    await db.orm.public.PackageOption.where((o) => o.packageId.in(packageIds)).deleteAndCount();
    await db.orm.public.Package.where((p) => p.id.in(packageIds)).deleteAndCount();
  }
  if (groupIds.length) await db.orm.public.PackageGroup.where((row) => row.id.in(groupIds)).deleteAndCount();
  await db.orm.public.PackageGroup.where((row) => row.slug.like(`%-${R}`)).deleteAndCount();
  await db.orm.public.SiteSetting.where((s) => s.key.like("loyalty.%")).deleteAndCount();
  for (const row of savedSettings) await db.orm.public.SiteSetting.create({ key: row.key, value: row.value, updatedBy: row.updatedBy ?? null });
  for (const user of [a, b, support, owner]) await db.orm.public.User.where({ id: user.id }).deleteAndCount();
  const failed = results.filter((line) => line.startsWith("FAIL")).length;
  console.log(results.join("\n"));
  console.log(`\n${results.length - failed}/${results.length} passed`);
  await db.close();
  process.exitCode = failed ? 1 : 0;
}
