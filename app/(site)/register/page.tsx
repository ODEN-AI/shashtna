"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import {
  Eye,
  EyeOff,
  LockKeyhole,
  Phone,
  ShieldCheck,
  Tv,
  UserRound,
  Check,
  ArrowLeft,
  Loader2,
} from "lucide-react";

import { useLanguage } from "../components/LanguageProvider";

export default function RegisterPage() {
  const { language } = useLanguage();

  const isArabic = language === "ar";

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");
  const [terms, setTerms] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const response = await fetch(
        "/api/auth/register",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name,
            phone,
            password,
            confirmPassword,
            terms,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(
          data.message ||
            (isArabic
              ? "حدث خطأ أثناء إنشاء الحساب"
              : "An error occurred while creating your account")
        );

        return;
      }

      setSuccess(
        data.message ||
          (isArabic
            ? "تم إنشاء الحساب بنجاح"
            : "Account created successfully")
      );

      if (data.user && typeof window !== "undefined") {
        localStorage.setItem(
          "user",
          JSON.stringify(data.user)
        );

        localStorage.setItem(
          "remember",
          "true"
        );
      }

      setName("");
      setPhone("");
      setPassword("");
      setConfirmPassword("");
      setTerms(false);

      setTimeout(() => {
        window.location.href = "/dashboard";
      }, 500);
    } catch {
      setError(
        isArabic
          ? "تعذر الاتصال بالخادم. حاول مرة أخرى."
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
      <section className="relative flex min-h-[calc(100vh-80px)] items-center justify-center overflow-hidden px-5 py-14 lg:px-8">
        <div className="pointer-events-none absolute -right-40 top-0 h-96 w-96 rounded-full bg-blue-100/70 blur-3xl dark:bg-blue-900/20" />

        <div className="pointer-events-none absolute -left-40 bottom-0 h-96 w-96 rounded-full bg-cyan-100/60 blur-3xl dark:bg-cyan-900/10" />

        <div className="relative grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/20 lg:grid-cols-2">
          <div className="relative hidden overflow-hidden bg-gradient-to-br from-blue-700 via-blue-600 to-cyan-500 p-10 text-white lg:block">
            <div className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-white/10" />

            <div className="absolute -bottom-32 -right-20 h-80 w-80 rounded-full bg-white/10" />

            <div className="relative flex h-full flex-col justify-between">
              <div>
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-md">
                  <Tv size={28} />
                </div>

                <h2 className="mt-8 text-4xl font-black leading-tight">
                  {isArabic ? (
                    <>
                      حسابك،
                      <br />
                      بمكان واحد.
                    </>
                  ) : (
                    <>
                      Your account,
                      <br />
                      all in one place.
                    </>
                  )}
                </h2>

                <p className="mt-5 max-w-sm leading-8 text-blue-100">
                  {isArabic
                    ? "أنشئ حسابك في شاشتنا حتى تقدر تتابع اشتراكاتك، تدير أجهزتك، وتجدد اشتراكك بسهولة."
                    : "Create your Shashtna account to manage subscriptions, track your devices, and renew your service with ease."}
                </p>
              </div>

              <div className="mt-12 space-y-5">
                <div className="flex items-center gap-3 text-sm font-semibold">
                  <ShieldCheck size={20} />

                  {isArabic
                    ? "إدارة آمنة لحسابك"
                    : "Secure account management"}
                </div>

                <div className="flex items-center gap-3 text-sm font-semibold">
                  <Check size={20} />

                  {isArabic
                    ? "متابعة حالة اشتراكك"
                    : "Track your subscription"}
                </div>

                <div className="flex items-center gap-3 text-sm font-semibold">
                  <UserRound size={20} />

                  {isArabic
                    ? "جميع معلوماتك بمكان واحد"
                    : "All your information in one place"}
                </div>
              </div>
            </div>
          </div>

          <div className="p-7 sm:p-10 lg:p-12">
            <div className="mb-8">
              <p className="text-sm font-black text-blue-600 dark:text-blue-400">
                {isArabic
                  ? "أهلًا بك في شاشتنا"
                  : "Welcome to Shashtna"}
              </p>

              <h2 className="mt-2 text-3xl font-black tracking-tight">
                {isArabic
                  ? "إنشاء حساب"
                  : "Create account"}
              </h2>

              <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
                {isArabic
                  ? "أنشئ حسابك حتى تدير اشتراكاتك بسهولة."
                  : "Create your account to manage your subscriptions easily."}
              </p>
            </div>

            <form
              onSubmit={handleSubmit}
              className="space-y-5"
            >
              <div>
                <label
                  htmlFor="name"
                  className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-200"
                >
                  {isArabic
                    ? "الاسم الكامل"
                    : "Full name"}
                </label>

                <div className="relative">
                  <UserRound
                    size={19}
                    className={`absolute top-1/2 -translate-y-1/2 text-slate-400 ${
                      isArabic
                        ? "right-4"
                        : "left-4"
                    }`}
                  />

                  <input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(event) =>
                      setName(event.target.value)
                    }
                    placeholder={
                      isArabic
                        ? "اكتب اسمك الكامل"
                        : "Enter your full name"
                    }
                    autoComplete="name"
                    required
                    className={`w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:bg-slate-800 ${
                      isArabic
                        ? "pl-4 pr-11 text-right"
                        : "pl-11 pr-4 text-left"
                    }`}
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="phone"
                  className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-200"
                >
                  {isArabic
                    ? "رقم الهاتف"
                    : "Phone number"}
                </label>

                <div className="relative">
                  <Phone
                    size={19}
                    className={`absolute top-1/2 -translate-y-1/2 text-slate-400 ${
                      isArabic
                        ? "right-4"
                        : "left-4"
                    }`}
                  />

                  <input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(event) =>
                      setPhone(event.target.value)
                    }
                    placeholder="07XXXXXXXXX"
                    autoComplete="tel"
                    required
                    className={`w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:bg-slate-800 ${
                      isArabic
                        ? "pl-4 pr-11 text-right"
                        : "pl-11 pr-4 text-left"
                    }`}
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-200"
                >
                  {isArabic
                    ? "كلمة المرور"
                    : "Password"}
                </label>

                <div className="relative">
                  <LockKeyhole
                    size={19}
                    className={`absolute top-1/2 -translate-y-1/2 text-slate-400 ${
                      isArabic
                        ? "right-4"
                        : "left-4"
                    }`}
                  />

                  <input
                    id="password"
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
                        ? "أنشئ كلمة مرور قوية"
                        : "Create a strong password"
                    }
                    autoComplete="new-password"
                    required
                    minLength={6}
                    className={`w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:bg-slate-800 ${
                      isArabic
                        ? "pl-12 pr-11 text-right"
                        : "pl-11 pr-12 text-left"
                    }`}
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword(
                        !showPassword
                      )
                    }
                    className={`absolute top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-700 dark:hover:text-slate-200 ${
                      isArabic
                        ? "left-4"
                        : "right-4"
                    }`}
                  >
                    {showPassword ? (
                      <EyeOff size={19} />
                    ) : (
                      <Eye size={19} />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="confirmPassword"
                  className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-200"
                >
                  {isArabic
                    ? "تأكيد كلمة المرور"
                    : "Confirm password"}
                </label>

                <div className="relative">
                  <LockKeyhole
                    size={19}
                    className={`absolute top-1/2 -translate-y-1/2 text-slate-400 ${
                      isArabic
                        ? "right-4"
                        : "left-4"
                    }`}
                  />

                  <input
                    id="confirmPassword"
                    type={
                      showConfirmPassword
                        ? "text"
                        : "password"
                    }
                    value={confirmPassword}
                    onChange={(event) =>
                      setConfirmPassword(
                        event.target.value
                      )
                    }
                    placeholder={
                      isArabic
                        ? "أعد كتابة كلمة المرور"
                        : "Re-enter your password"
                    }
                    autoComplete="new-password"
                    required
                    minLength={6}
                    className={`w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:bg-slate-800 ${
                      isArabic
                        ? "pl-12 pr-11 text-right"
                        : "pl-11 pr-12 text-left"
                    }`}
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowConfirmPassword(
                        !showConfirmPassword
                      )
                    }
                    className={`absolute top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-700 dark:hover:text-slate-200 ${
                      isArabic
                        ? "left-4"
                        : "right-4"
                    }`}
                  >
                    {showConfirmPassword ? (
                      <EyeOff size={19} />
                    ) : (
                      <Eye size={19} />
                    )}
                  </button>
                </div>
              </div>

              <label className="flex cursor-pointer items-start gap-3 pt-1 text-xs leading-6 text-slate-500 dark:text-slate-400">
                <input
                  type="checkbox"
                  checked={terms}
                  onChange={(event) =>
                    setTerms(event.target.checked)
                  }
                  className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 accent-blue-600"
                  required
                />

                <span>
                  {isArabic ? (
                    <>
                      أوافق على{" "}
                      <a
                        href="#"
                        className="font-bold text-blue-600 hover:text-blue-700"
                      >
                        شروط الاستخدام
                      </a>{" "}
                      و{" "}
                      <a
                        href="#"
                        className="font-bold text-blue-600 hover:text-blue-700"
                      >
                        سياسة الخصوصية
                      </a>
                      .
                    </>
                  ) : (
                    <>
                      I agree to the{" "}
                      <a
                        href="#"
                        className="font-bold text-blue-600 hover:text-blue-700"
                      >
                        Terms of Use
                      </a>{" "}
                      and{" "}
                      <a
                        href="#"
                        className="font-bold text-blue-600 hover:text-blue-700"
                      >
                        Privacy Policy
                      </a>
                      .
                    </>
                  )}
                </span>
              </label>

              {error && (
                <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-600 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
                  {error}
                </div>
              )}

              {success && (
                <div className="rounded-2xl border border-green-100 bg-green-50 px-4 py-3 text-sm font-bold text-green-600 dark:border-green-900/50 dark:bg-green-950/30 dark:text-green-400">
                  {success}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 py-4 text-sm font-black text-white shadow-xl shadow-blue-600/20 transition hover:bg-blue-700 hover:shadow-blue-600/30 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2
                      size={18}
                      className="animate-spin"
                    />

                    {isArabic
                      ? "جاري إنشاء الحساب..."
                      : "Creating account..."}
                  </>
                ) : (
                  <>
                    {isArabic
                      ? "إنشاء الحساب"
                      : "Create account"}
                  </>
                )}
              </button>
            </form>

            <div className="mt-7 text-center text-sm text-slate-500 dark:text-slate-400">
              {isArabic
                ? "عندك حساب بالفعل؟"
                : "Already have an account?"}{" "}
              <Link
                href="/login"
                className="font-black text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                {isArabic
                  ? "تسجيل الدخول"
                  : "Sign in"}
              </Link>
            </div>

            <Link
              href="/"
              className="mt-5 flex items-center justify-center gap-2 text-center text-xs font-bold text-slate-400 transition hover:text-blue-600 dark:hover:text-blue-400"
            >
              <ArrowLeft
                size={14}
                className={isArabic ? "" : "rotate-180"}
              />

              {isArabic
                ? "العودة إلى الرئيسية"
                : "Back to home"}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}