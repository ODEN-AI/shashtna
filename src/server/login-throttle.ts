import { THROTTLE_POLICIES, lockDurationMs, retryAfterSeconds, throttleDimensions, type ThrottleScope } from "@/src/lib/login-throttle";
import { keyedDigest } from "@/src/lib/mobile-auth";
import { db } from "@/src/prisma/db";

/**
 * Login throttle store (PostgreSQL, shared by every Netlify function
 * instance). Rules live in src/lib/login-throttle. Counters are keyed by an
 * HMAC of the dimension, never by a raw phone number or address.
 *
 * Failures are counted with one atomic INSERT … ON CONFLICT statement, so
 * parallel attempts across instances can't undercount. If the store itself
 * is unavailable the sign-in proceeds (fail open) and the error is logged:
 * the password check is still the gate, and an outage here must not lock
 * every staff member out of the console.
 */

const SCOPES: ThrottleScope[] = ["PAIR", "ACCOUNT", "SOURCE"];
const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

export type ThrottleKeys = Record<ThrottleScope, string>;

export function throttleKeys(phone: string, source: string, purpose = "login"): ThrottleKeys {
  const dimensions = throttleDimensions(phone, source, purpose);

  return { PAIR: keyedDigest(dimensions.PAIR), ACCOUNT: keyedDigest(dimensions.ACCOUNT), SOURCE: keyedDigest(dimensions.SOURCE) };
}

/** Seconds until the attempt may be retried, or null when not locked. */
export async function throttleRetryAfter(keys: ThrottleKeys, now = Date.now()) {
  try {
    const rows = await db.orm.public.LoginThrottle.where((row) => row.key.in(Object.values(keys)))
      .select("lockedUntil")
      .all();
    const until = Math.max(0, ...rows.map((row) => (row.lockedUntil ? Date.parse(String(row.lockedUntil)) : 0)).filter((value) => Number.isFinite(value)));

    return until > now ? retryAfterSeconds(until, now) : null;
  } catch (error) {
    console.error("LOGIN_THROTTLE_READ_ERROR:", error instanceof Error ? error.message : error);
    return null;
  }
}

/** Count one failed attempt on every dimension; lock the ones over their limit. */
export async function recordThrottleFailure(keys: ThrottleKeys, now = Date.now()) {
  try {
    for (const scope of SCOPES) {
      const policy = THROTTLE_POLICIES[scope];
      const windowSeconds = Math.round(policy.windowMs / 1000);
      const plan = db.raw.sql`
        INSERT INTO "public"."loginThrottle" ("key", "failures", "windowStartedAt", "lockedUntil", "updatedAt")
        VALUES (${keys[scope]}, 1, now(), NULL, now())
        ON CONFLICT ("key") DO UPDATE SET
          "failures" = CASE WHEN "loginThrottle"."windowStartedAt" < now() - make_interval(secs => ${windowSeconds}) THEN 1 ELSE "loginThrottle"."failures" + 1 END,
          "windowStartedAt" = CASE WHEN "loginThrottle"."windowStartedAt" < now() - make_interval(secs => ${windowSeconds}) THEN now() ELSE "loginThrottle"."windowStartedAt" END,
          "updatedAt" = now()
        RETURNING "failures"`
        .returnsRow({ failures: "pg/int4@1" })
        .build();
      const rows = await db.runtime().query(plan).toArray();
      const failures = Number(rows[0]?.failures ?? 0);
      const lock = lockDurationMs(failures, policy);

      if (lock > 0) {
        await db.orm.public.LoginThrottle.where({ key: keys[scope] }).update({ lockedUntil: new Date(now + lock).toISOString() });
      }
    }
  } catch (error) {
    console.error("LOGIN_THROTTLE_WRITE_ERROR:", error instanceof Error ? error.message : error);
  }
}

/** A successful sign-in clears the account counters (the source counter stays) and prunes stale rows. */
export async function clearThrottle(keys: ThrottleKeys, now = Date.now()) {
  try {
    await db.orm.public.LoginThrottle.where((row) => row.key.in([keys.PAIR, keys.ACCOUNT])).deleteAndCount();
    await db.orm.public.LoginThrottle.where((row) => row.updatedAt.lt(new Date(now - STALE_AFTER_MS).toISOString())).deleteAndCount();
  } catch (error) {
    console.error("LOGIN_THROTTLE_CLEAR_ERROR:", error instanceof Error ? error.message : error);
  }
}
