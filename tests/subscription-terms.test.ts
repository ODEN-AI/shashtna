import assert from "node:assert/strict";
import { test } from "node:test";

const t = await import("@/src/lib/subscription-terms");

const receipt = (id: number, months: number, createdAt: string, orderId: number | null = null) => ({ id, orderId, durationMonths: months, createdAt });

test("terms: the first starts on the stored start date; an early renewal extends the expiry; a late one starts on the paid day", () => {
  const terms = t.termsFromReceipts("2026-01-01", [
    receipt(1, 3, "2026-01-01T09:00:00Z", 10),
    receipt(2, 3, "2026-03-20T09:00:00Z", 11),
    receipt(3, 6, "2026-09-10T22:30:00Z"), // after the July expiry; 01:30 on 11 Sep in Baghdad
  ]);

  assert.deepEqual(terms, [
    { receiptId: 1, orderId: 10, kind: "NEW", startsOn: "2026-01-01", endsOn: "2026-04-01", months: 3 },
    { receiptId: 2, orderId: 11, kind: "RENEW", startsOn: "2026-04-01", endsOn: "2026-07-01", months: 3 },
    { receiptId: 3, orderId: null, kind: "RENEW", startsOn: "2026-09-11", endsOn: "2027-03-11", months: 6 },
  ]);
});

test("terms: receipts are replayed in date order; an impossible length stops the replay", () => {
  const unordered = t.termsFromReceipts("2026-01-31", [receipt(2, 1, "2026-02-15T09:00:00Z"), receipt(1, 1, "2026-01-31T09:00:00Z")]);

  assert.deepEqual(unordered.map((term) => [term.receiptId, term.startsOn, term.endsOn]), [
    [1, "2026-01-31", "2026-02-28"],
    [2, "2026-02-28", "2026-03-28"],
  ]);
  assert.equal(t.termsFromReceipts("2026-01-01", [receipt(1, 0, "2026-01-01T09:00:00Z")]).length, 0);
});

test("terms: a replay matches the stored expiry within 7 days", () => {
  const terms = t.termsFromReceipts("2026-01-01", [receipt(1, 3, "2026-01-01T09:00:00Z")]);

  assert.equal(t.replayMatches(terms, "2026-04-01"), true);
  assert.equal(t.replayMatches(terms, "2026-04-08T00:00:00Z"), true);
  assert.equal(t.replayMatches(terms, "2026-04-09"), false);
  assert.equal(t.replayMatches([], "2026-04-01"), false);
});

test("terms: validation", () => {
  const good = { kind: "NEW", startsOn: "2026-01-01", endsOn: "2026-04-01", months: 3 };

  assert.equal(t.checkTerm(good), null);
  assert.equal(t.checkTerm({ ...good, kind: "UPGRADE" }), "kind");
  assert.equal(t.checkTerm({ ...good, startsOn: "2026-13-01" }), "startsOn");
  assert.equal(t.checkTerm({ ...good, endsOn: "2026-01-01" }), "order");
  assert.equal(t.checkTerm({ ...good, months: 0 }), "months");
  assert.equal(t.checkTerm({ ...good, months: 2.5 }), "months");
});

test("terms: the backfill plan skips recorded receipts, flags mismatches and counts orphans", () => {
  const plan = t.planBackfill({
    subscriptions: [
      { id: 1, userId: 7, serviceType: "iptv", startDate: "2026-01-01", expiryDate: "2026-07-01" }, // matches
      { id: 2, userId: 8, serviceType: "VIP", startDate: "2026-02-01", expiryDate: "2027-02-01" }, // manual edit
      { id: 3, userId: 9, serviceType: "IPTV", startDate: "2026-02-01", expiryDate: "2026-05-01" }, // no receipts
    ],
    receipts: [
      { ...receipt(1, 3, "2026-01-01T09:00:00Z", 10), subscriptionId: 1 },
      { ...receipt(2, 3, "2026-03-20T09:00:00Z", 11), subscriptionId: 1 },
      { ...receipt(3, 3, "2026-02-01T09:00:00Z"), subscriptionId: 2 },
      { ...receipt(4, 3, "2026-02-01T09:00:00Z"), subscriptionId: 99 },
    ],
    recordedReceiptIds: new Set([1]),
  });

  assert.deepEqual(plan.toAdd.map((term) => [term.receiptId, term.kind, term.serviceType, term.matchesExpiry]), [
    [2, "RENEW", "IPTV", true],
    [3, "NEW", "VIP", false],
  ]);
  assert.equal(plan.alreadyRecorded, 1);
  assert.equal(plan.mismatchedSubscriptions, 1);
  assert.equal(plan.orphanReceipts, 1);
  assert.equal(plan.unreplayableSubscriptions, 0);
});
