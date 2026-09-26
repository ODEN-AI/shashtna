import bcrypt from "bcryptjs";

import { toDate } from "@/src/lib/i18n";
import { db } from "@/src/prisma/db";

/**
 * Password sign-in with brute-force protection, shared by the website
 * (/api/auth/login) and the mobile app (/api/mobile/auth/login).
 *
 * After MAX_FAILURES wrong passwords the phone number is locked for
 * LOCK_MINUTES. Unknown phone numbers go through the same steps (a dummy
 * bcrypt compare and an in-memory counter) so responses and timing don't
 * reveal which numbers have accounts.
 */

export const MAX_FAILURES = 5;
export const LOCK_MINUTES = 15;

// bcrypt hash of a random string nobody knows.
const DUMMY_HASH = "$2b$12$L9CsgEaPIX8FSN0AXluAmejKyB0JAiKHeAmGB8eNxo5lGUfpkKV7m";

const unknownPhones = new Map<string, { failures: number; lockedUntil: number }>();

type User = NonNullable<Awaited<ReturnType<typeof db.orm.public.User.first>>>;

export type LoginResult =
  | { ok: true; user: User }
  | { ok: false; status: 400 | 401 | 429; code: "VALIDATION" | "INVALID_CREDENTIALS" | "LOCKED"; message: string };

function lockedMessage(until: number) {
  const minutes = Math.max(1, Math.ceil((until - Date.now()) / 60_000));
  return `محاولات دخول كثيرة. حاول مرة ثانية بعد ${minutes} ${minutes <= 10 && minutes > 2 ? "دقائق" : "دقيقة"}، أو استخدم «نسيت كلمة المرور».`;
}

const INVALID = { ok: false as const, status: 401 as const, code: "INVALID_CREDENTIALS" as const, message: "رقم الهاتف أو كلمة المرور غير صحيحة." };

export async function attemptLogin(phoneInput: unknown, passwordInput: unknown, now = Date.now()): Promise<LoginResult> {
  const phone = String(phoneInput ?? "").trim();
  const password = String(passwordInput ?? "");

  if (!phone || !password) {
    return { ok: false, status: 400, code: "VALIDATION", message: "يرجى إدخال رقم الهاتف وكلمة المرور." };
  }

  const user = await db.orm.public.User.first({ phone });

  if (!user) {
    const entry = unknownPhones.get(phone) ?? { failures: 0, lockedUntil: 0 };

    if (entry.lockedUntil > now) {
      return { ok: false, status: 429, code: "LOCKED", message: lockedMessage(entry.lockedUntil) };
    }

    await bcrypt.compare(password, DUMMY_HASH);
    entry.failures += 1;

    if (entry.failures >= MAX_FAILURES) {
      entry.failures = 0;
      entry.lockedUntil = now + LOCK_MINUTES * 60_000;
    }

    unknownPhones.set(phone, entry);

    if (unknownPhones.size > 10_000) {
      unknownPhones.delete(unknownPhones.keys().next().value!);
    }

    return INVALID;
  }

  const lockedUntil = toDate(user.lockedUntil)?.getTime() ?? 0;

  if (lockedUntil > now) {
    return { ok: false, status: 429, code: "LOCKED", message: lockedMessage(lockedUntil) };
  }

  if (!(await bcrypt.compare(password, user.passwordHash))) {
    const failures = user.failedLogins + 1;
    const lock = failures >= MAX_FAILURES;

    await db.orm.public.User.where({ id: user.id }).update({
      failedLogins: lock ? 0 : failures,
      lockedUntil: lock ? new Date(now + LOCK_MINUTES * 60_000).toISOString() : user.lockedUntil,
    });

    return INVALID;
  }

  if (user.failedLogins || user.lockedUntil) {
    await db.orm.public.User.where({ id: user.id }).update({ failedLogins: 0, lockedUntil: null });
  }

  return { ok: true, user };
}
