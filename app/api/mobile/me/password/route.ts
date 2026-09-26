import bcrypt from "bcryptjs";

import { db } from "@/src/prisma/db";
import { logActivity } from "@/src/server/activity";
import { fail, ok, readJson, withMobileUser } from "@/src/server/mobile-api";

export const dynamic = "force-dynamic";

export const POST = withMobileUser(async ({ request, user }) => {
  const body = await readJson(request);
  const current = String(body.currentPassword ?? "");
  const next = String(body.newPassword ?? "");

  if (next.length < 6) {
    return fail(400, "VALIDATION", "كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل.");
  }

  const row = await db.orm.public.User.first({ id: user.id });

  if (!row || !(await bcrypt.compare(current, row.passwordHash))) {
    return fail(400, "INVALID_PASSWORD", "كلمة المرور الحالية غير صحيحة.");
  }

  await db.orm.public.User.where({ id: user.id }).update({ passwordHash: await bcrypt.hash(next, 12) });
  await logActivity({
    actor: { id: user.id, role: user.role },
    userId: user.id,
    entityType: "USER",
    entityId: user.id,
    action: "PASSWORD_CHANGED",
    summary: "تم تغيير كلمة المرور",
    customerVisible: true,
  });

  return ok({ message: "تم تغيير كلمة المرور." });
});
