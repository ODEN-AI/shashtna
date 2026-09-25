"use server";

import { completePasswordReset, requestPasswordReset } from "@/src/server/password-reset";

export type FormState = { ok: boolean; message: string } | null;

export async function requestResetAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const phone = String(formData.get("phone") ?? "").trim();

  if (phone.replace(/\D/g, "").length < 7) {
    return { ok: false, message: "اكتب رقم هاتف صحيح." };
  }

  try {
    await requestPasswordReset(phone);
  } catch (error) {
    console.error("PASSWORD_RESET_REQUEST_ERROR:", error);
    return { ok: false, message: "تعذر إرسال الطلب حاليًا، حاول مرة ثانية." };
  }

  // Same answer whether or not the number has an account.
  return { ok: true, message: "" };
}

export async function completeResetAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const phone = String(formData.get("phone") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");

  if (!phone || !/^\d{6}$/.test(code)) {
    return { ok: false, message: "اكتب رقم الهاتف والرمز المكوّن من 6 أرقام." };
  }

  if (password !== confirm) {
    return { ok: false, message: "كلمتا المرور غير متطابقتين." };
  }

  try {
    const result = await completePasswordReset(phone, code, password);

    return result.ok ? { ok: true, message: "" } : { ok: false, message: result.error };
  } catch (error) {
    console.error("PASSWORD_RESET_COMPLETE_ERROR:", error);
    return { ok: false, message: "تعذر إكمال العملية حاليًا، حاول مرة ثانية." };
  }
}
