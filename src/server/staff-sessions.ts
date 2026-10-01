import { cookies } from "next/headers";

import { LAST_SEEN_INTERVAL_MS } from "@/src/lib/console-api";
import { toDate } from "@/src/lib/i18n";
import { SESSION_COOKIE, verifyAuthToken } from "@/src/lib/mobile-auth";
import { isStaffRole, normalizeRole } from "@/src/lib/roles";
import { checkStaffSession, staffSessionEndsAt, type StaffSessionState } from "@/src/lib/staff-session";
import { db } from "@/src/prisma/db";
import { logActivity } from "@/src/server/activity";

/**
 * Staff session revocation and lifetime. Used by getSessionUser() (admin
 * pages and server actions) and requireAdmin() (admin APIs); customers are
 * never affected.
 */

async function revokedAtMs(userId: number) {
  const row = await db.orm.public.StaffSessionRevocation.first({ userId });

  return row ? (toDate(String(row.revokedAt))?.getTime() ?? null) : null;
}

/** "ok" for customers and for valid staff sessions. */
export async function staffSessionState(userId: number, role: unknown, issuedAt: number): Promise<StaffSessionState> {
  if (!isStaffRole(normalizeRole(role))) return "ok";

  return checkStaffSession(issuedAt, Date.now(), await revokedAtMs(userId));
}

/**
 * The session check every request runs (pages, server actions, admin
 * APIs). Browser sessions behave exactly as before. A Console device
 * session (token carries `did`) is additionally valid only while:
 *  - the account is still staff (a demoted account's device session ends);
 *  - the device exists, belongs to this user and is not revoked;
 *  - the device is still signed in (credential not cleared by logout) and
 *    the token belongs to the device's current sign-in.
 * Then the normal staff rules apply (7-day maximum, sign-out-everywhere).
 */
export async function sessionState(user: { id: number; role: unknown }, payload: { iat: number; did?: number }): Promise<StaffSessionState> {
  if (payload.did !== undefined) {
    if (!isStaffRole(normalizeRole(user.role))) return "revoked";

    const device = await db.orm.public.ConsoleDevice.where({ id: payload.did })
      .select("id", "userId", "credentialHash", "authenticatedAt", "revokedAt", "lastSeenAt")
      .first();
    const boundAt = device?.authenticatedAt ? Math.floor((toDate(String(device.authenticatedAt))?.getTime() ?? NaN) / 1000) : NaN;

    if (!device || device.userId !== user.id || device.revokedAt || !device.credentialHash || boundAt !== payload.iat) return "revoked";

    const lastSeen = device.lastSeenAt ? (toDate(String(device.lastSeenAt))?.getTime() ?? 0) : 0;
    if (Date.now() - lastSeen > LAST_SEEN_INTERVAL_MS) {
      // Throttled: at most one write per device per interval.
      await db.orm.public.ConsoleDevice.where({ id: device.id }).update({ lastSeenAt: new Date().toISOString() }).catch(() => undefined);
    }
  }

  return staffSessionState(user.id, user.role, payload.iat);
}

/** Invalidate every existing session of a staff member (all devices). */
export async function revokeStaffSessions(userId: number, actor: { id: number; role?: string | null }, reason: "SELF" | "ADMIN") {
  const now = new Date().toISOString();
  const existing = await db.orm.public.StaffSessionRevocation.first({ userId });

  if (existing) {
    await db.orm.public.StaffSessionRevocation.where({ userId }).update({ revokedAt: now, revokedBy: actor.id });
  } else {
    await db.orm.public.StaffSessionRevocation.create({ userId, revokedAt: now, revokedBy: actor.id });
  }

  await logActivity({
    actor,
    userId,
    entityType: "STAFF",
    entityId: userId,
    action: "STAFF_SESSIONS_REVOKED",
    summary: reason === "SELF" ? "Signed out of all devices" : `All sessions ended for staff #${userId}`,
  });
}

/** The current request's session (issued / ends) for the security page. */
export async function currentStaffSession(userId: number) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const payload = token ? verifyAuthToken(token) : null;
  const revokedAt = await revokedAtMs(userId);

  return {
    issuedAt: payload ? payload.iat * 1000 : null,
    endsAt: payload ? staffSessionEndsAt(payload.iat, payload.exp) : null,
    lastRevokedAt: revokedAt,
  };
}
