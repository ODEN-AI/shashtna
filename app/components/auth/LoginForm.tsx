"use client";

import Link from "next/link";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";

import { useLanguage } from "@/app/components/LanguageProvider";
import { buttonClass } from "@/app/ui/Button";
import { Field, Input } from "@/app/ui/Field";
import { Notice } from "@/app/ui/States";

export function LoginForm({ destination }: { destination: string }) {
  const { t } = useLanguage();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) {
      return;
    }

    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim(), password }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.message || t("حدث خطأ أثناء تسجيل الدخول", "Couldn't sign you in"));
        return;
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

      <Field label={t("رقم الهاتف", "Phone number")} htmlFor="phone" required>
        <Input
          id="phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          dir="ltr"
          required
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          placeholder="07xxxxxxxxx"
          className="text-start"
        />
      </Field>

      <Field label={t("كلمة المرور", "Password")} htmlFor="password" required>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="pe-12"
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            className="absolute inset-y-0 end-0 flex w-12 items-center justify-center text-ink-3 hover:text-ink"
            aria-label={showPassword ? t("إخفاء كلمة المرور", "Hide password") : t("إظهار كلمة المرور", "Show password")}
            aria-pressed={showPassword}
          >
            {showPassword ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
          </button>
        </div>
      </Field>

      <div className="flex justify-end">
        <Link href="/forgot-password" className="text-sm font-semibold text-brand-ink hover:text-ink">
          {t("نسيت كلمة المرور؟", "Forgot password?")}
        </Link>
      </div>

      <button
        type="submit"
        disabled={loading || !phone.trim() || !password}
        className={buttonClass("primary", "lg", "w-full")}
      >
        {loading ? <Loader2 size={18} className="animate-spin" aria-hidden /> : null}
        {loading ? t("جاري تسجيل الدخول...", "Signing in...") : t("تسجيل الدخول", "Sign in")}
      </button>
    </form>
  );
}
