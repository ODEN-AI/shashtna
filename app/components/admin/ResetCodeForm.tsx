"use client";

import { useActionState } from "react";
import { KeyRound } from "lucide-react";

import { issueResetCodeAction, type AdminState } from "@/app/admin/actions";
import { useLanguage } from "@/app/components/LanguageProvider";
import { Notice } from "@/app/ui/States";
import { SubmitButton } from "@/app/ui/SubmitButton";

/** Issues a one-time code and shows it once; only its hash is stored. */
export function ResetCodeForm({ resetId, reissue }: { resetId: number; reissue: boolean }) {
  const { t } = useLanguage();
  const [state, action] = useActionState<AdminState, FormData>(issueResetCodeAction, null);

  if (state?.ok && state.code) {
    return (
      <div className="rounded-2xl border border-success/30 bg-success/10 p-4">
        <p className="text-xs text-ink-2">{t("الرمز (يظهر مرة وحدة فقط، صالح 30 دقيقة):", "Code (shown once, valid for 30 minutes):")}</p>
        <p className="nums mt-2 text-3xl font-bold tracking-[0.4em] text-ink" dir="ltr">{state.code}</p>
        <p className="mt-2 text-xs text-ink-3">{t("العميل يدخله بصفحة /reset-password.", "The customer enters it at /reset-password.")}</p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="resetId" value={resetId} />
      {state && !state.ok ? <Notice tone="danger">{state.message}</Notice> : null}
      <SubmitButton size="sm" pendingLabel={t("جاري الإصدار...", "Issuing...")}>
        <KeyRound size={15} aria-hidden />
        {reissue ? t("إصدار رمز جديد", "Issue a new code") : t("تم التحقق — أصدر رمز", "Verified — issue code")}
      </SubmitButton>
    </form>
  );
}
