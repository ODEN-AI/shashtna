/**
 * Customer-facing subscription state, derived from the stored status and the
 * expiry date. Nothing here is stored; it is recomputed on every read.
 */

export const EXPIRING_WINDOW_DAYS = 7;

export type SubscriptionState =
  | "ACTIVE"
  | "EXPIRING"
  | "EXPIRED"
  | "SUSPENDED";

export type AccountState =
  | "ACTIVE"
  | "EXPIRING"
  | "EXPIRED"
  | "PENDING"
  | "NONE";

const DAY_MS = 24 * 60 * 60 * 1000;

/** End of the expiry day, so a subscription expiring "today" still counts. */
export function expiryInstant(expiryDate: string) {
  const day = String(expiryDate ?? "").slice(0, 10);
  const time = new Date(`${day}T23:59:59`).getTime();

  return Number.isFinite(time) ? time : Number.NaN;
}

export function daysRemaining(expiryDate: string, now = Date.now()) {
  const expiry = expiryInstant(expiryDate);

  if (!Number.isFinite(expiry)) {
    return 0;
  }

  return Math.max(0, Math.ceil((expiry - now) / DAY_MS));
}

export function deriveSubscriptionState(
  subscription: { status: string; expiryDate: string },
  now = Date.now(),
): SubscriptionState {
  const status = String(subscription.status ?? "")
    .trim()
    .toUpperCase();
  const expiry = expiryInstant(subscription.expiryDate);

  if (status === "SUSPENDED" || status === "CANCELLED") {
    return "SUSPENDED";
  }

  if (status === "EXPIRED" || !Number.isFinite(expiry) || expiry < now) {
    return "EXPIRED";
  }

  if (expiry - now <= EXPIRING_WINDOW_DAYS * DAY_MS) {
    return "EXPIRING";
  }

  return "ACTIVE";
}

/** Share of the subscription period still remaining, 0..1. */
export function remainingFraction(
  subscription: { startDate: string; expiryDate: string },
  now = Date.now(),
) {
  const start = new Date(String(subscription.startDate).slice(0, 10)).getTime();
  const end = expiryInstant(subscription.expiryDate);

  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return 0;
  }

  return Math.min(1, Math.max(0, (end - now) / (end - start)));
}

const STATE_RANK: Record<SubscriptionState, number> = {
  ACTIVE: 0,
  EXPIRING: 1,
  EXPIRED: 2,
  SUSPENDED: 3,
};

/**
 * The subscription to feature for a customer: the healthiest one, and among
 * equals the one that expires last.
 */
export function pickPrimarySubscription<
  T extends { status: string; expiryDate: string },
>(subscriptions: T[], now = Date.now()) {
  return [...subscriptions].sort((a, b) => {
    const rank =
      STATE_RANK[deriveSubscriptionState(a, now)] -
      STATE_RANK[deriveSubscriptionState(b, now)];

    if (rank !== 0) {
      return rank;
    }

    return expiryInstant(b.expiryDate) - expiryInstant(a.expiryDate);
  })[0];
}

/**
 * The overall account state that drives the dashboard hero.
 * An open order only takes over when there is no active subscription.
 */
export function deriveAccountState(
  primary: { status: string; expiryDate: string } | undefined,
  hasOpenOrder: boolean,
  now = Date.now(),
): AccountState {
  const state = primary ? deriveSubscriptionState(primary, now) : null;

  if (state === "ACTIVE" || state === "EXPIRING") {
    return state;
  }

  if (hasOpenOrder) {
    return "PENDING";
  }

  if (state === "EXPIRED" || state === "SUSPENDED") {
    return "EXPIRED";
  }

  return "NONE";
}

export const SUBSCRIPTION_STATE_LABELS: Record<
  SubscriptionState,
  { ar: string; en: string }
> = {
  ACTIVE: { ar: "نشط", en: "Active" },
  EXPIRING: { ar: "ينتهي قريبًا", en: "Expiring soon" },
  EXPIRED: { ar: "منتهي", en: "Expired" },
  SUSPENDED: { ar: "موقوف", en: "Suspended" },
};
