"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AppWindow,
  ArrowLeft,
  CheckCircle2,
  Download,
  ExternalLink,
  Search,
} from "lucide-react";

import { useLanguage } from "../components/LanguageProvider";

type AppItem = {
  id: number;
  name: string;
  slug: string;
  description: string;
  platform: string;
  version: string | null;
  downloadUrl: string;
  imageUrl: string | null;
  instructions: string | null;
  notes: string | null;
  isActive: boolean;
};

export default function AppsPage() {
  const { language } = useLanguage();

  const isArabic = language === "ar";

  const [apps, setApps] = useState<AppItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadApps();
  }, []);

  async function loadApps() {
    try {
      setLoading(true);

      const response = await fetch("/api/admin/apps", {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
            (isArabic
              ? "تعذر جلب التطبيقات"
              : "Unable to load apps")
        );
      }

      setApps(
        (data.apps ?? []).filter(
          (app: AppItem) => app.isActive
        )
      );
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  const filteredApps = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return apps;
    }

    return apps.filter((app) => {
      return (
        app.name.toLowerCase().includes(query) ||
        app.platform.toLowerCase().includes(query) ||
        app.description.toLowerCase().includes(query)
      );
    });
  }, [apps, search]);

  return (
    <main
      dir={isArabic ? "rtl" : "ltr"}
      className="min-h-screen bg-white text-slate-900 transition-colors dark:bg-[#070b14] dark:text-white"
    >
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-slate-100 dark:border-slate-800">
        <div className="pointer-events-none absolute -right-32 -top-32 h-80 w-80 rounded-full bg-blue-100/60 blur-3xl dark:bg-blue-900/20" />

        <div className="pointer-events-none absolute -left-32 top-20 h-72 w-72 rounded-full bg-cyan-100/50 blur-3xl dark:bg-cyan-900/10" />

        <div className="relative mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-20">
          <Link
            href="/"
            className="mb-8 inline-flex items-center gap-2 text-sm font-bold text-blue-600 transition hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            <ArrowLeft
              size={16}
              className={isArabic ? "" : "rotate-180"}
            />

            {isArabic
              ? "العودة للرئيسية"
              : "Back to home"}
          </Link>

          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-xs font-black text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-400">
                <AppWindow size={15} />

                APPLICATIONS
              </div>

              <h1 className="text-4xl font-black tracking-tight text-slate-950 dark:text-white sm:text-5xl">
                {isArabic ? (
                  <>
                    التطبيقات اللازمة
                    <span className="block bg-gradient-to-l from-blue-700 via-blue-600 to-cyan-500 bg-clip-text text-transparent">
                      لتشغيل اشتراكك.
                    </span>
                  </>
                ) : (
                  <>
                    Apps you need
                    <span className="block bg-gradient-to-r from-blue-700 via-blue-600 to-cyan-500 bg-clip-text text-transparent">
                      to use your subscription.
                    </span>
                  </>
                )}
              </h1>

              <p className="mt-5 max-w-2xl text-sm leading-8 text-slate-500 dark:text-slate-400 sm:text-base">
                {isArabic
                  ? "هنا تلقى التطبيقات والبرامج التي تحتاجها لمشاهدة اشتراكك بسهولة، مع معلومات المنصة والإصدار وطريقة الاستخدام."
                  : "Find the apps and software you need to enjoy your subscription easily, along with platform, version, and usage information."}
              </p>
            </div>

            <div className="w-full lg:max-w-sm">
              <div className="relative">
                <Search
                  size={19}
                  className={`absolute top-1/2 -translate-y-1/2 text-slate-400 ${
                    isArabic
                      ? "right-4"
                      : "left-4"
                  }`}
                />

                <input
                  suppressHydrationWarning
                  dir={isArabic ? "rtl" : "ltr"}
                  type="text"
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder={
                    isArabic
                      ? "ابحث عن تطبيق..."
                      : "Search for an app..."
                  }
                  className={`w-full rounded-2xl border border-slate-200 bg-white py-4 text-sm shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white ${
                    isArabic
                      ? "pl-4 pr-12 text-right"
                      : "pl-12 pr-4 text-left"
                  }`}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Apps */}
      <section className="bg-white dark:bg-[#070b14]">
        <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-20">
          {loading ? (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {[1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="aspect-[16/9] animate-pulse bg-slate-200 dark:bg-slate-800" />

                  <div className="space-y-3 p-6">
                    <div className="h-6 w-1/2 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />

                    <div className="h-4 w-full animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />

                    <div className="h-4 w-4/5 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />

                    <div className="h-11 w-full animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredApps.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-24 text-center dark:border-slate-700 dark:bg-slate-900">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                <AppWindow size={28} />
              </div>

              <h2 className="mt-5 text-xl font-black">
                {isArabic
                  ? "لا توجد تطبيقات متاحة حاليًا"
                  : "No apps available right now"}
              </h2>

              <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-slate-500 dark:text-slate-400">
                {search
                  ? isArabic
                    ? "ما لقينا تطبيق يطابق بحثك."
                    : "No app matches your search."
                  : isArabic
                    ? "سيتم نشر التطبيقات المطلوبة هنا عند توفرها."
                    : "Available apps will be published here when they are ready."}
              </p>

              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="mt-6 rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white transition hover:bg-blue-700"
                >
                  {isArabic
                    ? "إظهار كل التطبيقات"
                    : "Show all apps"}
                </button>
              )}
            </div>
          ) : (
            <>
              <div
                className={`mb-8 flex items-center justify-between ${
                  isArabic
                    ? "text-right"
                    : "text-left"
                }`}
              >
                <div>
                  <h2 className="text-xl font-black">
                    {isArabic
                      ? "التطبيقات المتوفرة"
                      : "Available apps"}
                  </h2>

                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {isArabic
                      ? `${filteredApps.length} تطبيق متاح`
                      : `${filteredApps.length} ${
                          filteredApps.length === 1
                            ? "app"
                            : "apps"
                        } available`}
                  </p>
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {filteredApps.map((app) => (
                  <AppCard
                    key={app.id}
                    app={app}
                    isArabic={isArabic}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {/* Help CTA */}
      <section className="bg-slate-50 px-5 py-16 dark:bg-slate-900/60 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-[32px] bg-gradient-to-l from-blue-700 via-blue-600 to-cyan-500 px-7 py-10 shadow-2xl shadow-blue-600/20 sm:px-10 lg:py-12">
            <div className="flex flex-col gap-7 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-xs font-black tracking-[0.18em] text-blue-100">
                  NEED HELP?
                </div>

                <h2 className="mt-3 text-2xl font-black text-white sm:text-3xl">
                  {isArabic
                    ? "ما تعرف أي تطبيق تستخدم؟"
                    : "Not sure which app to use?"}
                </h2>

                <p className="mt-3 max-w-xl text-sm leading-7 text-blue-100">
                  {isArabic
                    ? "تواصل ويانا ونساعدك تختار التطبيق المناسب لجهازك وطريقة تشغيل اشتراكك."
                    : "Contact us and we will help you choose the right app for your device and subscription."}
                </p>
              </div>

              <Link
                href="/tickets"
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-white px-6 py-3.5 text-sm font-black text-blue-700 transition hover:bg-blue-50"
              >
                {isArabic
                  ? "تواصل مع الدعم"
                  : "Contact support"}

                <ArrowLeft
                  size={17}
                  className={isArabic ? "" : "rotate-180"}
                />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function AppCard({
  app,
  isArabic,
}: {
  app: AppItem;
  isArabic: boolean;
}) {
  return (
    <article className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl dark:border-slate-800 dark:bg-slate-900">
      <div className="relative aspect-[16/9] overflow-hidden bg-gradient-to-br from-blue-700 via-blue-600 to-cyan-500">
        {app.imageUrl ? (
          <img
            src={app.imageUrl}
            alt={app.name}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-white/75">
            <AppWindow size={52} />
          </div>
        )}

        <div
          className={`absolute top-4 ${
            isArabic
              ? "right-4"
              : "left-4"
          }`}
        >
          <span className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-[10px] font-black text-white backdrop-blur">
            <CheckCircle2 size={13} />

            {isArabic ? "متوفر" : "Available"}
          </span>
        </div>
      </div>

      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-black">
              {app.name}
            </h2>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-blue-50 px-3 py-1.5 text-[10px] font-black text-blue-700 dark:bg-blue-500/10 dark:text-blue-400">
                {app.platform}
              </span>

              {app.version && (
                <span className="rounded-full bg-slate-100 px-3 py-1.5 text-[10px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  {app.version}
                </span>
              )}
            </div>
          </div>
        </div>

        <p className="mt-5 text-sm leading-7 text-slate-500 dark:text-slate-400">
          {app.description}
        </p>

        {app.instructions && (
          <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/70">
            <div className="text-xs font-black text-slate-700 dark:text-slate-200">
              {isArabic
                ? "طريقة الاستخدام"
                : "How to use"}
            </div>

            <p className="mt-2 whitespace-pre-line text-xs leading-6 text-slate-500 dark:text-slate-400">
              {app.instructions}
            </p>
          </div>
        )}

        {app.notes && (
          <div className="mt-4 text-xs leading-6 text-slate-400">
            {app.notes}
          </div>
        )}

        <a
          href={app.downloadUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-6 flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3.5 text-sm font-black text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700"
        >
          <Download size={17} />

          {isArabic
            ? "تحميل التطبيق"
            : "Download app"}

          <ExternalLink size={15} />
        </a>
      </div>
    </article>
  );
}