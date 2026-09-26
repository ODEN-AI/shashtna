import { fail, ok, readJson, withPublic } from "@/src/server/mobile-api";
import { requestPasswordReset } from "@/src/server/password-reset";

export const dynamic = "force-dynamic";

/**
 * Step 1 of the staff-assisted reset (same flow as the website): the
 * customer asks for a reset; staff verify them and issue a 6-digit code.
 * The answer is the same whether or not the phone has an account.
 */
export const POST = withPublic(async ({ request }) => {
  const body = await readJson(request);
  const phone = String(body.phone ?? "").trim();

  if (phone.replace(/\D/g, "").length < 7) {
    return fail(400, "VALIDATION", "اكتب رقم هاتف صحيح.");
  }

  await requestPasswordReset(phone);

  return ok({ message: "استلمنا طلبك. تواصل ويا الدعم حتى نتأكد من هويتك ونعطيك رمز من 6 أرقام." });
});
