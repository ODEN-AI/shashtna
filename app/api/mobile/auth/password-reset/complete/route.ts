import { fail, ok, readJson, withPublic } from "@/src/server/mobile-api";
import { completePasswordReset } from "@/src/server/password-reset";

export const dynamic = "force-dynamic";

/** Step 2: the customer enters the code from staff and a new password. */
export const POST = withPublic(async ({ request }) => {
  const body = await readJson(request);
  const phone = String(body.phone ?? "").trim();
  const code = String(body.code ?? "").trim();
  const password = String(body.password ?? "");

  if (!phone || !/^\d{6}$/.test(code)) {
    return fail(400, "VALIDATION", "اكتب رقم الهاتف والرمز المكوّن من 6 أرقام.");
  }

  const result = await completePasswordReset(phone, code, password);

  return result.ok ? ok({ message: "تم تغيير كلمة المرور. سجّل دخولك بالكلمة الجديدة." }) : fail(400, "INVALID_CODE", result.error);
});
