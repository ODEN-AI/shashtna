"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";

import { useLanguage } from "@/app/components/LanguageProvider";
import { buttonClass } from "@/app/ui/Button";
import { Checkbox, Field, Input } from "@/app/ui/Field";
import { Notice } from "@/app/ui/States";

export function RegisterForm({ destination }: { destination: string }) {
  const { t } = useLanguage();
  const [form, setForm] = useState({ name: "", phone: "", password: "", confirmPassword: "" });
  const [terms, setTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [touched, setTouched] = useState(false);

  const update = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  const passwordShort = form.password.length > 0 && form.password.length < 6;
  const mismatch = form.confirmPassword.length > 0 && form.password !== form.confirmPassword;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTouched(true);

    if (loading) {
      return;
    }

    if (!form.name.trim() || !form.phone.trim() || form.password.length < 6 || form.password !== form.confirmPassword) {
      setError(t("راجع الحقول المطلوبة.", "Please check the highlighted fields."));
      return;
    }

    if (!terms) {
      setError(t("يجب الموافقة على الشروط والأحكام.", "Please accept the terms."));
      return;
    }

    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          phone: form.phone.trim(),
          password: form.password,
          confirmPassword: form.confirmPassword,
          terms,
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.message || t("حدث خطأ أثناء إنشاء الحساب", "Couldn't create your account"));
        return;
      }

      try {
        window.localStorage.setItem("user", JSON.stringify(data.user));
      } catch {
        // Optional cache only.
      }

      window.location.assign(destination);
    } catch {
      setError(t("تعذر الاتصال بالخادم، حاول مرة أخرى", "Can't reach the server. Please try again."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      {error ? <Notice tone="danger">{error}</Notice> : null}

      <Field label={t("الاسم الكامل", "Full name")} htmlFor="name" required error={touched && !form.name.trim() ? t("الاسم مطلوب", "Name is required") : undefined}>
        <Input id="name" autoComplete="name" required value={form.name} onChange={update("name")} aria-invalid={touched && !form.name.trim()} />
      </Field>

      <Field
        label={t("رقم الهاتف", "Phone number")}
        htmlFor="phone"
        required
        hint={t("راح نستخدمه لتسجيل الدخول وللتواصل بخصوص طلباتك.", "Used to sign in and to contact you about your orders.")}
        error={touched && !form.phone.trim() ? t("رقم الهاتف مطلوب", "Phone number is required") : undefined}
      >
        <Input
          id="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          dir="ltr"
          required
          value={form.phone}
          onChange={update("phone")}
          placeholder="07xxxxxxxxx"
          className="text-start"
          aria-invalid={touched && !form.phone.trim()}
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label={t("كلمة المرور", "Password")}
          htmlFor="password"
          required
          error={passwordShort ? t("6 أحرف على الأقل", "At least 6 characters") : undefined}
        >
          <Input id="password" type="password" autoComplete="new-password" required value={form.password} onChange={update("password")} aria-invalid={passwordShort} />
        </Field>
        <Field
          label={t("تأكيد كلمة المرور", "Confirm password")}
          htmlFor="confirmPassword"
          required
          error={mismatch ? t("غير متطابقة", "Doesn't match") : undefined}
        >
          <Input id="confirmPassword" type="password" autoComplete="new-password" required value={form.confirmPassword} onChange={update("confirmPassword")} aria-invalid={mismatch} />
        </Field>
      </div>

      <Checkbox
        checked={terms}
        onChange={(event) => setTerms(event.target.checked)}
        label={
          <>
            {t("أوافق على ", "I agree to the ")}
            <Link href="/terms" target="_blank" className="font-semibold text-brand-ink underline-offset-4 hover:underline">
              {t("الشروط والأحكام", "terms")}
            </Link>
            {t(" و", " and ")}
            <Link href="/privacy" target="_blank" className="font-semibold text-brand-ink underline-offset-4 hover:underline">
              {t("سياسة الخصوصية", "privacy policy")}
            </Link>
          </>
        }
      />

      <button type="submit" disabled={loading} className={buttonClass("primary", "lg", "w-full")}>
        {loading ? <Loader2 size={18} className="animate-spin" aria-hidden /> : null}
        {loading ? t("جاري إنشاء الحساب...", "Creating account...") : t("إنشاء الحساب", "Create account")}
      </button>
    </form>
  );
}
