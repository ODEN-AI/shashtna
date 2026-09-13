"use client";

import {
  Check,
  ChevronLeft,
  CircleAlert,
  Loader2,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Tv,
  Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useLanguage } from "../components/LanguageProvider";

type PackageData = {
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
};

function formatPrice(price: number) {
  return new Intl.NumberFormat("ar-IQ").format(price);
}

export default function PlansPage() {
  const { language } = useLanguage();
  const router = useRouter();

  const isArabic = language === "ar";

  const [packages, setPackages] = useState<PackageData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void loadPackages();
  }, []);

  async function loadPackages() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/packages", {
        method: "GET",
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
            (isArabic
              ? "تعذر تحميل الباقات."
              : "Unable to load plans.")
        );
      }

      const activePackages: PackageData[] = Array.isArray(
        data.packages
      )
        ? data.packages.filter(
            (pkg: PackageData) => pkg.isActive === true
          )
        : [];

      setPackages(activePackages);
    } catch (error) {
      console.error("Plans page error:", error);

      setError(
        error instanceof Error
          ? error.message
          : isArabic
            ? "حدث خطأ أثناء تحميل الباقات."
            : "Something went wrong while loading plans."
      );
    } finally {
      setLoading(false);
    }
  }

  function choosePlan(slug: string) {
    let isLoggedIn = false;

    try {
      isLoggedIn = Boolean(localStorage.getItem("user"));
    } catch {
      isLoggedIn = false;
    }

    const target = isLoggedIn
      ? `/contact?plan=${encodeURIComponent(slug)}`
      : `/register?plan=${encodeURIComponent(slug)}`;

    router.push(target);
  }

  return (
    <main
      dir={isArabic ? "rtl" : "ltr"}
      className="min-h-screen"
    >
      {/* =====================================================
          HERO
          ===================================================== */}
      <section className="mx-auto max-w-7xl px-5 pb-16 pt-14 lg:px-8 lg:pt-20">
        <div className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="absolute -left-28 -top-28 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl" />

          <div className="absolute -bottom-32 -right-24 h-80 w-80 rounded-full bg-cyan-400/10 blur-3xl" />

          <div className="relative px-6 py-12 text-center sm:px-10 lg:px-16 lg:py-16">
            <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-xs font-black text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300">
              <Sparkles size={14} />

              {isArabic
                ? "باقات شاشتنا"
                : "Shashtna Plans"}
            </div>

            <h1 className="mx-auto max-w-4xl text-4xl font-black tracking-tight text-slate-900 dark:text-white sm:text-5xl lg:text-6xl">
              {isArabic
                ? "اختر الاشتراك المناسب إلك"
                : "Choose the subscription that fits you"}
            </h1>

            <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-slate-500 dark:text-slate-400 sm:text-lg">
              {isArabic
                ? "كل الباقات المعروضة هنا هي الباقات المنشورة من لوحة شاشتنا وتكدر تتابع اشتراكك من حسابك."
                : "Only plans published from the Shashtna admin panel are displayed here, and you can track your subscription from your account."}
            </p>
          </div>
        </div>
      </section>

      {/* =====================================================
          PACKAGES
          ===================================================== */}
      <section className="mx-auto max-w-7xl px-5 pb-20 lg:px-8">
        {loading ? (
          <div className="flex min-h-80 items-center justify-center">
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-6 py-4 text-sm font-bold text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
              <Loader2
                size={20}
                className="animate-spin text-blue-600"
              />

              {isArabic
                ? "جاري تحميل الباقات..."
                : "Loading plans..."}
            </div>
          </div>
        ) : error ? (
          <div className="mx-auto flex max-w-xl items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
            <CircleAlert size={19} />

            {error}
          </div>
        ) : packages.length === 0 ? (
          <div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <Tv
              size={32}
              className="mx-auto text-slate-400"
            />

            <h2 className="mt-4 text-xl font-black">
              {isArabic
                ? "لا توجد باقات منشورة حالياً"
                : "No published plans available"}
            </h2>

            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {isArabic
                ? "راح تظهر الباقات هنا بعد تفعيلها ونشرها من لوحة الإدارة."
                : "Plans will appear here once they are activated and published from the admin panel."}
            </p>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            {packages.map((pkg) => {
              const featured = false;

              return (
                <article
                  key={pkg.id}
                  className={`group relative overflow-hidden rounded-[2rem] border bg-white shadow-sm transition-all duration-500 hover:-translate-y-1 hover:shadow-2xl dark:bg-slate-900 ${
                    featured
                      ? "border-blue-500/50 shadow-blue-500/10"
                      : "border-slate-200 dark:border-slate-800"
                  }`}
                >
                  {featured && (
                    <div className="absolute left-0 right-0 top-0 z-30 h-1 bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-500" />
                  )}

                  {featured && (
                    <div className="absolute right-5 top-5 z-40 inline-flex items-center gap-2 rounded-full border border-white/20 bg-blue-600/90 px-3 py-1.5 text-[11px] font-black text-white shadow-lg shadow-blue-900/20 backdrop-blur-xl">
                      <Sparkles size={13} />

                      {isArabic
                        ? "الأكثر طلباً"
                        : "Most popular"}
                    </div>
                  )}

                  {/* =================================================
                      PACKAGE IMAGE
                      ================================================= */}
                  <div className="relative h-72 overflow-hidden bg-slate-100 dark:bg-slate-800">
                    {pkg.imageUrl ? (
                      <img
                        src={pkg.imageUrl}
                        alt={pkg.name}
                        className="absolute inset-0 h-full w-full object-cover transition duration-700 ease-out group-hover:scale-105"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-100 via-white to-blue-50 dark:from-slate-900 dark:via-slate-800 dark:to-blue-950/40">
                        <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-slate-200 bg-white/80 text-slate-300 shadow-sm backdrop-blur-xl dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-600">
                          <Tv size={38} />
                        </div>
                      </div>
                    )}

                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/10 to-transparent" />

                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-blue-500/10 to-transparent" />

                    <div className="absolute inset-x-4 bottom-4 z-20">
                      <div className="overflow-hidden rounded-[22px] border border-white/15 bg-slate-950/35 shadow-[0_15px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl">
                        <div className="relative px-4 py-4 sm:px-5 sm:py-5">
                          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.10] via-transparent to-transparent" />

                          <div className="relative">
                            <div className="mb-2 flex items-center gap-2">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/10 text-white backdrop-blur-md">
                                <Tv size={14} />
                              </div>

                              <h2 className="text-lg font-black text-white">
                                {pkg.name}
                              </h2>
                            </div>

                            <p className="line-clamp-2 text-sm leading-6 text-white/75">
                              {pkg.description ||
                                (isArabic
                                  ? "اشتراك مميز مع تفعيل ودعم فني."
                                  : "Premium subscription with activation and technical support.")}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* =================================================
                      PACKAGE DETAILS
                      ================================================= */}
                  <div className="relative p-7">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div
                          className={`mb-2 text-xs font-black uppercase tracking-[0.14em] ${
                            featured
                              ? "text-blue-600 dark:text-blue-400"
                              : "text-slate-400"
                          }`}
                        >
                          {pkg.durationLabel}
                        </div>

                        <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                          {pkg.name}
                        </h3>
                      </div>

                      <div className="shrink-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left dark:border-slate-700 dark:bg-slate-800/70">
                        <div className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">
                          {isArabic
                            ? "المدة"
                            : "DURATION"}
                        </div>

                        <div className="mt-0.5 text-xs font-black text-slate-700 dark:text-slate-200">
                          {pkg.durationMonths}{" "}
                          {isArabic
                            ? "شهر"
                            : "months"}
                        </div>
                      </div>
                    </div>

                    {/* Price */}
                    <div className="my-7 rounded-2xl bg-slate-50 p-5 dark:bg-slate-800/70">
                      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                        {isArabic ? "السعر" : "PRICE"}
                      </div>

                      <div className="mt-1 flex items-end gap-2">
                        <span className="text-4xl font-black tracking-tight text-slate-900 dark:text-white">
                          {formatPrice(pkg.price)}
                        </span>

                        <span className="pb-1 text-sm font-bold text-slate-400">
                          IQD
                        </span>
                      </div>

                      <div className="mt-2 text-sm font-bold text-blue-600 dark:text-blue-400">
                        {pkg.durationLabel}
                      </div>
                    </div>

                    {/* Features */}
                    <div className="space-y-3">
                      <FeatureRow
                        icon={<Check size={15} />}
                        text={
                          isArabic
                            ? `مدة الاشتراك: ${pkg.durationLabel}`
                            : `Duration: ${pkg.durationLabel}`
                        }
                      />

                      <FeatureRow
                        icon={<Zap size={15} />}
                        text={
                          isArabic
                            ? "تفعيل بعد إتمام الطلب"
                            : "Activation after placing your request"
                        }
                      />

                      <FeatureRow
                        icon={<ShieldCheck size={15} />}
                        text={
                          isArabic
                            ? "دعم ومتابعة من حسابك"
                            : "Support and account tracking"
                        }
                      />

                      <FeatureRow
                        icon={<MessageCircle size={15} />}
                        text={
                          isArabic
                            ? "التواصل عبر Telegram أو Facebook"
                            : "Contact via Telegram or Facebook"
                        }
                      />
                    </div>

                    {/* Choose button */}
                    <button
                      type="button"
                      onClick={() => choosePlan(pkg.slug)}
                      className={`mt-8 flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-4 text-sm font-black transition-all duration-300 hover:-translate-y-0.5 ${
                        featured
                          ? "bg-gradient-to-r from-blue-700 to-cyan-500 text-white shadow-lg shadow-blue-600/20 hover:shadow-xl hover:shadow-blue-600/30"
                          : "border border-slate-200 bg-slate-950 text-white shadow-sm hover:border-blue-500 hover:bg-blue-700 dark:border-slate-700"
                      }`}
                    >
                      {isArabic
                        ? "اختيار الاشتراك"
                        : "Choose plan"}

                      <ChevronLeft
                        size={18}
                        className={`transition-transform duration-300 ${
                          isArabic
                            ? "group-hover:-translate-x-1"
                            : "rotate-180 group-hover:translate-x-1"
                        }`}
                      />
                    </button>

                    {pkg.notes && (
                      <p className="mt-4 text-center text-xs leading-6 text-slate-400">
                        {pkg.notes}
                      </p>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* =====================================================
            INFO CARDS
            ===================================================== */}
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <InfoCard
            icon={<Zap size={20} />}
            title={
              isArabic
                ? "تفعيل سريع"
                : "Fast activation"
            }
            text={
              isArabic
                ? "بعد إرسال الطلب والتواصل، يتم تجهيز اشتراكك."
                : "After contacting us, your subscription is prepared."
            }
          />

          <InfoCard
            icon={<ShieldCheck size={20} />}
            title={
              isArabic
                ? "متابعة سهلة"
                : "Easy tracking"
            }
            text={
              isArabic
                ? "تابع معلومات اشتراكك من حسابك بكل سهولة."
                : "Track your subscription details easily from your account."
            }
          />

          <InfoCard
            icon={<MessageCircle size={20} />}
            title={
              isArabic
                ? "تواصل مباشر"
                : "Direct contact"
            }
            text={
              isArabic
                ? "اختر طريقة التواصل المناسبة إلك عند الطلب."
                : "Choose your preferred contact method when requesting."
            }
          />
        </div>
      </section>
    </main>
  );
}

function FeatureRow({
  icon,
  text,
}: {
  icon: React.ReactNode;
  text: string;
}) {
  return (
    <div className="flex items-center gap-3 text-sm font-semibold text-slate-600 dark:text-slate-300">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
        {icon}
      </div>

      <span>{text}</span>
    </div>
  );
}

function InfoCard({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
        {icon}
      </div>

      <h3 className="mt-4 text-base font-black">
        {title}
      </h3>

      <p className="mt-2 text-sm leading-7 text-slate-500 dark:text-slate-400">
        {text}
      </p>
    </div>
  );
}