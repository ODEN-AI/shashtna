import bcrypt from "bcryptjs";

import { issueSession } from "@/src/server/sessions";
import { db } from "@/src/prisma/db";
import { logActivity } from "@/src/server/activity";
import { fail, ok, readJson, serializeMobileUser, withPublic } from "@/src/server/mobile-api";

export const dynamic = "force-dynamic";

/** Creates a Shashtna account (the same account works on the website). */
export const POST = withPublic(async ({ request }) => {
  const body = await readJson(request);
  const name = String(body.name ?? "").trim().slice(0, 120);
  const phone = String(body.phone ?? "").trim().slice(0, 40);
  const password = String(body.password ?? "");

  if (name.length < 2 || !phone || !password) {
    return fail(400, "VALIDATION", "يرجى ملء جميع الحقول المطلوبة.");
  }

  if (phone.replace(/\D/g, "").length < 7) {
    return fail(400, "VALIDATION", "اكتب رقم هاتف صحيح.");
  }

  if (body.terms !== true) {
    return fail(400, "VALIDATION", "يجب الموافقة على الشروط والأحكام.");
  }

  if (password.length < 6) {
    return fail(400, "VALIDATION", "كلمة المرور يجب أن تكون 6 أحرف على الأقل.");
  }

  if (await db.orm.public.User.first({ phone })) {
    return fail(409, "PHONE_TAKEN", "رقم الهاتف مستخدم مسبقًا. سجّل دخولك بدلًا من ذلك.");
  }

  const user = await db.orm.public.User.create({
    name,
    phone,
    passwordHash: await bcrypt.hash(password, 12),
    role: "CUSTOMER",
  });

  await logActivity({
    actor: { id: user.id, role: "CUSTOMER" },
    userId: user.id,
    entityType: "USER",
    entityId: user.id,
    action: "ACCOUNT_CREATED",
    summary: "تم إنشاء الحساب من تطبيق الهاتف",
  });

  const session = issueSession(user);

  return ok({ token: session.token, expiresAt: session.expiresAt, user: serializeMobileUser(user) }, { status: 201 });
});
