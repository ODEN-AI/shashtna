import { createAuthToken } from "@/src/lib/mobile-auth";
import { toDate } from "@/src/lib/i18n";
import { isStaffRole, normalizeRole } from "@/src/lib/roles";
import { db } from "@/src/prisma/db";
import { revokeStaffSessions } from "@/src/server/staff-sessions";

/**
 * "Sign out on all devices" for app sessions (logout-all, password change).
 *
 * The account table has no token version, so the revocation time is the
 * newest CUSTOMER_SESSIONS_REVOKED event in the existing activity log (an
 * append-only, per-user indexed record that the account timeline already
 * shows). A mobile token is accepted only if it was issued after that time.
 * Staff accounts additionally go through the Console's own revocation.
 */

export const SESSIONS_REVOKED_ACTION = "CUSTOMER_SESSIONS_REVOKED";

/** The latest app sign-out-everywhere (ms), or null. */
export async function sessionsRevokedAt(userId: number): Promise<number | null> {
  const row = await db.orm.public.ActivityEvent.where({ userId, action: SESSIONS_REVOKED_ACTION })
    .orderBy((event) => event.createdAt.desc())
    .select("createdAt")
    .first();

  return row ? (toDate(String(row.createdAt))?.getTime() ?? null) : null;
}

/** Token `iat` has one-second resolution: a token from the revocation's second counts as revoked (fail closed). */
export function issuedAfterRevocation(issuedAt: number, revokedAtMs: number | null) {
  return revokedAtMs === null || !Number.isFinite(revokedAtMs) || issuedAt > Math.floor(revokedAtMs / 1000);
}

/**
 * Ends every existing app session of the account (including the one that
 * asked). The write is not best-effort: if it fails the request fails, so the
 * customer is never told "signed out" when nothing was. Returns the
 * revocation time (ms).
 */
export async function revokeAppSessions(user: { id: number; role: string }, summary: string) {
  if (isStaffRole(normalizeRole(user.role))) {
    await revokeStaffSessions(user.id, { id: user.id, role: user.role }, "SELF");
  }

  const revokedAt = Date.now();

  await db.orm.public.ActivityEvent.create({
    actorUserId: user.id,
    actorRole: user.role,
    userId: user.id,
    entityType: "USER",
    entityId: String(user.id),
    action: SESSIONS_REVOKED_ACTION,
    summary,
    details: null,
    customerVisible: true,
    createdAt: new Date(revokedAt).toISOString(),
  });

  return revokedAt;
}

/** A fresh token for this device, issued in a later second than the revocation (password change). */
export async function reissueAfter(user: { id: number; role: string }, revokedAt: number) {
  const wait = (Math.floor(revokedAt / 1000) + 1) * 1000 - Date.now() + 5;
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));

  return createAuthToken(user.id, user.role);
}
