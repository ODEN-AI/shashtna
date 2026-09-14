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
  serviceType: string;
  price: number;
  durationMonths: number;
  durationLabel: string;
  description: string;
  specifications: string;
  notes: string | null;
  imageUrl: string | null;
  isActive: boolean;
};

type CurrentUser = {
  id: number;
  name?: string;
  phone?: string;
  role?: string;
};

function formatPrice(price: number) {
  return new Intl.NumberFormat("en-US").format(price);
}

export default function PlansPage() {
  const { language } = useLanguage();
  const router = useRouter();

  const isArabic = language === "ar";

  const [packages, setPackages] =
    useState<PackageData[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    void loadPackages();
  }, []);

  async function loadPackages() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        "/api/packages",
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.message ||
            (isArabic
              ? "تعذر تحميل الباقات."
              : "Unable to load plans.")
        );
      }

      const activePackages:
        PackageData[] =
        Array.isArray(data.packages)
          ? data.packages.filter(
              (pkg: PackageData) =>
                pkg.isActive === true
            )
          : [];

      setPackages(activePackages);
    } catch (error) {
      console.error(
        "Plans page error:",
        error
      );

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

  function getCurrentUser():
    CurrentUser | null {
    try {
      const savedUser =
        window.localStorage.getItem(
          "user"
        );

      if (!savedUser) {
        return null;
      }

      const parsedUser: unknown =
        JSON.parse(savedUser);

      if (
        !parsedUser ||
        typeof parsedUser !==
          "object" ||
        !("id" in parsedUser)
      ) {
        return null;
      }

      const userId =
        (
          parsedUser as {
            id?: unknown;
          }
        ).id;

      if (
        typeof userId !==
          "number" ||
        !Number.isFinite(userId) ||
        userId <= 0
      ) {
        return null;
      }

      return parsedUser as CurrentUser;
    } catch {
      return null;
    }
  }

  function choosePlan(
    slug: string
  ) {
    const encodedSlug =
      encodeURIComponent(slug);

    const currentUser =
      getCurrentUser();

    if (
      currentUser !== null
    ) {
      router.push(
        "/contact?plan=" +
          encodedSlug
      );

      return;
    }

    router.push(
      "/register?plan=" +
        encodedSlug
    );
  }

  const iptvPackages =
    packages.filter(
      (pkg) =>
        pkg.serviceType.toUpperCase() !==
        "VIP"
    );

  const vipPackages =
    packages.filter(
      (pkg) =>
        pkg.serviceType.toUpperCase() ===
        "VIP"
    );

  return (
    <main
      dir={
        isArabic
          ? "rtl"
          : "ltr"
      }
      className="min-h-screen"
    >
      <section className="mx-auto max-w-7xl px-5 pb-14 pt-14 lg:px-8 lg:pt-20">
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
                ? "اختار الاشتراك المناسب إلك"
                : "Choose the subscription that fits you"}
            </h1>

            <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-slate-500 dark:text-slate-400 sm:text-lg">
              {isArabic
                ? "اختار من باقات IPTV العادية أو باقات VIP المصممة لتجربة مشاهدة مختلفة."
                : "Choose from our regular IPTV plans or our VIP experience."}
            </p>
          </div>
        </div>
      </section>

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
        ) : packages.length ===
          0 ? (
          <div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <Tv
              size={32}
              className="mx-auto text-slate-400"
            />

            <h2 className="mt-4 text-xl font-black text-slate-900 dark:text-white">
              {isArabic
                ? "لا توجد باقات منشورة حاليًا"
                : "No published plans available"}
            </h2>

            <p className="mt-2 text-sm leading-7 text-slate-500 dark:text-slate-400">
              {isArabic
                ? "راح تظهر الباقات هنا بعد تفعيلها ونشرها من لوحة الإدارة."
                : "Plans will appear here once they are activated and published from the admin panel."}
            </p>
          </div>
        ) : (
          <div className="space-y-16">
            {iptvPackages.length >
              0 && (
              <section>
                <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300">
                      <Tv size={14} />

                      {isArabic
                        ? "الخدمة الأساسية"
                        : "Main service"}
                    </div>

                    <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white sm:text-4xl">
                      {isArabic
                        ? "باقات IPTV"
                        : "IPTV Plans"}
                    </h2>

                    <p className="mt-3 max-w-2xl text-sm leading-8 text-slate-500 dark:text-slate-400 sm:text-base">
                      {isArabic
                        ? "خدمة لمشاهدة القنوات الرياضية والترفيهية والأفلام والمسلسلات عبر الإنترنت، وتكدر تستخدمها على الجهاز أو التطبيق المناسب إلك."
                        : "A service for watching sports and entertainment channels, movies, and series over the internet, using the device or app that suits you."}
                    </p>
                  </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-3">
                  {iptvPackages.map(
                    (pkg) => (
                      <PlanCard
                        key={pkg.id}
                        pkg={pkg}
                        isArabic={
                          isArabic
                        }
                        isVip={false}
                        onChoose={
                          choosePlan
                        }
                      />
                    )
                  )}
                </div>
              </section>
            )}

            {vipPackages.length >
              0 && (
              <section>
                <div className="mb-8 overflow-hidden rounded-[2rem] border border-blue-200 bg-gradient-to-br from-blue-50 via-white to-cyan-50 p-6 shadow-sm dark:border-blue-500/20 dark:from-blue-950/20 dark:via-slate-900 dark:to-cyan-950/20 sm:p-8">
                  <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white px-3 py-1.5 text-xs font-black text-blue-700 shadow-sm dark:border-blue-500/20 dark:bg-slate-900 dark:text-blue-300">
                        <Sparkles
                          size={14}
                        />

                        {isArabic
                          ? "تجربة مميزة"
                          : "Premium experience"}
                      </div>

                      <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white sm:text-4xl">
                        {isArabic
                          ? "باقات VIP"
                          : "VIP Plans"}
                      </h2>

                      <p className="mt-3 max-w-2xl text-sm leading-8 text-slate-600 dark:text-slate-300 sm:text-base">
                        {isArabic
                          ? "اشتراك مميز يوفرلك تجربة مشاهدة مميزة وسلسة، ويجمع بين جودة الخدمة والأجهزة المخصصة للـVIP."
                          : "A premium subscription designed to provide a smooth and distinctive viewing experience, combining service quality with dedicated VIP devices."}
                      </p>
                    </div>

                    <div className="shrink-0 rounded-3xl border border-blue-200 bg-white/80 px-5 py-4 shadow-sm backdrop-blur-xl dark:border-blue-500/20 dark:bg-slate-900/70">
                      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-500">
                        VIP
                      </div>

                      <div className="mt-1 text-sm font-black text-slate-800 dark:text-white">
                        {isArabic
                          ? "تجربة مشاهدة مميزة"
                          : "A premium viewing experience"}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-3">
                  {vipPackages.map(
                    (pkg) => (
                      <PlanCard
                        key={pkg.id}
                        pkg={pkg}
                        isArabic={
                          isArabic
                        }
                        isVip
                        onChoose={
                          choosePlan
                        }
                      />
                    )
                  )}
                </div>
              </section>
            )}
          </div>
        )}

        {!loading &&
          !error &&
          packages.length >
            0 && (
            <div className="mt-16 grid gap-4 md:grid-cols-3">
              <InfoCard
                icon={
                  <Zap size={20} />
                }
                title={
                  isArabic
                    ? "تفعيل سريع"
                    : "Fast activation"
                }
                text={
                  isArabic
                    ? "بعد إرسال الطلب والتواصل ويانا، يتم تجهيز اشتراكك وتفعيله."
                    : "After sending your request and contacting us, your subscription is prepared and activated."
                }
              />

              <InfoCard
                icon={
                  <ShieldCheck
                    size={20}
                  />
                }
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
                icon={
                  <MessageCircle
                    size={20}
                  />
                }
                title={
                  isArabic
                    ? "تواصل مباشر"
                    : "Direct contact"
                }
                text={
                  isArabic
                    ? "عند الطلب، تكدر تختار طريقة التواصل المناسبة إلك."
                    : "Choose your preferred contact method when requesting."
                }
              />
            </div>
          )}
      </section>
    </main>
  );
}

