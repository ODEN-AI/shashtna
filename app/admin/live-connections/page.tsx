"use client";

import Link from "next/link";
import { ArrowRight, Construction } from "lucide-react";

export default function AdminPage() {
  return (
    <main
      dir="rtl"
      className="min-h-screen bg-slate-50 p-5 text-slate-900 transition-colors dark:bg-slate-950 dark:text-white md:p-8"
    >
      <div className="mx-auto max-w-7xl">

        <Link
          href="/admin"
          className="mb-6 inline-flex items-center gap-2 text-sm font-bold text-blue-600 transition hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          <ArrowRight size={17} />
          العودة إلى لوحة الإدارة
        </Link>

        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">

          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
            <Construction size={26} />
          </div>

          <h1 className="mt-6 text-2xl font-black md:text-3xl">
            الاتصالات المباشرة
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-500 dark:text-slate-400">
            هذه الصفحة أصبحت مرتبطة بشكل صحيح ضمن لوحة الإدارة.
            سيتم تطوير وظائف هذا القسم وربطه بقاعدة البيانات في المرحلة التالية.
          </p>

          <div className="mt-7 inline-flex rounded-xl bg-slate-50 px-4 py-3 text-xs font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            القسم جاهز للتطوير
          </div>

        </div>
      </div>
    </main>
  );
}
