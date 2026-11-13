import { businessDay } from "@/src/lib/business-time";
import { daysBetween, termsFromReceipts } from "@/src/lib/subscription-terms";

/**
 * Phase 6, step 1 — the subscription-history data audit (pure rules).
 * See docs/bi/data-audit.md.
 *
 * A renewal moves the same subscription's expiry, so the site keeps no
 * history of terms. Every activation and renewal (site, supplier, digital
 * platforms) writes a receipt with the subscription id and its length
 * (bonus months included). This audit measures how far those receipts can
 * rebuild the history: it replays each subscription's receipts with the
 * same date rule the activation code uses and compares the result with the
 * stored expiry. A match means the history is complete for that
 * subscription; a gap usually means a manual edit or a pre-receipt row.
 *
 * Output is counts and months only: never names, phones, credentials or ids.
 */

export type AuditSubscription = { id: number; userId: number; serviceType: string; status: string; startDate: string; expiryDate: string; createdAt: string };
export type AuditReceipt = { subscriptionId: number; durationMonths: number; createdAt: string; orderId: number | null };
export type AuditOrder = { id: number; status: string; requestType: string; channel: string; subscriptionId: number | null; loyaltyReward: boolean };
export type AuditEvent = { action: string; entityId: string | null };

const day = (value: string) => String(value ?? "").slice(0, 10);
const month = (value: string) => String(value ?? "").slice(0, 7);

export { daysBetween };

/**
 * The expiry a subscription would have from its receipts alone — the end of
 * the last replayed term (same rule as activation; see subscription-terms.ts).
 * Null without receipts.
 */
export function replayExpiry(startDate: string, receipts: readonly Pick<AuditReceipt, "durationMonths" | "createdAt">[]) {
  const terms = termsFromReceipts(
    startDate,
    receipts.map((receipt, index) => ({ id: index + 1, orderId: null, durationMonths: receipt.durationMonths, createdAt: receipt.createdAt })),
  );

  return terms.length === receipts.length && terms.length ? terms[terms.length - 1].endsOn : null;
}

const SERVICES = ["IPTV", "VIP", "DIGITAL"] as const;
const ORDER_TYPES = ["NEW", "RENEW", "UPGRADE", "DEVICE_PURCHASE"] as const;
/** Days of difference still counted as "close" (a renewal date picked by staff, a time-zone edge). */
export const CLOSE_DAYS = 7;

const tally = <K extends string>(keys: readonly K[], values: readonly string[]) => {
  const out = Object.fromEntries([...keys, "other"].map((key) => [key, 0])) as Record<K | "other", number>;

  for (const value of values) {
    const key = (keys as readonly string[]).includes(String(value).toUpperCase()) ? (String(value).toUpperCase() as K) : "other";
    out[key] += 1;
  }

  return out;
};

const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 1000) / 10 : 0);

export type AuditResult = ReturnType<typeof buildAudit>;

/** The whole audit, from rows read once. Counts, percentages and months only. */
export function buildAudit(input: { subscriptions: readonly AuditSubscription[]; receipts: readonly AuditReceipt[]; orders: readonly AuditOrder[]; events: readonly AuditEvent[] }, today: string = businessDay(new Date())) {
  const { subscriptions, receipts, orders, events } = input;
  const bySub = new Map<number, AuditReceipt[]>();

  for (const receipt of receipts) bySub.set(receipt.subscriptionId, [...(bySub.get(receipt.subscriptionId) ?? []), receipt]);

  const replay = { exact: 0, close: 0, off: 0, noReceipts: 0 };
  const perSub = { one: 0, two: 0, threeOrMore: 0 };

  for (const sub of subscriptions) {
    const list = bySub.get(sub.id) ?? [];

    if (!list.length) {
      replay.noReceipts += 1;
      continue;
    }

    if (list.length === 1) perSub.one += 1;
    else if (list.length === 2) perSub.two += 1;
    else perSub.threeOrMore += 1;

    const rebuilt = replayExpiry(sub.startDate, list);
    const gap = rebuilt ? daysBetween(rebuilt, day(sub.expiryDate)) : Infinity;

    if (gap === 0) replay.exact += 1;
    else if (gap <= CLOSE_DAYS) replay.close += 1;
    else replay.off += 1;
  }

  const subIds = new Set(subscriptions.map((sub) => sub.id));
  const receiptOrderIds = new Set(receipts.flatMap((receipt) => (receipt.orderId ? [receipt.orderId] : [])));
  const completed = orders.filter((order) => order.status === "COMPLETED");
  const termOrders = completed.filter((order) => String(order.requestType).toUpperCase() !== "DEVICE_PURCHASE");
  const edited = events.filter((event) => event.action === "SUBSCRIPTION_UPDATED");

  // Customers who bought the same service again as a new subscription instead of renewing.
  const perCustomerService = new Map<string, number>();
  for (const sub of subscriptions) {
    const key = `${sub.userId}:${String(sub.serviceType).toUpperCase()}`;
    perCustomerService.set(key, (perCustomerService.get(key) ?? 0) + 1);
  }

  const withReceipts = subscriptions.length - replay.noReceipts;
  const months = (values: string[]) => {
    const sorted = values.filter(Boolean).sort();

    return sorted.length ? { first: sorted[0], last: sorted[sorted.length - 1] } : null;
  };

  return {
    today,
    subscriptions: {
      total: subscriptions.length,
      byService: tally(SERVICES, subscriptions.map((sub) => sub.serviceType)),
      expiredNow: subscriptions.filter((sub) => day(sub.expiryDate) < today).length,
      createdMonths: months(subscriptions.map((sub) => month(sub.createdAt))),
      customersWithSeveralOfOneService: [...perCustomerService.values()].filter((count) => count > 1).length,
    },
    receipts: {
      total: receipts.length,
      withOrder: receipts.filter((receipt) => receipt.orderId).length,
      withoutOrder: receipts.filter((receipt) => !receipt.orderId).length,
      forUnknownSubscription: receipts.filter((receipt) => !subIds.has(receipt.subscriptionId)).length,
      months: months(receipts.map((receipt) => month(receipt.createdAt))),
    },
    history: {
      withReceipts,
      withoutReceipts: replay.noReceipts,
      receiptsPerSubscription: perSub,
      replay: { ...replay, exactOrClosePct: pct(replay.exact + replay.close, withReceipts) },
      coveragePct: pct(replay.exact + replay.close, subscriptions.length),
    },
    orders: {
      completedByType: tally(ORDER_TYPES, completed.map((order) => order.requestType)),
      completedWithoutSubscription: termOrders.filter((order) => !order.subscriptionId).length,
      completedWithoutReceipt: termOrders.filter((order) => !receiptOrderIds.has(order.id)).length,
      supplierCompleted: completed.filter((order) => String(order.channel).toUpperCase() === "SUPPLIER").length,
      rewardCompleted: completed.filter((order) => order.loyaltyReward).length,
    },
    manualEdits: { events: edited.length, subscriptions: new Set(edited.map((event) => event.entityId)).size },
    verdict: auditVerdict(pct(replay.exact + replay.close, subscriptions.length)),
  };
}

/**
 * What step 2 can do with this data. FULL: rebuild the history from receipts
 * for (almost) every subscription. PARTIAL: rebuild where the replay matches,
 * mark the rest «تاريخ غير مكتمل». FORWARD_ONLY: record terms from now on and
 * leave the past out of renewal rates.
 */
export function auditVerdict(coveragePct: number) {
  if (coveragePct >= 90) return "FULL" as const;
  if (coveragePct >= 50) return "PARTIAL" as const;

  return "FORWARD_ONLY" as const;
}
