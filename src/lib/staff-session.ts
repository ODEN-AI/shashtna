/**
 * Staff session rules (pure, unit-tested). Applied on top of the existing
 * signed-token check, only for staff roles:
 *  - a staff session lasts at most STAFF_SESSION_MAX_AGE_SECONDS from when
 *    it was issued (customers keep the normal token lifetime);
 *  - a staff token issued at or before the user's last "sign out of all
 *    devices" is no longer accepted.
 * Token `iat` has one-second resolution, so a token issued in the same
 * second as a revocation counts as revoked (fail closed).
 */
export const STAFF_SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

export type StaffSessionState = "ok" | "expired" | "revoked";

export function checkStaffSession(issuedAt: number, nowMs: number, revokedAtMs: number | null): StaffSessionState {
  if (!Number.isFinite(issuedAt)) return "expired";
  if (Math.floor(nowMs / 1000) - issuedAt > STAFF_SESSION_MAX_AGE_SECONDS) return "expired";
  if (revokedAtMs !== null && Number.isFinite(revokedAtMs) && issuedAt <= Math.floor(revokedAtMs / 1000)) return "revoked";

  return "ok";
}

/** When a staff session ends (ms): the earlier of the token expiry and the staff maximum. */
export function staffSessionEndsAt(issuedAt: number, expiresAt: number) {
  return Math.min(expiresAt, issuedAt + STAFF_SESSION_MAX_AGE_SECONDS) * 1000;
}
