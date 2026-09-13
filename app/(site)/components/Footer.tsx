"use client";

import Link from "next/link";
import {
  Send,
  Tv2,
  MessageCircle,
} from "lucide-react";

import { useLanguage } from "./LanguageProvider";

export default function Footer() {
  const { language } = useLanguage();

  const isArabic = language === "ar";

  return (
    <footer
      dir={isArabic ? "rtl" : "ltr"}
      className="border-t border-slate-200 bg-slate-950 text-white"
    >
      <div className="mx-auto grid max-w-7xl gap-12 px-5 py-14 md:grid-cols-2 lg:grid-cols-4 lg:px-8">
        {/* Brand */}
        <div className="lg:col-span-2">
          <Link
            href="/"
            className="mb-5 flex w-fit items-center gap-3"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-400 text-white">
              <Tv2 size={22} />
            </div>

            <div>
              <div className="text-xl font-black">
                شاشتنا
              </div>

              <div className="mt-1 text-[10px] font-semibold tracking-[0.2em] text-cyan-400">
                ENTERTAINMENT
              </div>
            </div>
          </Link>

          <p className="max-w-md text-sm leading-7 text-slate-400">
            {isArabic
              ? "منصة شاشتنا توفر لك اشتراكات ترفيهية بطريقة بسيطة وواضحة، مع باقات تناسب احتياجاتك ودعم يساعدك بكل خطوة."
              : "Shashtna provides entertainment subscriptions in a simple and clear way, with plans that fit your needs and support whenever you need it."}
          </p>

          {/* Social */}
          <div className="mt-6 flex items-center gap-3">
            <a
              href="#"
              aria-label="WhatsApp"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-slate-300 transition hover:border-emerald-500 hover:bg-emerald-500 hover:text-white"
            >
              <MessageCircle size={18} />
            </a>

            <a
              href="#"
              aria-label="Telegram"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-slate-300 transition hover:border-cyan-500 hover:bg-cyan-500 hover:text-white"
            >
              <Send size={18} />
            </a>
          </div>
        </div>

        {/* Links */}
        <div>
          <h3 className="mb-5 text-sm font-bold text-white">
            {isArabic ? "روابط سريعة" : "Quick links"}
          </h3>

          <div className="flex flex-col gap-3">
            <Link
              href="/"
              className="text-sm text-slate-400 transition hover:text-white"
            >
              {isArabic ? "الرئيسية" : "Home"}
            </Link>

            <Link
              href="/plans"
              className="text-sm text-slate-400 transition hover:text-white"
            >
              {isArabic ? "الباقات" : "Plans"}
            </Link>

            <Link
              href="/apps"
              className="text-sm text-slate-400 transition hover:text-white"
            >
              {isArabic ? "التطبيقات" : "Apps"}
            </Link>

            <Link
              href="/about"
              className="text-sm text-slate-400 transition hover:text-white"
            >
              {isArabic ? "من نحن" : "About"}
            </Link>

            <Link
              href="/tickets"
              className="text-sm text-slate-400 transition hover:text-white"
            >
              {isArabic ? "الدعم الفني" : "Support"}
            </Link>
          </div>
        </div>

        {/* Account */}
        <div>
          <h3 className="mb-5 text-sm font-bold text-white">
            {isArabic ? "حسابك" : "Your account"}
          </h3>

          <div className="flex flex-col gap-3">
            <Link
              href="/login"
              className="text-sm text-slate-400 transition hover:text-white"
            >
              {isArabic ? "تسجيل الدخول" : "Sign in"}
            </Link>

            <Link
              href="/register"
              className="text-sm text-slate-400 transition hover:text-white"
            >
              {isArabic ? "إنشاء حساب" : "Create account"}
            </Link>

            <Link
              href="/dashboard"
              className="text-sm text-slate-400 transition hover:text-white"
            >
              {isArabic ? "لوحة التحكم" : "Dashboard"}
            </Link>

            <Link
              href="/subscriptions"
              className="text-sm text-slate-400 transition hover:text-white"
            >
              {isArabic
                ? "اشتراكاتي"
                : "My subscriptions"}
            </Link>

            <Link
              href="/orders"
              className="text-sm text-slate-400 transition hover:text-white"
            >
              {isArabic ? "طلباتي" : "My orders"}
            </Link>
          </div>
        </div>
      </div>

      {/* Bottom */}
      <div className="border-t border-slate-800">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-5 text-xs text-slate-500 md:flex-row md:items-center md:justify-between lg:px-8">
          <p>
            © {new Date().getFullYear()} شاشتنا.{" "}
            {isArabic
              ? "جميع الحقوق محفوظة."
              : "All rights reserved."}
          </p>

          <div className="flex gap-5">
            <Link
              href="#"
              className="transition hover:text-slate-300"
            >
              {isArabic
                ? "سياسة الخصوصية"
                : "Privacy Policy"}
            </Link>

            <Link
              href="#"
              className="transition hover:text-slate-300"
            >
              {isArabic
                ? "الشروط والأحكام"
                : "Terms & Conditions"}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}