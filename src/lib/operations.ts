import { addDays, startOfDay } from "@/src/lib/business-time";
import type { Permission } from "@/src/lib/roles";

/**
 * Operations Center — pure parts (unit-tested): the queues, their
 * permissions, and the URL filters. Business rules (order transitions,
 * subscription states, ticket/lead statuses) stay in their existing
 * modules; nothing here re-implements them.
 */

export const OPERATIONS_QUEUES = ["overview", "payments", "orders", "activations", "renewals", "support", "leads"] as const;
export type OperationsQueue = (typeof OPERATIONS_QUEUES)[number];

/** The permission that guards each queue (the same one its existing page and actions use). */
export const QUEUE_PERMISSION: Record<Exclude<OperationsQueue, "overview">, Permission> = {
  payments: "orders",
  orders: "orders",
  activations: "orders",
  renewals: "subscriptions",
  support: "support",
  leads: "orders",
};

export const SINCE_FILTERS = ["all", "today", "7d", "30d"] as const;
export type SinceFilter = (typeof SINCE_FILTERS)[number];

export type OperationsQuery = { queue: OperationsQueue; q: string; since: SinceFilter };

export function parseOperationsQuery(params: { queue?: string; q?: string; since?: string }): OperationsQuery {
  const queue = OPERATIONS_QUEUES.find((value) => value === params.queue) ?? "overview";
  const since = SINCE_FILTERS.find((value) => value === params.since) ?? "all";
  const q = String(params.q ?? "").trim().slice(0, 80);

  return { queue, q, since };
}

/** Start of the "since" window (Baghdad business days), or null for no limit. */
export function sinceStart(since: SinceFilter, now = new Date()): Date | null {
  if (since === "today") return startOfDay(now);
  if (since === "7d") return addDays(startOfDay(now), -6);
  if (since === "30d") return addDays(startOfDay(now), -29);

  return null;
}

export function withinSince(at: string | null | undefined, start: Date | null) {
  if (!start) return true;
  const time = at ? new Date(String(at).replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00")).getTime() : Number.NaN;

  return Number.isFinite(time) && time >= start.getTime();
}

/** Case-insensitive match of the search text against any of the given fields. */
export function matchesSearch(q: string, fields: (string | number | null | undefined)[]) {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;

  return fields.some((field) => field !== null && field !== undefined && String(field).toLowerCase().includes(needle));
}

/** Deterministic queue order: the item waiting longest comes first; ties by id. */
export function oldestFirst<T extends { since: string; id: number | string }>(items: T[]) {
  const time = (value: string) => new Date(String(value).replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00")).getTime() || 0;

  return [...items].sort((a, b) => time(a.since) - time(b.since) || String(a.id).localeCompare(String(b.id), undefined, { numeric: true }));
}
