import bcrypt from "bcryptjs";

import { db } from "@/src/prisma/db";
import { logActivity } from "@/src/server/activity";
import { BCRYPT_COST } from "@/src/server/customer-auth";
import { fail, ok, readJson, withMobileUser } from "@/src/server/mobile/http";
import { reissueAfter, revokeAppSessions } from "@/src/server/mobile/sessions";

export const dynamic = "force-dynamic";

/** Change password: every other app session ends; this device gets a fresh token. */
export const POST = withMobileUser(async ({ request, user, row }) => {
  const body = await readJson(request);
  const current = String(body.currentPassword ?? "");
  const next = String(body.newPassword ?? "");

  if (next.length < 6) {
    return fail(400, "VALIDATION", "كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل.");
  }

  if (!(await bcrypt.compare(current, row.passwordHash))) {
    return fail(400, "INVALID_PASSWORD", "كلمة المرور الحالية غير صحيحة.");
  }

  await db.orm.public.User.where({ id: user.id }).update({ passwordHash: await bcrypt.hash(next, BCRYPT_COST) });
  const revokedAt = await revokeAppSessions(user, "تم تسجيل الخروج من الأجهزة الأخرى بعد تغيير كلمة المرور");
  await logActivity({
    actor: { id: user.id, role: user.role },
    userId: user.id,
    entityType: "USER",
    entityId: user.id,
    action: "PASSWORD_CHANGED",
    summary: "تم تغيير كلمة المرور",
    customerVisible: true,
  });
  const session = await reissueAfter(user, revokedAt);

  return ok({ message: "تم تغيير كلمة المرور. تم تسجيل الخروج من الأجهزة الأخرى.", token: session.token, expiresAt: session.expiresAt });
});
