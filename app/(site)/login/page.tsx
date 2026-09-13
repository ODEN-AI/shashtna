"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import {
  Eye,
  EyeOff,
  ArrowLeft,
  Loader2,
} from "lucide-react";

import { useLanguage } from "../components/LanguageProvider";

export default function LoginPage() {
  const { language } = useLanguage();

  const isArabic = language === "ar";

  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      const response = await fetch(
        "/api/auth/login",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            password,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(
          data.message ||
            (isArabic
              ? "حدث خطأ أثناء تسجيل الدخول"
              : "An error occurred while signing in")
        );

        return;
      }

      if (typeof window !== "undefined") {
        localStorage.setItem(
          "user",
          JSON.stringify(data.user)
        );

        localStorage.setItem(
          "remember",
          remember ? "true" : "false"
        );
      }

      window.location.href = "/dashboard";
    } catch {
      setError(
        isArabic
          ? "تعذر الاتصال بالخادم، حاول مرة أخرى"
          : "Unable to connect to the server. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      dir={isArabic ? "rtl" : "ltr"}
      className="min-h-screen bg-slate-50 text-slate-900 transition-colors dark:bg-[#070b14] dark:text-white"
    >
      <section className="flex min-h-[calc(100vh-80px)] items-center justify-center px-5 py-12 lg:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-400 text-2xl font-black text-white shadow-lg shadow-blue-600/20">
              ش
            </div>

            <h1 className="text-3xl font-black tracking-tight">
              {isArabic
                ? "تسجيل الدخول"
                : "Sign in"}
            </h1>

            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
              {isArabic
                ? "سجل دخولك للوصول إلى حسابك واشتراكاتك"
                : "Sign in to access your account and subscriptions"}
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-200/40 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/10">
            <form
              onSubmit={handleSubmit}
              className="space-y-5"
            >
              {/* Email */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {isArabic
                    ? "البريد الإلكتروني"
                    : "Email address"}
                </label>

                <input
                  suppressHydrationWarning
                  dir={isArabic ? "rtl" : "ltr"}
                  type="email"
                  value={email}
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                  placeholder="example@email.com"
                  autoComplete="email"
                  required
                  className={`w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:bg-slate-800 ${
                    isArabic
                      ? "text-right"
                      : "text-left"
                  }`}
                />
              </div>

              {/* Password */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {isArabic
                    ? "كلمة المرور"
                    : "Password"}
                </label>

                <div className="relative">
                  <input
                    suppressHydrationWarning
                    dir={isArabic ? "rtl" : "ltr"}
                    type={
                      showPassword
                        ? "text"
                        : "password"
                    }
                    value={password}
                    onChange={(event) =>
                      setPassword(event.target.value)
                    }
                    placeholder={
                      isArabic
                        ? "أدخل كلمة المرور"
                        : "Enter your password"
                    }
                    autoComplete="current-password"
                    required
                    className={`w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:bg-slate-800 ${
                      isArabic
                        ? "pl-12 pr-4 text-right"
                        : "pl-12 pr-4 text-left"
                    }`}
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword(
                        !showPassword
                      )
                    }
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-blue-600 dark:hover:text-blue-400"
                    aria-label={
                      showPassword
                        ? isArabic
                          ? "إخفاء كلمة المرور"
                          : "Hide password"
                        : isArabic
                          ? "إظهار كلمة المرور"
                          : "Show password"
                    }
                  >
                    {showPassword ? (
                      <EyeOff size={19} />
                    ) : (
                      <Eye size={19} />
                    )}
                  </button>
                </div>
              </div>

              {/* Remember + Forgot */}
              <div
                className={`flex items-center justify-between ${
                  isArabic
                    ? ""
                    : "flex-row-reverse"
                }`}
              >
                <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(event) =>
                      setRemember(
                        event.target.checked
                      )
                    }
                    className="h-4 w-4 rounded border-slate-300 accent-blue-600"
                  />

                  {isArabic
                    ? "تذكرني"
                    : "Remember me"}
                </label>

                <button
                  type="button"
                  className="text-sm font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  {isArabic
                    ? "نسيت كلمة المرور؟"
                    : "Forgot password?"}
                </button>
              </div>

              {/* Error */}
              {error && (
                <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-center text-sm font-medium text-red-600 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:from-blue-700 hover:to-cyan-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2
                      size={18}
                      className="animate-spin"
                    />

                    {isArabic
                      ? "جاري تسجيل الدخول..."
                      : "Signing in..."}
                  </>
                ) : (
                  <>
                    {isArabic
                      ? "تسجيل الدخول"
                      : "Sign in"}
                  </>
                )}
              </button>
            </form>

            <div className="my-6 flex items-center gap-4">
              <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />

              <span className="text-xs text-slate-400">
                {isArabic ? "أو" : "OR"}
              </span>

              <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
            </div>

            <p className="text-center text-sm text-slate-500 dark:text-slate-400">
              {isArabic
                ? "ما عندك حساب؟"
                : "Don't have an account?"}{" "}
              <Link
                href="/register"
                className="font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                {isArabic
                  ? "إنشاء حساب جديد"
                  : "Create a new account"}
              </Link>
            </p>
          </div>

          <div className="mt-6 text-center">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400"
            >
              <ArrowLeft
                size={16}
                className={
                  isArabic ? "" : "rotate-180"
                }
              />

              {isArabic
                ? "العودة للرئيسية"
                : "Back to home"}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}