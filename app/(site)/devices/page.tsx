"use client";

import Link from "next/link";
import { ArrowLeft, Smartphone } from "lucide-react";
import { useLanguage } from "../components/LanguageProvider";

export default function DevicesPage() {
  const { language } = useLanguage();

  const isArabic = language === "ar";

  return (
    <main
      dir={isArabic ? "rtl" : "ltr"}
      className="min-h-screen bg-slate-50 text-slate-900 transition-colors dark:bg-[#070b14] dark:text-white"
    >
      <section className="mx-auto max-w-4xl px-5 py-20 lg:px-8">
        <div className="rounded-[2rem] border border-slate-200 bg-white px-6 py-16 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
            <Smartphone size={34} />
          </div>

          <h1 className="mt-6 text-3xl font-black tracking-tight sm:text-4xl">
            {isArabic ? "أجهزتي" : "My devices"}
          </h1>

          <p className="mx-auto mt-4 max-w-xl leading-8 text-slate-500 dark:text-slate-400">
            {isArabic
              ? "ستظهر الأجهزة المتصلة باشتراكاتك هنا."
              : "Your connected devices will appear here."}
          </p>

          <div className="mt-8">
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 py-3.5 text-sm font-black text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700"
            >
              <ArrowLeft
                size={17}
                className={isArabic ? "" : "rotate-180"}
              />

              {isArabic
                ? "العودة إلى لوحة التحكم"
                : "Back to dashboard"}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}