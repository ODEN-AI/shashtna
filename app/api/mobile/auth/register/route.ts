import { logActivity } from "@/src/server/activity";
import { registerCustomer } from "@/src/server/customer-auth";
import { fail, ok, readJson, serializeMobileUser, withPublic } from "@/src/server/mobile/http";

export const dynamic = "force-dynamic";

/** Creates a normal Shashtna customer account (the same account works on the website and in Admin). */
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

  const result = await registerCustomer({ name, phone, password });

  if (!result.ok) {
    return fail(409, "PHONE_TAKEN", "رقم الهاتف مستخدم مسبقًا. سجّل دخولك بدلًا من ذلك.");
  }

  await logActivity({
    actor: { id: result.user.id, role: "CUSTOMER" },
    userId: result.user.id,
    entityType: "USER",
    entityId: result.user.id,
    action: "ACCOUNT_CREATED",
    summary: "تم إنشاء الحساب من تطبيق الهاتف",
  });

  return ok({ token: result.session.token, expiresAt: result.session.expiresAt, user: serializeMobileUser(result.user) }, { status: 201 });
});
