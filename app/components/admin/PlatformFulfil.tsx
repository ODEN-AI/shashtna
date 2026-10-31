"use client";

import { useActionState } from "react";

import { fulfilPlatformAction, revealCodeAction } from "@/app/admin/orders/platform-actions";
import { useLanguage } from "@/app/components/LanguageProvider";
import { ActionForm } from "@/app/ui/ActionForm";
import { Field, Input } from "@/app/ui/Field";
import { SubmitButton } from "@/app/ui/SubmitButton";
import type { DeliveryKind } from "@/src/lib/groups";

/**
 * Staff deliver a digital platform order: the code, the ready account, or a
 * confirmation that it was activated on the customer's own e-mail.
 */
export function PlatformFulfil({ orderId, delivery, customerEmail, renewal }: { orderId: number; delivery: DeliveryKind; customerEmail: string | null; renewal: boolean }) {
  const { t } = useLanguage();

  return (
    <ActionForm action={fulfilPlatformAction} className="mt-4 space-y-3">
      <input type="hidden" name="orderId" value={orderId} />
      {delivery === "CODE" ? (
        <Field label={t("الكود أو بطاقة الهدية", "Code or gift card")} htmlFor="platform-code" required>
          <Input id="platform-code" name="code" dir="ltr" autoComplete="off" required minLength={3} maxLength={300} />
        </Field>
      ) : delivery === "ACCOUNT" ? (
        <>
          <Field label={t("إيميل الحساب الجاهز", "Ready account e-mail")} htmlFor="platform-email" required={!renewal} hint={renewal ? t("فارغ = نفس الحساب.", "Empty = same account.") : undefined}>
            <Input id="platform-email" name="accountEmail" type="email" dir="ltr" autoComplete="off" maxLength={254} />
          </Field>
          <Field label={t("كلمة المرور", "Password")} htmlFor="platform-password" required={!renewal} hint={renewal ? t("فارغ = نفس كلمة المرور.", "Empty = unchanged.") : undefined}>
            <Input id="platform-password" name="password" type="password" dir="ltr" autoComplete="new-password" maxLength={200} />
          </Field>
        </>
      ) : (
        <p className="text-sm leading-6 text-ink-2">
          {t("فعّل الاشتراك على إيميل العميل:", "Activate on the customer's e-mail:")}{" "}
          <b className="text-ink" dir="ltr">
            {customerEmail ?? "—"}
          </b>
          {t(" ثم اضغط تأكيد.", " then confirm.")}
        </p>
      )}
      <SubmitButton pendingLabel={t("جاري التسليم...", "Delivering...")}>{delivery === "CUSTOMER_EMAIL" ? t("تم التفعيل — إكمال الطلب", "Activated — complete the order") : t("تسليم وإكمال الطلب", "Deliver and complete")}</SubmitButton>
    </ActionForm>
  );
}

/** A delivered code, masked until staff ask for it (each reveal is audited). */
export function RevealCode({ orderId }: { orderId: number }) {
  const { t } = useLanguage();
  const [state, action, pending] = useActionState(revealCodeAction, null);

  return (
    <form action={action} className="mt-3 flex flex-wrap items-center gap-3">
      <input type="hidden" name="orderId" value={orderId} />
      <span className="font-mono text-sm text-ink" dir="ltr" data-testid="platform-code-value">
        {state?.ok && state.value ? state.value : "••••••••"}
      </span>
      {state?.ok && state.value ? null : (
        <SubmitButton size="sm" variant="secondary" pending={pending}>
          {t("عرض الكود (يُسجّل)", "Reveal code (audited)")}
        </SubmitButton>
      )}
      {state && !state.ok ? <span className="text-xs text-danger">{state.message}</span> : null}
    </form>
  );
}
