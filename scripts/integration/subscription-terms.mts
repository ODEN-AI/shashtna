/**
 * Integration check of subscription terms (phase 6, step 2) against a LOCAL database:
 *
 *   node --experimental-strip-types --import ./tests/register-alias.mjs scripts/integration/subscription-terms.mts
 *
 * A real supplier order records a NEW term, its renewal a RENEW term that
 * starts at the previous expiry; recording the same receipt twice keeps one
 * row; an invalid term is refused; the backfill fills a receipt without a
 * term, flags a mismatching replay, and adds nothing on a second run.
 * Refuses any non-local DATABASE_URL. Removes the rows it creates.
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
const { createSupplierSubscription } = await import("@/src/server/supplier-orders");
const { recordTerm, backfillTerms } = await import("@/src/server/subscription-terms");
const { businessDay } = await import("@/src/lib/business-time");
const { addMonthsClamped } = await import("@/src/lib/subscription-duration");

const o = db.orm.public;
const R = Date.now().toString(36);
const start = new Date(Date.now() - 1000).toISOString();
const owner = await o.User.where((u) => u.role.in(["OWNER", "ADMIN"])).first();
const customer = await o.User.where({ role: "CUSTOMER" }).first();
assert.ok(owner && customer, "the local database needs an OWNER/ADMIN and a CUSTOMER user");
const actor = { id: owner!.id, role: owner!.role };
const subs: number[] = [];
const orders: number[] = [];
const results: string[] = [];
const check = async (name: string, fn: () => Promise<void>) => {
  try {
    await fn();
    results.push(`PASS  ${name}`);
  } catch (error) {
    results.push(`FAIL  ${name}\n      ${String((error as Error).message).replace(/\s*\n\s*/g, " ").slice(0, 300)}`);
  }
};
const termsOf = (subscriptionId: number) => o.SubscriptionTerm.where({ subscriptionId }).orderBy((t) => t.id.asc()).all();

await check("a supplier order records a NEW term; its renewal a RENEW term from the previous expiry", async () => {
  const first = await createSupplierSubscription(actor, customer!.id, { months: "3", price: "10000", supplierShare: "2000", username: `term-${R}` });
  assert.equal(first.ok, true, JSON.stringify(first));
  if (!first.ok) return;
  subs.push(first.subscriptionId);
  orders.push(first.orderId);

  const today = businessDay(new Date());
  const firstEnd = addMonthsClamped(today, 3)!;
  let terms = await termsOf(first.subscriptionId);
  assert.equal(terms.length, 1);
  assert.deepEqual([terms[0].kind, terms[0].startsOn, terms[0].endsOn, terms[0].months, terms[0].source, terms[0].orderId], ["NEW", today, firstEnd, 3, "ACTIVATION", first.orderId]);

  const renewal = await createSupplierSubscription(actor, customer!.id, { months: "6", price: "18000", supplierShare: "3000", subscriptionId: String(first.subscriptionId) });
  assert.equal(renewal.ok, true, JSON.stringify(renewal));
  if (!renewal.ok) return;
  orders.push(renewal.orderId);

  terms = await termsOf(first.subscriptionId);
  assert.equal(terms.length, 2);
  assert.deepEqual([terms[1].kind, terms[1].startsOn, terms[1].endsOn, terms[1].months], ["RENEW", firstEnd, addMonthsClamped(firstEnd, 6), 6], "an early renewal starts at the running expiry");

  const sub = await o.Subscription.first({ id: first.subscriptionId });
  assert.equal(String(sub!.expiryDate).slice(0, 10), terms[1].endsOn, "the last term ends where the subscription does");
});

await check("the same receipt is recorded once; an invalid term is refused", async () => {
  const [term] = await termsOf(subs[0]);
  const again = await recordTerm({ subscriptionId: subs[0], userId: customer!.id, serviceType: "IPTV", kind: "NEW", startsOn: term.startsOn, endsOn: term.endsOn, months: 3, receiptId: term.receiptId!, orderId: term.orderId ?? null });
  assert.equal(again, false);
  assert.equal((await termsOf(subs[0])).length, 2);

  const bad = await recordTerm({ subscriptionId: subs[0], userId: customer!.id, serviceType: "IPTV", kind: "NEW", startsOn: "2026-05-01", endsOn: "2026-04-01", months: 3, receiptId: 999_999_999, orderId: null });
  assert.equal(bad, false);
  assert.equal(await o.SubscriptionTerm.first({ receiptId: 999_999_999 }), null);
});

await check("the backfill fills receipts without terms, flags a mismatched replay, then adds nothing", async () => {
  // A subscription whose receipt has no term (as before step 2), and its stored expiry edited by hand.
  const sub = await o.Subscription.create({ userId: customer!.id, serviceType: "IPTV", status: "ACTIVE", packageName: `term-${R}`, startDate: "2026-01-01", expiryDate: "2027-01-01" });
  subs.push(sub.id);
  await o.Receipt.create({ receiptNumber: `TERM-${R}`, userId: customer!.id, subscriptionId: sub.id, serviceType: "IPTV", serviceName: "IPTV", price: 5000, durationMonths: 3, durationLabel: "3 أشهر", bonusYears: 0, status: "PAID" });

  const plan = await backfillTerms({ apply: false });
  assert.ok(plan.toAdd >= 1, "the receipt is planned");
  assert.equal(plan.added, 0, "check mode writes nothing");
  assert.equal((await termsOf(sub.id)).length, 0);

  const applied = await backfillTerms({ apply: true });
  assert.ok(applied.added >= 1);
  const [term] = await termsOf(sub.id);
  assert.deepEqual([term.kind, term.startsOn, term.endsOn, term.source, term.matchesExpiry], ["NEW", "2026-01-01", "2026-04-01", "BACKFILL", false]);

  const second = await backfillTerms({ apply: true });
  assert.equal(second.toAdd, 0, "idempotent");
  assert.equal(second.added, 0);
});

// Clean up: everything this script created.
for (const id of subs) {
  await o.SubscriptionTerm.where({ subscriptionId: id }).delete();
  await o.Receipt.where({ subscriptionId: id }).delete();
}
for (const id of orders) await o.SubscriptionRequest.where({ id }).delete();
for (const id of subs) await o.Subscription.where({ id }).delete();
await o.Notification.where({ userId: customer!.id }).where((n) => n.createdAt.gte(start)).delete();
await o.ActivityEvent.where((e) => e.createdAt.gte(start)).where((e) => e.userId.eq(customer!.id)).delete();

console.log(results.join("\n"));
const failed = results.filter((line) => line.startsWith("FAIL")).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
