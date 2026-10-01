import { parseOrderNumber } from "@/src/lib/order-status";
import type { SubscriptionState } from "@/src/lib/subscription-state";

/**
 * Customer 360 — pure parts (unit-tested). The per-subscription state is
 * always deriveSubscriptionState's; this only summarises a customer's set
 * of states for the list, and parses the URL filters.
 */

export const CUSTOMER_FILTERS = ["all", "active", "expiring", "expired", "none", "recent", "staff"] as const;
export type CustomerFilter = (typeof CUSTOMER_FILTERS)[number];
/** Filters that need subscription data (only offered with the "subscriptions" permission). */
export const SUBSCRIPTION_FILTERS: readonly CustomerFilter[] = ["active", "expiring", "expired", "none"];

export type CustomerStatus = "ACTIVE" | "EXPIRING" | "EXPIRED" | "SUSPENDED" | "NONE";

/**
 * A customer's overall status from their subscriptions' derived states:
 * any active plan wins, then expiring, then expired, then suspended.
 */
export function customerStatus(states: SubscriptionState[]): CustomerStatus {
  if (states.includes("ACTIVE")) return "ACTIVE";
  if (states.includes("EXPIRING")) return "EXPIRING";
  if (states.includes("EXPIRED")) return "EXPIRED";
  if (states.includes("SUSPENDED")) return "SUSPENDED";

  return "NONE";
}

export function matchesCustomerFilter(filter: CustomerFilter, row: { staff: boolean; status: CustomerStatus | null; recent: boolean }) {
  switch (filter) {
    case "active":
      return row.status === "ACTIVE" || row.status === "EXPIRING";
    case "expiring":
      return row.status === "EXPIRING";
    case "expired":
      return row.status === "EXPIRED";
    case "none":
      return !row.staff && row.status === "NONE";
    case "recent":
      return !row.staff && row.recent;
    case "staff":
      return row.staff;
    default:
      return true;
  }
}

export type CustomerQuery = { q: string; filter: CustomerFilter; page: number };

export function parseCustomerQuery(params: { q?: string; view?: string; page?: string }): CustomerQuery {
  const filter = CUSTOMER_FILTERS.find((value) => value === params.view) ?? "all";
  const page = Number(params.page);

  return { q: String(params.q ?? "").trim().slice(0, 80), filter, page: Number.isInteger(page) && page > 0 ? page : 1 };
}

/**
 * What a search string can identify: free text (name/phone/email), a
 * numeric id (customer, subscription or order — each only where the role
 * may see that data) or an order number like SH-000012.
 */
export function parseCustomerSearch(q: string) {
  const text = q.trim().toLowerCase();
  const numeric = /^#?\d+$/.test(text) ? Number(text.replace("#", "")) : null;
  const orderId = /^sh[-‑]?\d+$/i.test(text) ? parseOrderNumber(text.replace("‑", "-")) : null;

  return { text, numeric, orderId };
}
