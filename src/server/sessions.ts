import { createAuthToken, type MobileAuthPayload } from "@/src/lib/mobile-auth";
import { db } from "@/src/prisma/db";

/**
 * Signed session tokens are stateless, so revocation works through a
 * per-account version: every token carries the User.tokenVersion it was
 * issued with, and any request that loads the account rejects a token whose
 * version is older. Bumping the version (password change or reset, "sign
 * out on all devices") ends every existing website and app session at once.
 */

export function issueSession(user: { id: number; role: string; tokenVersion: number }) {
  return createAuthToken(user.id, user.role, user.tokenVersion);
}

/** Tokens issued before versions existed carry no `ver` and count as 0. */
export function sessionIsCurrent(payload: Pick<MobileAuthPayload, "ver">, user: { tokenVersion: number }) {
  return (payload.ver ?? 0) === user.tokenVersion;
}

/**
 * Ends every session of the account and stops pushes to all of its phones
 * (a phone that is still in use re-registers after signing in again).
 * Returns the updated user.
 */
export async function revokeSessions(userId: number) {
  const user = await db.orm.public.User.first({ id: userId });

  if (!user) {
    return null;
  }

  const updated = await db.orm.public.User.where({ id: userId }).update({ tokenVersion: user.tokenVersion + 1 });
  await db.orm.public.PushDevice.where({ userId, isActive: true }).updateAll({ isActive: false, lastError: "SESSION_REVOKED" });

  return updated;
}
