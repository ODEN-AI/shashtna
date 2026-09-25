"use client";

import Link from "next/link";
import { useActionState } from "react";
import { CheckCircle2 } from "lucide-react";

import { useLanguage } from "@/app/components/LanguageProvider";
import { LinkButton } from "@/app/ui/Button";
import { Field, Input } from "@/app/ui/Field";
import { Notice } from "@/app/ui/States";
import { SubmitButton } from "@/app/ui/SubmitButton";

import { completeResetAction, requestResetAction, type FormState } from "./actions";

export function ForgotPasswordForm() {
  const { t } = useLanguage();
  const [state, action] = useActionState<FormState, FormData>(requestResetAction, null);

  if (state?.ok) {
    return (
      <div className="space-y-5">
        <div className="flex items-start gap-3 rounded-2xl border border-success/25 bg-success/5 p-4">
          <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-success" aria-hidden />
          <div className="text-sm leading-7 text-ink-2">
            <p className="font-bold text-ink">{t("استلمنا طلبك", "We've received your request")}</p>
            {t(
              "إذا الرقم مرتبط بحساب، فريقنا راح يتواصل وياك للتأكد من هويتك ويعطيك رمز لمرة وحدة (صالح 30 دقيقة).",
              "If this number has an account, our team will contact you to verify it's you and give you a one-time code (valid for 30 minutes).",
            )}
          </div>
        </div>
        <LinkButton href="/reset-password" className="w-full" size="lg">
          {t("عندي الرمز", "I have a code")}
        </LinkButton>
        <LinkButton href="/help/contact" variant="secondary" className="w-full">
          {t("تواصل ويانا", "Contact us")}
        </LinkButton>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5">
      {state && !state.ok ? <Notice tone="danger">{state.message}</Notice> : null}
      <Field label={t("رقم الهاتف المسجل بحسابك", "The phone number on your account")} htmlFor="phone" required>
        <Input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" dir="ltr" required placeholder="07xxxxxxxxx" className="text-start" />
      </Field>
      <SubmitButton size="lg" className="w-full" pendingLabel={t("جاري الإرسال...", "Sending...")}>
        {t("طلب إعادة التعيين", "Request a reset")}
      </SubmitButton>
      <p className="text-center text-sm text-ink-3">
        <Link href="/reset-password" className="font-semibold text-brand-ink hover:text-ink">
          {t("عندك رمز؟ عيّن كلمة المرور", "Have a code? Set your password")}
        </Link>
      </p>
    </form>
  );
}

export function ResetPasswordForm() {
  const { t } = useLanguage();
  const [state, action] = useActionState<FormState, FormData>(completeResetAction, null);

  if (state?.ok) {
    return (
      <div className="space-y-5">
        <Notice tone="success" title={t("تم تغيير كلمة المرور", "Password changed")}>
          {t("تكدر تسجل دخولك هسه بكلمة المرور الجديدة.", "You can now sign in with your new password.")}
        </Notice>
        <LinkButton href="/login?reset=1" size="lg" className="w-full">
          {t("تسجيل الدخول", "Sign in")}
        </LinkButton>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5">
      {state && !state.ok ? <Notice tone="danger">{state.message}</Notice> : null}
      <Field label={t("رقم الهاتف", "Phone number")} htmlFor="phone" required>
        <Input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" dir="ltr" required className="text-start" />
      </Field>
      <Field label={t("الرمز (6 أرقام)", "Code (6 digits)")} htmlFor="code" required>
        <Input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} dir="ltr" required className="nums text-center tracking-[0.5em]" />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={t("كلمة المرور الجديدة", "New password")} htmlFor="password" required hint={t("6 أحرف على الأقل", "At least 6 characters")}>
          <Input id="password" name="password" type="password" autoComplete="new-password" minLength={6} required />
        </Field>
        <Field label={t("تأكيدها", "Confirm")} htmlFor="confirmPassword" required>
          <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" minLength={6} required />
        </Field>
      </div>
      <SubmitButton size="lg" className="w-full" pendingLabel={t("جاري الحفظ...", "Saving...")}>
        {t("تعيين كلمة المرور", "Set password")}
      </SubmitButton>
    </form>
  );
}
