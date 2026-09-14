"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  CirclePlay,
  Headphones,
  ShieldCheck,
  Sparkles,
  Tv2,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";

import { useLanguage } from "./components/LanguageProvider";

type PopularPackage = {
  id: number;
  name: string;
  slug: string;
  price: number;
  durationMonths: number;
  durationLabel: string;
  description: string;
  specifications: string;
  notes: string | null;
  imageUrl: string | null;
  isActive: boolean;
  salesCount: number;
};

const steps = [
  {
    number: "01",
    titleAr: "اختر الباقة",
    titleEn: "Choose a plan",
    descriptionAr:
      "شوف الباقات المتوفرة واختر الاشتراك المناسب لك.",
    descriptionEn:
      "Browse the available plans and choose the one that suits you.",
  },
  {
    number: "02",
    titleAr: "أنشئ حسابك",
    titleEn: "Create your account",
    descriptionAr:
      "سجل بياناتك حتى نقدر ندير اشتراكك وطلباتك بسهولة.",
    descriptionEn:
      "Create your account so we can manage your subscription and orders easily.",
  },
  {
    number: "03",
    titleAr: "فعّل اشتراكك",
    titleEn: "Activate your subscription",
    descriptionAr:
      "بعد إتمام الطلب تحصل على بيانات الاشتراك والتعليمات.",
    descriptionEn:
      "After completing your order, you will receive your subscription details and instructions.",
  },
];

function formatPrice(price: number) {
  return new Intl.NumberFormat("en-US").format(price);
}

