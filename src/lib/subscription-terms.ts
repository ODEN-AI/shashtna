import { businessDay } from "@/src/lib/business-time";
import { addMonthsClamped } from "@/src/lib/subscription-duration";

/**
 * Subscription terms (phase 6, step 2) — pure rules. See docs/bi/subscription-terms.md.
 *
 * A renewal moves the same subscription's expiry, so the subscription row has
 * no history. A term is one paid period: every activation and renewal writes
 * one (from its receipt). Terms are recorded at activation with the exact
 * dates the activation used; older receipts are replayed with the same rule
 * (the first term starts on the stored start date; a renewal extends the
 * running expiry, or starts on the receipt's Baghdad day if it had ended).
 */

export const TERM_KINDS = ["NEW", "RENEW"] as const;
export type TermKind = (typeof TERM_KINDS)[number];

export const TERM_SOURCES = ["ACTIVATION", "BACKFILL"] as const;
export type TermSource = (typeof TERM_SOURCES)[number];

/** Days of difference between a replayed and a stored expiry still counted as matching. */
export const MATCH_DAYS = 7;

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export type TermInput = { kind: string; startsOn: string; endsOn: string; months: number };

/** A term is valid when its kind is known, its dates are real YYYY-MM-DD days in order and its length is 1–600 months. */
export function checkTerm(term: TermInput): string | null {
  if (!(TERM_KINDS as readonly string[]).includes(term.kind)) return "kind";
  if (!DATE.test(term.startsOn) || Number.isNaN(Date.parse(`${term.startsOn}T00:00:00Z`))) return "startsOn";
  if (!DATE.test(term.endsOn) || Number.isNaN(Date.parse(`${term.endsOn}T00:00:00Z`))) return "endsOn";
  if (term.endsOn <= term.startsOn) return "order";
  if (!Number.isInteger(term.months) || term.months < 1 || term.months > 600) return "months";

  return null;
}

/** Whole days between two YYYY-MM-DD dates (absolute). */
export function daysBetween(a: string, b: string) {
  return Math.round(Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000);
}

export type TermReceipt = { id: number; orderId: number | null; durationMonths: number; createdAt: string };
export type ReplayedTerm = { receiptId: number; orderId: number | null; kind: TermKind; startsOn: string; endsOn: string; months: number };

/**
 * One term per receipt, replayed in date order with the activation rule.
 * Stops (returns what it has) at a receipt whose dates can't be computed.
 */
export function termsFromReceipts(startDate: string, receipts: readonly TermReceipt[]): ReplayedTerm[] {
  const ordered = [...receipts].sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)) || a.id - b.id);
  const terms: ReplayedTerm[] = [];
  let end: string | null = null;

  for (const receipt of ordered) {
    const paid = businessDay(new Date(receipt.createdAt));
    const start: string = end === null ? String(startDate).slice(0, 10) : end >= paid ? end : paid;
    const next = addMonthsClamped(start, receipt.durationMonths);

    if (!next) break;

    terms.push({ receiptId: receipt.id, orderId: receipt.orderId, kind: terms.length ? "RENEW" : "NEW", startsOn: start, endsOn: next, months: receipt.durationMonths });
    end = next;
  }

  return terms;
}

/** Whether a replay ends where the subscription's stored expiry does (within MATCH_DAYS). */
export function replayMatches(terms: readonly ReplayedTerm[], storedExpiry: string) {
  const last = terms[terms.length - 1];

  return Boolean(last) && daysBetween(last.endsOn, String(storedExpiry).slice(0, 10)) <= MATCH_DAYS;
}

/**
 * The terms a backfill would add: for each subscription, the replayed terms of
 * receipts that have no term yet, flagged with whether the full replay matches
 * the stored expiry. Already-recorded receipts are skipped (idempotent).
 */
export function planBackfill(input: {
  subscriptions: readonly { id: number; userId: number; serviceType: string; startDate: string; expiryDate: string }[];
  receipts: readonly (TermReceipt & { subscriptionId: number })[];
  recordedReceiptIds: ReadonlySet<number>;
}) {
  const bySub = new Map<number, (TermReceipt & { subscriptionId: number })[]>();

  for (const receipt of input.receipts) bySub.set(receipt.subscriptionId, [...(bySub.get(receipt.subscriptionId) ?? []), receipt]);

  const toAdd: (ReplayedTerm & { subscriptionId: number; userId: number; serviceType: string; matchesExpiry: boolean })[] = [];
  let mismatched = 0;
  let unreplayable = 0;

  for (const sub of input.subscriptions) {
    const receipts = bySub.get(sub.id) ?? [];

    if (!receipts.length) continue;

    const terms = termsFromReceipts(sub.startDate, receipts);
    const matches = replayMatches(terms, sub.expiryDate);

    if (terms.length < receipts.length) unreplayable += 1;
    if (!matches) mismatched += 1;

    for (const term of terms) {
      if (input.recordedReceiptIds.has(term.receiptId)) continue;
      toAdd.push({ ...term, subscriptionId: sub.id, userId: sub.userId, serviceType: String(sub.serviceType).toUpperCase(), matchesExpiry: matches });
    }
  }

  const known = new Set(input.subscriptions.map((sub) => sub.id));

  return {
    toAdd,
    alreadyRecorded: input.receipts.filter((receipt) => input.recordedReceiptIds.has(receipt.id)).length,
    mismatchedSubscriptions: mismatched,
    unreplayableSubscriptions: unreplayable,
    orphanReceipts: input.receipts.filter((receipt) => !known.has(receipt.subscriptionId)).length,
  };
}
