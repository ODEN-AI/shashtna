import { checkTerm, planBackfill, type TermKind } from "@/src/lib/subscription-terms";
import { db } from "@/src/prisma/db";

/**
 * Subscription terms (phase 6, step 2) — database side. See docs/bi/subscription-terms.md.
 *
 * recordTerm is called right after every activation / renewal writes its
 * receipt (site activation route, supplier orders, digital platforms) with
 * the exact dates that activation used. It is best effort: a failure is
 * logged and never fails the activation — the backfill fills any receipt
 * that has no term (one term per receipt, `receiptId` unique).
 */

export type TermRecord = {
  subscriptionId: number;
  userId: number;
  serviceType: string;
  kind: TermKind;
  startsOn: string;
  endsOn: string;
  months: number;
  receiptId: number;
  orderId: number | null;
};

/** Record one term. Never throws; returns whether a row was written. */
export async function recordTerm(term: TermRecord): Promise<boolean> {
  try {
    const value = { ...term, startsOn: String(term.startsOn).slice(0, 10), endsOn: String(term.endsOn).slice(0, 10), serviceType: String(term.serviceType).toUpperCase() };
    const problem = checkTerm(value);

    if (problem) {
      console.error("SUBSCRIPTION_TERM_INVALID:", problem, "receipt", term.receiptId);
      return false;
    }

    if (await db.orm.public.SubscriptionTerm.first({ receiptId: term.receiptId })) return false;

    await db.orm.public.SubscriptionTerm.create({ ...value, source: "ACTIVATION", matchesExpiry: true });

    return true;
  } catch (error) {
    // A unique-key race (the same receipt twice) lands here too: the term exists.
    console.error("SUBSCRIPTION_TERM_ERROR:", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Fill terms for receipts that have none, replayed from receipts with the
 * activation rule. `apply: false` only plans (reads). Idempotent: a second run
 * adds nothing. Returns counts only.
 */
export async function backfillTerms(options: { apply: boolean }) {
  const [subscriptions, receipts, recorded] = await Promise.all([
    db.orm.public.Subscription.select("id", "userId", "serviceType", "startDate", "expiryDate").all(),
    db.orm.public.Receipt.select("id", "orderId", "subscriptionId", "durationMonths", "createdAt").all(),
    db.orm.public.SubscriptionTerm.select("receiptId").all(),
  ]);

  const plan = planBackfill({
    subscriptions: subscriptions.map((sub) => ({ id: sub.id, userId: sub.userId, serviceType: String(sub.serviceType), startDate: String(sub.startDate), expiryDate: String(sub.expiryDate) })),
    receipts: receipts.map((receipt) => ({ id: receipt.id, orderId: receipt.orderId ?? null, subscriptionId: receipt.subscriptionId, durationMonths: receipt.durationMonths, createdAt: String(receipt.createdAt) })),
    recordedReceiptIds: new Set(recorded.flatMap((row) => (row.receiptId ? [row.receiptId] : []))),
  });

  let added = 0;

  if (options.apply) {
    for (const term of plan.toAdd) {
      if (checkTerm(term)) continue;

      try {
        await db.orm.public.SubscriptionTerm.create({
          subscriptionId: term.subscriptionId,
          userId: term.userId,
          serviceType: term.serviceType,
          kind: term.kind,
          startsOn: term.startsOn,
          endsOn: term.endsOn,
          months: term.months,
          receiptId: term.receiptId,
          orderId: term.orderId,
          source: "BACKFILL",
          matchesExpiry: term.matchesExpiry,
        });
        added += 1;
      } catch (error) {
        // Recorded meanwhile by an activation (unique receiptId): nothing to do.
        console.error("SUBSCRIPTION_TERM_BACKFILL_SKIPPED:", error instanceof Error ? error.message : error);
      }
    }
  }

  return {
    subscriptions: subscriptions.length,
    receipts: receipts.length,
    alreadyRecorded: plan.alreadyRecorded,
    toAdd: plan.toAdd.length,
    toAddMatching: plan.toAdd.filter((term) => term.matchesExpiry).length,
    mismatchedSubscriptions: plan.mismatchedSubscriptions,
    unreplayableSubscriptions: plan.unreplayableSubscriptions,
    orphanReceipts: plan.orphanReceipts,
    added,
  };
}
