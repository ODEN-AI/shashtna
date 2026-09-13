"use client";

import Link from "next/link";
import { ArrowLeft, Headphones } from "lucide-react";
import { useLanguage } from "../components/LanguageProvider";

export default function TicketsPage() {
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
            <Headphones size={34} />
          </div>

          <h1 className="mt-6 text-3xl font-black tracking-tight sm:text-4xl">
            {isArabic ? "تذاكر الدعم" : "Support tickets"}
          </h1>

          <p className="mx-auto mt-4 max-w-xl leading-8 text-slate-500 dark:text-slate-400">
            {isArabic
              ? "تقدر تتابع طلبات الدعم الفني من هنا."
              : "You will be able to track your support requests here."}
          </p>

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
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

            <Link
              href="/apps"
              className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-3.5 text-sm font-bold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-500/40 dark:hover:bg-slate-800"
            >
              {isArabic
                ? "عرض التطبيقات"
                : "View apps"}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}