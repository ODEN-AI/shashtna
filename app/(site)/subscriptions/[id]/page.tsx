"use client";

import Link from "next/link";
import { ArrowLeft, Tv } from "lucide-react";
import { useLanguage } from "../../components/LanguageProvider";

export default function SubscriptionDetailsPage() {
  const { language } = useLanguage();

  const isArabic = language === "ar";

  return (
    <main
      dir={isArabic ? "rtl" : "ltr"}
      className="min-h-screen bg-slate-50 text-slate-900 transition-colors dark:bg-[#070b14] dark:text-white"
    >
      <section className="mx-auto max-w-4xl px-5 py-20 lg:px-8">
        <div className="rounded-[2rem] border border-slate-200 bg-white px-6 py-16 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
            <Tv size={32} />
          </div>

          <h1 className="mt-6 text-3xl font-black tracking-tight sm:text-4xl">
            {isArabic
              ? "تفاصيل الاشتراك"
              : "Subscription details"}
          </h1>

          <p className="mx-auto mt-4 max-w-xl leading-8 text-slate-500 dark:text-slate-400">
            {isArabic
              ? "تفاصيل الاشتراك ستظهر هنا بعد ربط النظام بقاعدة البيانات."
              : "Your subscription details will appear here once this page is connected to the database."}
          </p>

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/subscriptions"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 py-3.5 text-sm font-black text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700"
            >
              <ArrowLeft
                size={17}
                className={isArabic ? "" : "rotate-180"}
              />

              {isArabic
                ? "العودة للاشتراكات"
                : "Back to subscriptions"}
            </Link>

            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-3.5 text-sm font-bold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-500/40 dark:hover:bg-slate-800"
            >
              {isArabic
                ? "لوحة التحكم"
                : "Dashboard"}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}