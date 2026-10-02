import { ok, withMobileUser } from "@/src/server/mobile/http";

export const dynamic = "force-dynamic";

/**
 * Push-token registration. The current database has no push-device table
 * (push notifications are not part of the current platform), so the token
 * is not stored and `deviceId` is null — the app treats that as "push not
 * available" and keeps working; in-app notifications are unaffected. The
 * token is never logged.
 */
export const POST = withMobileUser(async () => ok({ deviceId: null, push: "UNAVAILABLE" }));

/** Logout cleanup: nothing is stored, so nothing to remove. */
export const DELETE = withMobileUser(async () => ok());
