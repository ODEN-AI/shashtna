import bcrypt from "bcryptjs";

import { clientAddress } from "@/src/lib/login-throttle";
import { createAuthToken } from "@/src/lib/mobile-auth";
import { db } from "@/src/prisma/db";
import { clearThrottle, recordThrottleFailure, throttleKeys, throttleRetryAfter } from "@/src/server/login-throttle";

/**
 * Password sign-in and account creation, shared by the website
 * (/api/auth/login, /api/auth/register) and the mobile app
 * (/api/mobile/auth/*): one User table, one password hash, one login
 * throttle and one signed session token for both.
 */

type UserRow = NonNullable<Awaited<ReturnType<typeof db.orm.public.User.first>>>;

// Compared against when the phone has no account, so both failure paths
// take the same bcrypt time (no account enumeration by timing).
const DUMMY_HASH = "$2b$12$IXWGyOmoxnvVpnx2NUmuCeX4.V3WTemMkeN1WyHuVLnLMyu6AwXBm";

export const BCRYPT_COST = 12;

export type SignInResult =
  | { ok: true; user: UserRow; session: { token: string; expiresAt: number } }
  | { ok: false; reason: "MISSING" | "INVALID" }
  | { ok: false; reason: "RATE_LIMITED"; retryAfter: number };

export async function passwordSignIn(phoneInput: unknown, passwordInput: unknown, headers: Headers): Promise<SignInResult> {
  const phone = String(phoneInput ?? "").trim();
  const password = String(passwordInput ?? "");

  if (!phone || !password) {
    return { ok: false, reason: "MISSING" };
  }

  // Throttle before checking anything, for every phone number alike
  // (existing or not, staff or customer), so a lock reveals nothing.
  const keys = throttleKeys(phone, clientAddress(headers));
  const retryAfter = await throttleRetryAfter(keys);

  if (retryAfter) {
    return { ok: false, reason: "RATE_LIMITED", retryAfter };
  }

  const user = await db.orm.public.User.first({ phone });
  const passwordValid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);

  if (!user || !passwordValid) {
    await recordThrottleFailure(keys);
    return { ok: false, reason: "INVALID" };
  }

  await clearThrottle(keys);

  return { ok: true, user, session: createAuthToken(user.id, user.role) };
}

export type RegisterResult = { ok: true; user: UserRow; session: { token: string; expiresAt: number } } | { ok: false; reason: "PHONE_TAKEN" };

/** Creates a normal customer account (validated input). The same account works on the website and in the app. */
export async function registerCustomer(input: { name: string; phone: string; password: string }): Promise<RegisterResult> {
  if (await db.orm.public.User.first({ phone: input.phone })) {
    return { ok: false, reason: "PHONE_TAKEN" };
  }

  let user: UserRow;

  try {
    user = await db.orm.public.User.create({
      name: input.name,
      phone: input.phone,
      passwordHash: await bcrypt.hash(input.password, BCRYPT_COST),
      role: "CUSTOMER",
    });
  } catch (error) {
    // Two sign-ups racing for the same phone: the unique index decides.
    if (await db.orm.public.User.first({ phone: input.phone })) {
      return { ok: false, reason: "PHONE_TAKEN" };
    }
    throw error;
  }

  return { ok: true, user, session: createAuthToken(user.id, user.role) };
}
