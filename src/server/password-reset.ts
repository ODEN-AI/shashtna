import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";

import { db } from "@/src/prisma/db";
import { toDate } from "@/src/lib/i18n";
import { logActivity } from "@/src/server/activity";
import { revokeSessions } from "@/src/server/sessions";

/**
 * Staff-assisted password reset.
 *
 * There is no SMS or email provider, so a customer cannot receive a reset
 * link automatically. Instead:
 *  1. the customer requests a reset with their phone number;
 *  2. staff verify the customer (by phone / chat) and issue a 6-digit code
 *     from the admin console — the code is shown to staff once and only its
 *     HMAC is stored;
 *  3. the customer enters the code and a new password within 30 minutes
 *     (max 5 attempts).
 */

const CODE_TTL_MS = 30 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function hashCode(resetId: number, code: string) {
  const secret = String(process.env.AUTH_SECRET ?? "");

  return createHmac("sha256", secret).update(`${resetId}:${code}`).digest("hex");
}

export async function requestPasswordReset(phone: string) {
  const user = await db.orm.public.User.first({ phone: phone.trim() });

  // Same response whether or not the account exists.
  if (!user) {
    return;
  }

  const open = await db.orm.public.PasswordReset.where({ userId: user.id })
    .where((reset) => reset.status.in(["REQUESTED", "ISSUED"]))
    .first();

  if (open) {
    return;
  }

  const reset = await db.orm.public.PasswordReset.create({ userId: user.id });

  await logActivity({
    userId: user.id,
    entityType: "PASSWORD_RESET",
    entityId: reset.id,
    action: "PASSWORD_RESET_REQUESTED",
    summary: "طلب العميل إعادة تعيين كلمة المرور",
  });
}

export async function issueResetCode(actor: { id: number; role: string }, resetId: number) {
  const reset = await db.orm.public.PasswordReset.first({ id: resetId });

  if (!reset || (reset.status !== "REQUESTED" && reset.status !== "ISSUED")) {
    return { ok: false as const, error: "طلب إعادة التعيين غير متاح." };
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const now = Date.now();

  await db.orm.public.PasswordReset.where({ id: resetId }).update({
    status: "ISSUED",
    codeHash: hashCode(resetId, code),
    attempts: 0,
    expiresAt: new Date(now + CODE_TTL_MS).toISOString(),
    issuedBy: actor.id,
    issuedAt: new Date(now).toISOString(),
  });

  await logActivity({
    actor,
    userId: reset.userId,
    entityType: "PASSWORD_RESET",
    entityId: resetId,
    action: "PASSWORD_RESET_CODE_ISSUED",
    summary: "أصدر الموظف رمز إعادة تعيين كلمة المرور",
  });

  return { ok: true as const, code };
}

export async function dismissReset(actor: { id: number; role: string }, resetId: number) {
  await db.orm.public.PasswordReset.where({ id: resetId }).update({ status: "DISMISSED" });

  await logActivity({
    actor,
    entityType: "PASSWORD_RESET",
    entityId: resetId,
    action: "PASSWORD_RESET_DISMISSED",
    summary: "تم إغلاق طلب إعادة تعيين كلمة المرور",
  });
}

export async function completePasswordReset(
  phone: string,
  code: string,
  newPassword: string,
) {
  const generic = { ok: false as const, error: "الرمز غير صحيح أو منتهي الصلاحية." };

  if (newPassword.length < 6) {
    return { ok: false as const, error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل." };
  }

  const user = await db.orm.public.User.first({ phone: phone.trim() });

  if (!user) {
    return generic;
  }

  const reset = await db.orm.public.PasswordReset.where({ userId: user.id, status: "ISSUED" })
    .orderBy((item) => item.id.desc())
    .first();

  const expires = toDate(reset?.expiresAt)?.getTime() ?? 0;

  if (!reset || !reset.codeHash || expires < Date.now() || reset.attempts >= MAX_ATTEMPTS) {
    return generic;
  }

  const expected = Buffer.from(reset.codeHash, "hex");
  const provided = Buffer.from(hashCode(reset.id, code.trim()), "hex");

  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
    await db.orm.public.PasswordReset.where({ id: reset.id }).update({
      attempts: reset.attempts + 1,
    });

    return generic;
  }

  // A reset ends every existing session (and clears any login lock).
  await db.orm.public.User.where({ id: user.id }).update({
    passwordHash: await bcrypt.hash(newPassword, 12),
    failedLogins: 0,
    lockedUntil: null,
  });
  await revokeSessions(user.id);

  await db.orm.public.PasswordReset.where({ id: reset.id }).update({
    status: "USED",
    usedAt: new Date().toISOString(),
  });

  await logActivity({
    userId: user.id,
    entityType: "PASSWORD_RESET",
    entityId: reset.id,
    action: "PASSWORD_RESET_COMPLETED",
    summary: "تمت إعادة تعيين كلمة المرور",
    customerVisible: true,
  });

  return { ok: true as const };
}