function PlanCard({
  pkg,
  isArabic,
  isVip,
  onChoose,
}: {
  pkg: PackageData;
  isArabic: boolean;
  isVip: boolean;
  onChoose: (
    slug: string
  ) => void;
}) {
  const featured = false;

  let cardClassName =
    "group relative overflow-hidden rounded-[2rem] border bg-white shadow-sm transition-all duration-500 hover:-translate-y-1 hover:shadow-2xl dark:bg-slate-900 ";

  if (isVip) {
    cardClassName +=
      "border-blue-200 shadow-blue-500/5 dark:border-blue-500/20";
  } else if (
    featured
  ) {
    cardClassName +=
      "border-blue-500/50 shadow-blue-500/10";
  } else {
    cardClassName +=
      "border-slate-200 dark:border-slate-800";
  }

  let durationClassName =
    "mb-2 text-xs font-black uppercase tracking-[0.14em] ";

  if (isVip) {
    durationClassName +=
      "text-blue-600 dark:text-blue-400";
  } else if (
    featured
  ) {
    durationClassName +=
      "text-blue-600 dark:text-blue-400";
  } else {
    durationClassName +=
      "text-slate-400";
  }

  let imagePlaceholderClassName =
    "absolute inset-0 flex items-center justify-center ";

  if (isVip) {
    imagePlaceholderClassName +=
      "bg-gradient-to-br from-blue-50 via-white to-cyan-100 dark:from-blue-950/30 dark:via-slate-900 dark:to-cyan-950/20";
  } else {
    imagePlaceholderClassName +=
      "bg-gradient-to-br from-slate-100 via-white to-blue-50 dark:from-slate-900 dark:via-slate-800 dark:to-blue-950/40";
  }

  let imageIconContainerClassName =
    "flex h-20 w-20 items-center justify-center rounded-3xl border shadow-sm backdrop-blur-xl ";

  if (isVip) {
    imageIconContainerClassName +=
      "border-blue-200 bg-white/80 text-blue-300 dark:border-blue-500/20 dark:bg-slate-900/70 dark:text-blue-500";
  } else {
    imageIconContainerClassName +=
      "border-slate-200 bg-white/80 text-slate-300 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-600";
  }

  let priceBoxClassName =
    "my-7 rounded-2xl p-5 ";

  if (isVip) {
    priceBoxClassName +=
      "border border-blue-100 bg-gradient-to-br from-blue-50 to-cyan-50 dark:border-blue-500/10 dark:from-blue-950/20 dark:to-cyan-950/20";
  } else {
    priceBoxClassName +=
      "bg-slate-50 dark:bg-slate-800/70";
  }

  let buttonClassName =
    "mt-8 flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-4 text-sm font-black text-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 ";

  if (isVip) {
    buttonClassName +=
      "bg-gradient-to-r from-blue-700 to-cyan-500 shadow-blue-600/20 hover:shadow-xl hover:shadow-blue-600/30";
  } else if (
    featured
  ) {
    buttonClassName +=
      "bg-gradient-to-r from-blue-700 to-cyan-500 shadow-blue-600/20 hover:shadow-xl hover:shadow-blue-600/30";
  } else {
    buttonClassName +=
      "bg-slate-950 hover:bg-blue-700 dark:bg-slate-800 dark:hover:bg-blue-700";
  }

  return (
    <article
      className={
        cardClassName
      }
    >
      {isVip && (
        <div className="absolute left-0 right-0 top-0 z-30 h-1 bg-gradient-to-r from-blue-700 via-cyan-500 to-blue-400" />
      )}

      {featured &&
        !isVip && (
          <div className="absolute left-0 right-0 top-0 z-30 h-1 bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-500" />
        )}

      {isVip && (
        <div className="absolute right-5 top-5 z-40 inline-flex items-center gap-2 rounded-full border border-white/20 bg-blue-700/90 px-3 py-1.5 text-[11px] font-black text-white shadow-lg shadow-blue-900/20 backdrop-blur-xl">
          <Sparkles
            size={13}
          />

          VIP
        </div>
      )}

      <div className="relative h-72 overflow-hidden bg-slate-100 dark:bg-slate-800">
        {pkg.imageUrl ? (
          <img
            src={pkg.imageUrl}
            alt={pkg.name}
            className="absolute inset-0 h-full w-full object-cover transition duration-700 ease-out group-hover:scale-105"
          />
        ) : (
          <div
            className={
              imagePlaceholderClassName
            }
          >
            <div
              className={
                imageIconContainerClassName
              }
            >
              {isVip ? (
                <Sparkles
                  size={38}
                />
              ) : (
                <Tv
                  size={38}
                />
              )}
            </div>
          </div>
        )}

        <div
          className={
            "pointer-events-none absolute inset-x-0 bottom-0 h-28 " +
            (isVip
              ? "bg-gradient-to-t from-blue-950/20 to-transparent"
              : "bg-gradient-to-t from-slate-950/10 to-transparent")
          }
        />
      </div>

      <div className="relative p-7">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div
              className={
                durationClassName
              }
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
                : pkg.durationMonths ===
                    1
                  ? "month"
                  : "months"}
            </div>
          </div>
        </div>

        <div
          className={
            priceBoxClassName
          }
        >
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
            {isArabic
              ? "السعر"
              : "PRICE"}
          </div>

          <div className="mt-1 flex items-end gap-2">
            <span className="text-4xl font-black tracking-tight text-slate-900 dark:text-white">
              {formatPrice(
                pkg.price
              )}
            </span>

            <span className="pb-1 text-sm font-bold text-slate-400">
              IQD
            </span>
          </div>
        </div>

        <div className="mt-7 rounded-2xl border border-slate-200 bg-slate-50/70 p-5 dark:border-slate-700 dark:bg-slate-800/50">
          <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">
            {pkg.description}
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            onChoose(pkg.slug)
          }
          className={
            buttonClassName
          }
        >
          {isVip
            ? isArabic
              ? "استكشف اشتراك VIP"
              : "Explore VIP subscription"
            : isArabic
              ? "اختيار الاشتراك"
              : "Choose plan"}

          <ChevronLeft
            size={18}
            className={
              "transition-transform duration-300 " +
              (isArabic
                ? "group-hover:-translate-x-1"
                : "rotate-180 group-hover:translate-x-1")
            }
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

      <h3 className="mt-4 text-base font-black text-slate-900 dark:text-white">
        {title}
      </h3>

      <p className="mt-2 text-sm leading-7 text-slate-500 dark:text-slate-400">
        {text}
      </p>
    </div>
  );
}