export default function HomePage() {
  const { language } = useLanguage();
  const isArabic = language === "ar";

  const [popularPackages, setPopularPackages] =
    useState<PopularPackage[]>([]);

  const [packagesLoading, setPackagesLoading] =
    useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadPopularPackages() {
      try {
        setPackagesLoading(true);

        const response = await fetch(
          "/api/popular-packages",
          {
            method: "GET",
            cache: "no-store",
          }
        );

        const data =
          (await response.json()) as {
            success?: boolean;
            packages?: PopularPackage[];
          };

        if (
          !response.ok ||
          !data.success
        ) {
          throw new Error(
            "Failed to load popular packages."
          );
        }

        if (!cancelled) {
          setPopularPackages(
            Array.isArray(data.packages)
              ? data.packages
              : []
          );
        }
      } catch (error) {
        console.error(
          "Homepage popular packages error:",
          error
        );

        if (!cancelled) {
          setPopularPackages([]);
        }
      } finally {
        if (!cancelled) {
          setPackagesLoading(false);
        }
      }
    }

    void loadPopularPackages();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main
      dir={isArabic ? "rtl" : "ltr"}
      className="min-h-screen overflow-hidden bg-white text-slate-900 transition-colors duration-500 dark:bg-[#070b14] dark:text-slate-100"
    >
      {/* =====================================================
          HERO
          ===================================================== */}

      <section className="relative isolate overflow-hidden bg-white transition-colors duration-500 dark:bg-[#070b14]">
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute -right-56 -top-56 h-[620px] w-[620px] rounded-full bg-blue-500/[0.10] blur-[110px] dark:bg-blue-500/[0.08]" />

          <div className="absolute -bottom-64 -left-56 h-[600px] w-[600px] rounded-full bg-cyan-400/[0.09] blur-[110px] dark:bg-cyan-400/[0.06]" />

          <div className="absolute right-[8%] top-24 h-[280px] w-[280px] rounded-full border border-blue-200/50 dark:border-blue-400/[0.10]" />

          <div className="absolute right-[11%] top-28 h-[210px] w-[210px] rounded-full border border-cyan-200/40 dark:border-cyan-400/[0.08]" />

          <div className="absolute right-[15%] top-36 h-[130px] w-[130px] rounded-full border border-blue-200/30 dark:border-blue-400/[0.06]" />

          <div
            className="absolute inset-0 opacity-[0.32] dark:opacity-[0.14]"
            style={{
              backgroundImage:
                "linear-gradient(to right, rgba(15,23,42,0.025) 1px, transparent 1px), linear-gradient(to bottom, rgba(15,23,42,0.025) 1px, transparent 1px)",
              backgroundSize:
                "44px 44px",
              maskImage:
                "linear-gradient(to bottom, black 0%, transparent 78%)",
              WebkitMaskImage:
                "linear-gradient(to bottom, black 0%, transparent 78%)",
            }}
          />
        </div>

        <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-5 pb-20 pt-12 sm:pt-16 lg:grid-cols-2 lg:gap-16 lg:px-8 lg:pb-28 lg:pt-20">
          <div className="relative z-10">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-blue-200/70 bg-white/70 px-4 py-2 text-xs font-black text-blue-700 shadow-sm backdrop-blur-xl dark:border-blue-400/20 dark:bg-blue-500/[0.08] dark:text-blue-400">
              <Sparkles size={14} />

              {isArabic
                ? "ترفيهك، بطريقة أبسط"
                : "Your entertainment, made simple"}
            </div>

            <h1 className="max-w-2xl text-4xl font-black leading-[1.08] tracking-tight text-slate-950 sm:text-5xl lg:text-6xl xl:text-[68px] dark:text-white">
              {isArabic ? (
                <>
                  كل ما تحب،
                  <span className="mt-2 block bg-gradient-to-l from-blue-700 via-blue-600 to-cyan-500 bg-clip-text text-transparent">
                    بشاشة واحدة.
                  </span>
                </>
              ) : (
                <>
                  Everything you love,
                  <span className="mt-2 block bg-gradient-to-r from-blue-700 via-blue-600 to-cyan-500 bg-clip-text text-transparent">
                    on one screen.
                  </span>
                </>
              )}
            </h1>

            <p className="mt-7 max-w-xl text-base leading-8 text-slate-500 sm:text-lg dark:text-slate-400">
              {isArabic
                ? "مع شاشتنا، تحصل على اشتراكك بطريقة واضحة وسهلة، وتتابع تفاصيل حسابك واشتراكك من مكان واحد."
                : "With Shashtna, getting your subscription is simple and clear, while your account and subscription details stay organized in one place."}
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/plans"
                className="group relative flex items-center justify-center gap-2 overflow-hidden rounded-2xl bg-blue-600 px-7 py-4 text-sm font-black text-white shadow-xl shadow-blue-600/20 transition-all duration-300 hover:-translate-y-1 hover:bg-blue-700 hover:shadow-blue-600/30"
              >
                <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                <span className="relative">
                  {isArabic
                    ? "استكشف الباقات"
                    : "Explore plans"}
                </span>

                <ArrowLeft
                  size={18}
                  className={`relative transition-transform duration-300 ${
                    isArabic
                      ? "group-hover:-translate-x-1.5"
                      : "rotate-180 group-hover:translate-x-1.5"
                  }`}
                />
              </Link>

              <Link
                href="/register"
                className="group flex items-center justify-center gap-2 rounded-2xl border border-slate-200/80 bg-white/70 px-7 py-4 text-sm font-bold text-slate-700 shadow-sm backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-blue-300 hover:bg-blue-50/80 hover:text-blue-700 dark:border-slate-700/80 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:border-blue-500/40 dark:hover:bg-slate-800"
              >
                {isArabic
                  ? "إنشاء حساب"
                  : "Create account"}
              </Link>
            </div>

            <div className="mt-10 flex flex-wrap gap-x-8 gap-y-4">
              <TrustItem
                icon={<ShieldCheck size={17} />}
                text={
                  isArabic
                    ? "إدارة سهلة"
                    : "Easy management"
                }
              />

              <TrustItem
                icon={<Zap size={17} />}
                text={
                  isArabic
                    ? "تفعيل سريع"
                    : "Fast activation"
                }
              />

              <TrustItem
                icon={<Headphones size={17} />}
                text={
                  isArabic
                    ? "دعم فني"
                    : "Technical support"
                }
              />
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-xl lg:max-w-[580px]">
            <div className="absolute inset-8 rounded-[48px] bg-blue-500/[0.18] blur-3xl dark:bg-blue-500/[0.09]" />

            <div className="pointer-events-none absolute -right-10 -top-10 hidden h-40 w-40 rounded-full border border-blue-300/40 sm:block dark:border-blue-400/10" />

            <div className="pointer-events-none absolute -bottom-12 -left-10 hidden h-36 w-36 rounded-full border border-cyan-300/40 sm:block dark:border-cyan-400/10" />

            <div className="euclid-surface relative rounded-[34px] border border-white/80 bg-white/[0.62] p-3 shadow-[0_30px_80px_rgba(15,23,42,0.15)] backdrop-blur-2xl dark:border-white/[0.08] dark:bg-slate-900/[0.50] dark:shadow-[0_30px_80px_rgba(0,0,0,0.38)]">
              <div className="relative overflow-hidden rounded-[27px] border border-white/[0.12] bg-slate-950 shadow-inner">
                <div className="relative aspect-[16/10] overflow-hidden bg-gradient-to-br from-[#07152f] via-[#123d8f] to-[#22c7e8]">
                  <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-cyan-300/20 blur-3xl" />

                  <div className="absolute -bottom-24 -left-10 h-72 w-72 rounded-full bg-blue-400/25 blur-3xl" />

                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_20%,rgba(255,255,255,0.24),transparent_28%),linear-gradient(125deg,transparent_20%,rgba(255,255,255,0.05)_52%,transparent_70%)]" />

                  <div className="absolute right-[-8%] top-[-12%] h-[78%] w-[55%] rounded-full border border-white/10" />

                  <div className="absolute right-[4%] top-[-2%] h-[58%] w-[42%] rounded-full border border-cyan-200/10" />

                  <div className="relative flex h-full flex-col justify-between p-6 sm:p-8">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-white">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/10 backdrop-blur-xl">
                          <Tv2 size={18} />
                        </div>

                        <span className="text-sm font-black">
                          شاشتنا
                        </span>
                      </div>

                      <div className="rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-[10px] font-black tracking-wide text-white backdrop-blur-xl">
                        LIVE
                      </div>
                    </div>

                    <div className="relative">
                      <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-[10px] font-bold text-white backdrop-blur-xl">
                        <CirclePlay size={13} />

                        {isArabic
                          ? "ترفيه بدون تعقيد"
                          : "Entertainment made simple"}
                      </div>

                      <h2 className="max-w-sm text-2xl font-black leading-tight text-white sm:text-3xl">
                        {isArabic ? (
                          <>
                            خلي المشاهدة
                            <br />
                            أسهل.
                          </>
                        ) : (
                          <>
                            Make watching
                            <br />
                            easier.
                          </>
                        )}
                      </h2>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-white/[0.05] bg-slate-900 px-5 py-4">
                  <div>
                    <div className="text-xs font-black text-white">
                      {isArabic
                        ? "اشتراكك"
                        : "Your subscription"}
                    </div>

                    <div className="mt-1 text-[10px] text-slate-400">
                      {isArabic
                        ? "إدارة بسيطة من حسابك"
                        : "Simple management from your account"}
                    </div>
                  </div>

                  <div className="rounded-xl border border-emerald-300/10 bg-emerald-400/10 px-3 py-2 text-[10px] font-black text-emerald-300">
                    {isArabic
                      ? "نشط"
                      : "ACTIVE"}
                  </div>
                </div>
              </div>
            </div>

            <div className="euclid-glass absolute -bottom-6 -left-3 rounded-2xl p-4 shadow-2xl sm:-left-8">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/[0.10] dark:text-emerald-400">
                  <Check size={20} />
                </div>

                <div>
                  <div className="text-xs font-black text-slate-900 dark:text-white">
                    {isArabic
                      ? "اشتراكك جاهز"
                      : "Your subscription is ready"}
                  </div>

                  <div className="mt-1 text-[10px] text-slate-400">
                    {isArabic
                      ? "إدارة سهلة وسريعة"
                      : "Easy and fast management"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-slate-50/80 to-transparent dark:from-[#0b1120] dark:to-transparent" />
      </section>

      {/* =====================================================
          FEATURE STRIP
          ===================================================== */}

      <section className="relative border-y border-slate-200/70 bg-slate-50/70 backdrop-blur-xl transition-colors duration-500 dark:border-slate-800/70 dark:bg-slate-900/55">
        <div className="mx-auto grid max-w-7xl gap-px px-5 sm:grid-cols-3 lg:px-8">
          <Feature
            icon={<Tv2 size={21} />}
            title={
              isArabic
                ? "ترفيه متنوع"
                : "Varied entertainment"
            }
            description={
              isArabic
                ? "اختر الباقة التي تناسب استخدامك."
                : "Choose the plan that fits your needs."
            }
          />

          <Feature
            icon={<ShieldCheck size={21} />}
            title={
              isArabic
                ? "إدارة واضحة"
                : "Clear management"
            }
            description={
              isArabic
                ? "تابع اشتراكك وبياناتك من حسابك."
                : "Track your subscription and details from your account."
            }
          />

          <Feature
            icon={<Headphones size={21} />}
            title={
              isArabic
                ? "دعم مستمر"
                : "Ongoing support"
            }
            description={
              isArabic
                ? "نساعدك عند الحاجة بخطوات واضحة."
                : "We help you whenever you need it with clear guidance."
            }
          />
        </div>
      </section>

      {/* =====================================================
          POPULAR PLANS
          ===================================================== */}

      <section className="relative overflow-hidden bg-white transition-colors duration-500 dark:bg-[#070b14]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-[-200px] top-32 h-[420px] w-[420px] rounded-full bg-cyan-400/[0.045] blur-3xl dark:bg-cyan-400/[0.035]" />

          <div className="absolute right-[-180px] top-24 h-[430px] w-[430px] rounded-full bg-blue-500/[0.05] blur-3xl dark:bg-blue-500/[0.04]" />
        </div>

        <div className="relative mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-28">
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex rounded-full border border-blue-200/70 bg-blue-50/70 px-3 py-1.5 text-[10px] font-black tracking-[0.2em] text-blue-600 dark:border-blue-400/10 dark:bg-blue-500/[0.06] dark:text-blue-400">
              {isArabic
                ? "الأكثر مبيعًا"
                : "BEST SELLERS"}
            </span>

            <h2 className="mt-5 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl dark:text-white">
              {isArabic
                ? "الباقات الأكثر طلبًا"
                : "Our most popular plans"}
            </h2>

            <p className="mt-4 text-sm leading-7 text-slate-500 sm:text-base dark:text-slate-400">
              {isArabic
                ? "هذي أكثر الباقات مبيعًا حسب الاشتراكات المسجلة عندنا."
                : "These are our best-selling plans based on recorded subscriptions."}
            </p>
          </div>

          {packagesLoading ? (
            <div className="mt-14 grid gap-5 lg:grid-cols-3">
              {[1, 2, 3].map(
                (item) => (
                  <div
                    key={item}
                    className="h-[430px] animate-pulse rounded-[28px] border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
                  />
                )
              )}
            </div>
          ) : popularPackages.length === 0 ? (
            <div className="mx-auto mt-14 max-w-2xl rounded-[28px] border border-slate-200 bg-slate-50 p-10 text-center dark:border-slate-800 dark:bg-slate-900">
              <Tv2
                size={32}
                className="mx-auto text-slate-400"
              />

              <h3 className="mt-4 text-lg font-black text-slate-900 dark:text-white">
                {isArabic
                  ? "ماكو باقات مبيعاتها متاحة حاليًا"
                  : "No popular plans available yet"}
              </h3>

              <p className="mt-2 text-sm leading-7 text-slate-500 dark:text-slate-400">
                {isArabic
                  ? "تكدر تشوف جميع الباقات المنشورة من صفحة الباقات."
                  : "You can view all published plans from the plans page."}
              </p>

              <Link
                href="/plans"
                className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-6 py-3.5 text-sm font-black text-white transition hover:bg-blue-700"
              >
                {isArabic
                  ? "عرض كل الباقات"
                  : "View all plans"}

                <ArrowLeft
                  size={17}
                  className={
                    isArabic
                      ? ""
                      : "rotate-180"
                  }
                />
              </Link>
            </div>
          ) : (
            <div className="mt-14 grid gap-5 lg:grid-cols-3">
              {popularPackages.map(
                (plan, index) => {
                  const isFeatured =
                    index === 0;

                  return (
                    <div
                      key={plan.id}
                      className={`euclid-surface group relative overflow-hidden rounded-[28px] border p-7 ${
                        isFeatured
                          ? "border-blue-400/70 bg-gradient-to-b from-blue-50/90 via-white to-white shadow-[0_20px_60px_rgba(37,99,235,0.12)] dark:border-blue-500/50 dark:from-blue-950/50 dark:via-slate-900 dark:to-slate-900 dark:shadow-[0_20px_60px_rgba(30,64,175,0.18)]"
                          : "border-slate-200/80 bg-white/75 shadow-sm backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-900/60"
                      }`}
                    >
                      <div
                        className={`pointer-events-none absolute -right-16 -top-16 h-32 w-32 rounded-full blur-3xl ${
                          isFeatured
                            ? "bg-blue-400/20"
                            : "bg-cyan-400/10"
                        }`}
                      />

                      {isFeatured && (
                        <div className="absolute -top-0 right-6 rounded-b-xl bg-blue-600 px-4 py-2 text-[10px] font-black text-white shadow-lg shadow-blue-600/20">
                          {isArabic
                            ? "الأكثر مبيعًا"
                            : "BEST SELLER"}
                        </div>
                      )}

                      <div className="relative flex items-start justify-between">
                        <div>
                          <h3 className="text-lg font-black text-slate-950 dark:text-white">
                            {plan.name}
                          </h3>

                          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                            {plan.durationLabel}
                          </p>
                        </div>

                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-100 bg-blue-50/80 text-blue-600 shadow-sm dark:border-blue-500/10 dark:bg-blue-500/[0.09] dark:text-blue-400">
                          <Tv2 size={21} />
                        </div>
                      </div>

                      <div className="relative mt-8">
                        <span className="text-3xl font-black text-slate-950 dark:text-white">
                          {formatPrice(
                            plan.price
                          )}
                        </span>

                        <span
                          className={`${
                            isArabic
                              ? "mr-2"
                              : "ml-2"
                          } text-xs font-bold text-slate-400`}
                        >
                          IQD
                        </span>
                      </div>

                      <p className="relative mt-3 line-clamp-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                        {plan.description}
                      </p>

                      <div className="my-6 h-px bg-slate-100 dark:bg-slate-800" />

                      <div className="relative space-y-3">
                        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-500/[0.10] dark:text-blue-400">
                            <Check size={13} />
                          </div>

                          {isArabic
                            ? `مدة الاشتراك: ${plan.durationLabel}`
                            : `Duration: ${plan.durationLabel}`}
                        </div>

                        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-500/[0.10] dark:text-blue-400">
                            <Zap size={13} />
                          </div>

                          {isArabic
                            ? "تفعيل بعد إتمام الطلب"
                            : "Activation after placing your request"}
                        </div>

                        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-500/[0.10] dark:text-blue-400">
                            <ShieldCheck size={13} />
                          </div>

                          {isArabic
                            ? "دعم ومتابعة من حسابك"
                            : "Support and account tracking"}
                        </div>
                      </div>

                      <Link
                        href={`/plans`}
                        className={`relative mt-8 flex items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-sm font-black transition-all duration-300 hover:-translate-y-0.5 ${
                          isFeatured
                            ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700 hover:shadow-blue-600/30"
                            : "border border-slate-200 bg-white/80 text-slate-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:border-blue-500/40 dark:hover:bg-slate-800 dark:hover:text-blue-400"
                        }`}
                      >
                        {isArabic
                          ? "عرض الباقة"
                          : "View plan"}

                        <ChevronLeft
                          size={16}
                          className={`transition-transform duration-300 ${
                            isArabic
                              ? "group-hover:-translate-x-0.5"
                              : "rotate-180 group-hover:translate-x-0.5"
                          }`}
                        />
                      </Link>
                    </div>
                  );
                }
              )}
            </div>
          )}

          {popularPackages.length > 0 && (
            <div className="mt-8 text-center">
              <Link
                href="/plans"
                className="group inline-flex items-center gap-2 text-sm font-black text-blue-600 transition hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                {isArabic
                  ? "شوف كل الباقات"
                  : "View all plans"}

                <ArrowLeft
                  size={16}
                  className={`transition-transform duration-300 ${
                    isArabic
                      ? "group-hover:-translate-x-1"
                      : "rotate-180 group-hover:translate-x-1"
                  }`}
                />
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* =====================================================
          WHY US
          ===================================================== */}

      <section className="relative isolate overflow-hidden bg-slate-950">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute right-[-12%] top-[-35%] h-[700px] w-[700px] rounded-full bg-blue-600/[0.10] blur-3xl" />

          <div className="absolute left-[-10%] bottom-[-30%] h-[580px] w-[580px] rounded-full bg-cyan-400/[0.08] blur-3xl" />

          <div
            className="absolute inset-0 opacity-[0.18]"
            style={{
              backgroundImage:
                "linear-gradient(to right, rgba(148,163,184,0.035) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.035) 1px, transparent 1px)",
              backgroundSize:
                "44px 44px",
            }}
          />

          <div className="absolute right-[7%] top-20 h-72 w-72 rounded-full border border-blue-400/[0.08]" />

          <div className="absolute right-[10%] top-24 h-56 w-56 rounded-full border border-cyan-400/[0.06]" />
        </div>

        <div className="relative mx-auto grid max-w-7xl gap-12 px-5 py-20 lg:grid-cols-2 lg:items-center lg:px-8 lg:py-24">
          <div>
            <span className="inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/[0.05] px-3 py-1.5 text-[10px] font-black tracking-[0.2em] text-cyan-400">
              {isArabic
                ? "ليش شاشتنا"
                : "WHY SHASHTNA"}
            </span>

            <h2 className="mt-5 text-3xl font-black leading-tight text-white sm:text-4xl">
              {isArabic ? (
                <>
                  مو مجرد اشتراك،
                  <span className="block bg-gradient-to-r from-cyan-300 to-blue-400 bg-clip-text text-transparent">
                    تجربة أبسط.
                  </span>
                </>
              ) : (
                <>
                  More than a subscription,
                  <span className="block bg-gradient-to-r from-cyan-300 to-blue-400 bg-clip-text text-transparent">
                    a simpler experience.
                  </span>
                </>
              )}
            </h2>

            <p className="mt-5 max-w-xl text-sm leading-8 text-slate-400 sm:text-base">
              {isArabic
                ? "صممنا شاشتنا حتى تكون كل خطوة واضحة: من اختيار الباقة إلى إدارة الاشتراك ومتابعة التفاصيل من حسابك."
                : "Shashtna is designed to keep every step clear, from choosing a plan to managing your subscription and tracking its details from your account."}
            </p>

            <Link
              href="/plans"
              className="group mt-8 inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white px-6 py-3.5 text-sm font-black text-slate-900 shadow-xl transition-all duration-300 hover:-translate-y-1 hover:bg-blue-50"
            >
              {isArabic
                ? "شوف الباقات"
                : "View plans"}

              <ArrowLeft
                size={17}
                className={`transition-transform duration-300 ${
                  isArabic
                    ? "group-hover:-translate-x-1"
                    : "rotate-180 group-hover:translate-x-1"
                }`}
              />
            </Link>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <DarkFeature
              icon={<Sparkles size={21} />}
              title={
                isArabic
                  ? "واجهة بسيطة"
                  : "Simple interface"
              }
              description={
                isArabic
                  ? "بدون قوائم معقدة أو خطوات غير واضحة."
                  : "No complicated menus or unclear steps."
              }
            />

            <DarkFeature
              icon={<ShieldCheck size={21} />}
              title={
                isArabic
                  ? "كل شيء بحسابك"
                  : "Everything in your account"
              }
              description={
                isArabic
                  ? "تابع الاشتراكات والطلبات من مكان واحد."
                  : "Manage subscriptions and orders from one place."
              }
            />

            <DarkFeature
              icon={<Zap size={21} />}
              title={
                isArabic
                  ? "تجربة سريعة"
                  : "Fast experience"
              }
              description={
                isArabic
                  ? "الوصول للمعلومات التي تحتاجها بسهولة."
                  : "Get to the information you need quickly."
              }
            />

            <DarkFeature
              icon={<Headphones size={21} />}
              title={
                isArabic
                  ? "دعم فني"
                  : "Technical support"
              }
              description={
                isArabic
                  ? "فريقنا موجود لمساعدتك عند الحاجة."
                  : "Our team is here whenever you need help."
              }
            />
          </div>
        </div>
      </section>

      {/* =====================================================
          HOW IT WORKS
          ===================================================== */}

      <section className="relative overflow-hidden bg-white transition-colors duration-500 dark:bg-[#070b14]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute right-[-180px] top-1/2 h-[420px] w-[420px] -translate-y-1/2 rounded-full bg-blue-500/[0.04] blur-3xl dark:bg-blue-500/[0.035]" />

          <div className="absolute left-[-170px] top-20 h-[360px] w-[360px] rounded-full bg-cyan-400/[0.04] blur-3xl dark:bg-cyan-400/[0.03]" />
        </div>

        <div className="relative mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-28">
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex rounded-full border border-blue-200/70 bg-blue-50/70 px-3 py-1.5 text-[10px] font-black tracking-[0.2em] text-blue-600 dark:border-blue-400/10 dark:bg-blue-500/[0.06] dark:text-blue-400">
              {isArabic
                ? "شلون تشتغل"
                : "HOW IT WORKS"}
            </span>

            <h2 className="mt-5 text-3xl font-black text-slate-950 sm:text-4xl dark:text-white">
              {isArabic
                ? "اشترك بثلاث خطوات"
                : "Subscribe in three steps"}
            </h2>

            <p className="mt-4 text-sm leading-7 text-slate-500 sm:text-base dark:text-slate-400">
              {isArabic
                ? "خلّينا نخلي العملية أبسط ما يمكن."
                : "We keep the process as simple as possible."}
            </p>
          </div>

          <div className="relative mt-16 grid gap-10 md:grid-cols-3 md:gap-8">
            <div className="pointer-events-none absolute right-[16%] left-[16%] top-10 hidden h-px bg-gradient-to-l from-blue-200 via-cyan-200 to-blue-200 dark:from-blue-900/70 dark:via-cyan-900/70 dark:to-blue-900/70 md:block" />

            {steps.map(
              (step) => (
                <div
                  key={step.number}
                  className="group relative text-center"
                >
                  <div className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-full border-[7px] border-white bg-gradient-to-br from-blue-600 to-cyan-500 text-lg font-black text-white shadow-xl shadow-blue-600/20 transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-blue-600/30 dark:border-[#070b14]">
                    {step.number}
                  </div>

                  <h3 className="mt-7 text-lg font-black text-slate-950 dark:text-white">
                    {isArabic
                      ? step.titleAr
                      : step.titleEn}
                  </h3>

                  <p className="mx-auto mt-3 max-w-xs text-sm leading-7 text-slate-500 dark:text-slate-400">
                    {isArabic
                      ? step.descriptionAr
                      : step.descriptionEn}
                  </p>
                </div>
              )
            )}
          </div>
        </div>
      </section>

      {/* =====================================================
          CTA
          ===================================================== */}

      <section className="relative overflow-hidden bg-white px-5 pb-20 transition-colors duration-500 dark:bg-[#070b14] lg:px-8 lg:pb-28">
        <div className="euclid-surface relative mx-auto max-w-7xl overflow-hidden rounded-[34px] border border-blue-400/20 bg-gradient-to-l from-blue-700 via-blue-600 to-cyan-500 px-7 py-12 text-center shadow-[0_25px_70px_rgba(37,99,235,0.20)] sm:px-12 lg:py-16">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full border border-white/10" />

          <div className="pointer-events-none absolute -right-12 top-16 h-44 w-44 rounded-full border border-white/[0.06]" />

          <div className="pointer-events-none absolute -bottom-28 -left-20 h-72 w-72 rounded-full border border-white/10" />

          <div className="pointer-events-none absolute left-[8%] top-[18%] h-4 w-4 rounded-full bg-white/20 blur-[1px]" />

          <div className="pointer-events-none absolute right-[14%] bottom-[18%] h-3 w-3 rounded-full bg-white/20 blur-[1px]" />

          <div className="relative">
            <h2 className="text-3xl font-black text-white sm:text-4xl">
              {isArabic
                ? "جاهز تبدأ؟"
                : "Ready to get started?"}
            </h2>

            <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-blue-100 sm:text-base">
              {isArabic
                ? "اختار الباقة المناسبة إلك وخلّينا نخلي تجربة الاشتراك أسهل."
                : "Choose the plan that suits you and let us make your subscription experience easier."}
            </p>

            <Link
              href="/plans"
              className="group mt-8 inline-flex items-center gap-2 rounded-2xl bg-white px-7 py-4 text-sm font-black text-blue-700 shadow-xl transition-all duration-300 hover:-translate-y-1 hover:bg-blue-50"
            >
              {isArabic
                ? "استعرض الباقات"
                : "Browse plans"}

              <ArrowLeft
                size={18}
                className={`transition-transform duration-300 ${
                  isArabic
                    ? "group-hover:-translate-x-1"
                    : "rotate-180 group-hover:translate-x-1"
                }`}
              />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

/* =========================================================
   SMALL COMPONENTS
   ========================================================= */

function TrustItem({
  icon,
  text,
}: {
  icon: React.ReactNode;
  text: string;
}) {
  return (
    <div className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400">
      <span className="text-blue-600 dark:text-blue-400">
        {icon}
      </span>

      <span>{text}</span>
    </div>
  );
}

function Feature({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="group flex items-center gap-4 px-5 py-7 sm:justify-center sm:px-8">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-slate-200/80 bg-white text-blue-600 shadow-sm transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-md dark:border-slate-700/80 dark:bg-slate-800 dark:text-blue-400">
        {icon}
      </div>

      <div>
        <h3 className="text-sm font-black text-slate-900 dark:text-white">
          {title}
        </h3>

        <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
          {description}
        </p>
      </div>
    </div>
  );
}

function DarkFeature({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.04] p-6 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-white/[0.14] hover:bg-white/[0.06]">
      <div className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full bg-blue-500/[0.08] blur-2xl transition-opacity duration-300 group-hover:bg-cyan-400/[0.10]" />

      <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-blue-400/10 bg-blue-500/[0.12] text-cyan-400">
        {icon}
      </div>

      <h3 className="relative mt-5 text-base font-black text-white">
        {title}
      </h3>

      <p className="relative mt-2 text-xs leading-6 text-slate-400">
        {description}
      </p>
    </div>
  );
}