/**
 * Login throttling rules (pure, unit-tested). Applied by /api/auth/login
 * (and the Console credential exchange) through src/server/login-throttle.
 *
 * Three counters, each in its own bounded window:
 *  - PAIR    (account + source): the normal brute-force brake. Locks only
 *            that source for that account, so an attacker elsewhere can't
 *            lock a real user out with a handful of attempts.
 *  - ACCOUNT (account, any source): distributed guessing against one
 *            account. Higher limit, so locking someone out takes many
 *            attempts and only lasts a bounded time.
 *  - SOURCE  (source, any account): one address spraying many accounts.
 *
 * Every counter applies to every phone number, existing or not, staff or
 * customer, so a lock never reveals whether an account exists or is staff.
 * Locks are progressive (each failure after the limit doubles the lock),
 * capped, and never permanent. Attempts made while locked are rejected
 * without counting, so they can't extend the lock. A successful sign-in
 * clears the PAIR and ACCOUNT counters.
 */

export type ThrottleScope = "PAIR" | "ACCOUNT" | "SOURCE";

export type ThrottlePolicy = { limit: number; windowMs: number; baseLockMs: number; maxLockMs: number };

const MINUTE = 60_000;

export const THROTTLE_POLICIES: Record<ThrottleScope, ThrottlePolicy> = {
  PAIR: { limit: 5, windowMs: 60 * MINUTE, baseLockMs: 5 * MINUTE, maxLockMs: 30 * MINUTE },
  ACCOUNT: { limit: 15, windowMs: 60 * MINUTE, baseLockMs: 15 * MINUTE, maxLockMs: 60 * MINUTE },
  SOURCE: { limit: 40, windowMs: 60 * MINUTE, baseLockMs: 15 * MINUTE, maxLockMs: 60 * MINUTE },
};

/** Lock length after a failure that brought the count to `failures` (0 = no lock). */
export function lockDurationMs(failures: number, policy: ThrottlePolicy) {
  if (!Number.isFinite(failures) || failures < policy.limit) return 0;
  const doublings = Math.min(failures - policy.limit, 10);

  return Math.min(policy.maxLockMs, policy.baseLockMs * 2 ** doublings);
}

/**
 * The account dimension: digits only, Iraqi international prefix folded
 * (+964 790… / 00964 790… / 0790… are one account), so formatting
 * variations don't get fresh counters.
 */
export function normalizeIdentifier(phone: string) {
  let digits = String(phone ?? "").replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("964")) digits = `0${digits.slice(3)}`;

  return digits.slice(0, 20);
}

/**
 * The source dimension. On Netlify, x-nf-client-connection-ip is set by the
 * platform edge (clients can't forge it); elsewhere the first
 * x-forwarded-for hop, then x-real-ip. Unknown sources share one bucket.
 */
export function clientAddress(headers: { get(name: string): string | null }) {
  const pick = (value: string | null) => (value ?? "").split(",")[0].trim().slice(0, 64);

  return pick(headers.get("x-nf-client-connection-ip")) || pick(headers.get("x-forwarded-for")) || pick(headers.get("x-real-ip")) || "unknown";
}

/** The raw dimension values for one attempt (hashed before storage). */
export function throttleDimensions(phone: string, source: string, purpose = "login") {
  const account = normalizeIdentifier(phone);

  return {
    PAIR: `${purpose}:pair:${account}|${source}`,
    ACCOUNT: `${purpose}:account:${account}`,
    SOURCE: `${purpose}:source:${source}`,
  } satisfies Record<ThrottleScope, string>;
}

/** Whole minutes to show / send in Retry-After (at least 1). */
export function retryAfterSeconds(lockedUntilMs: number, nowMs: number) {
  return Math.max(60, Math.ceil((lockedUntilMs - nowMs) / 60_000) * 60);
}
