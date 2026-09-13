"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Eye,
  HeartHandshake,
  ShieldCheck,
  Sparkles,
  Target,
  Tv2,
  Users,
  Zap,
} from "lucide-react";

import { useLanguage } from "../components/LanguageProvider";

export default function AboutPage() {
  const { language } = useLanguage();

  const isArabic = language === "ar";

  return (
    <main
      dir={isArabic ? "rtl" : "ltr"}
      className="min-h-screen overflow-hidden bg-white text-slate-900 transition-colors dark:bg-[#070b14] dark:text-white"
    >
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-slate-100 dark:border-slate-800">
        <div className="pointer-events-none absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full bg-blue-100/70 blur-3xl dark:bg-blue-900/20" />

        <div className="pointer-events-none absolute -left-40 top-24 h-[420px] w-[420px] rounded-full bg-cyan-100/60 blur-3xl dark:bg-cyan-900/10" />

        <div className="pointer-events-none absolute right-[8%] top-32 h-32 w-32 rounded-full border border-blue-200/60 dark:border-blue-400/20" />

        <div className="relative mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-28">
          <div className="grid items-center gap-14 lg:grid-cols-2">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-xs font-black text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-400">
                <Sparkles size={15} />

                {isArabic
                  ? "من نحن"
                  : "ABOUT US"}
              </div>

              <h1 className="text-4xl font-black leading-[1.12] tracking-tight text-slate-950 dark:text-white sm:text-5xl lg:text-6xl">
                {isArabic ? (
                  <>
                    أكثر من مجرد
                    <span className="block bg-gradient-to-l from-blue-700 via-blue-600 to-cyan-500 bg-clip-text text-transparent">
                      اشتراك ترفيهي.
                    </span>
                  </>
                ) : (
                  <>
                    More than just
                    <span className="block bg-gradient-to-r from-blue-700 via-blue-600 to-cyan-500 bg-clip-text text-transparent">
                      an entertainment subscription.
                    </span>
                  </>
                )}
              </h1>

              <p className="mt-6 max-w-2xl text-base leading-8 text-slate-500 dark:text-slate-400 sm:text-lg">
                {isArabic
                  ? "شاشتنا هي منصة هدفها تخلي تجربة الاشتراك أوضح وأسهل. نريدك تعرف شنو تشترك، شلون تستخدمه، وين تحصل المساعدة، وتقدر تتابع معلوماتك من مكان واحد."
                  : "Shashtna is built to make the subscription experience clearer and easier. We want you to know what you are getting, how to use it, where to get help, and how to manage your information in one place."}
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/plans"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-7 py-4 text-sm font-black text-white shadow-xl shadow-blue-600/20 transition hover:-translate-y-0.5 hover:bg-blue-700"
                >
                  {isArabic
                    ? "استكشف الباقات"
                    : "Explore plans"}

                  <ArrowLeft
                    size={18}
                    className={
                      isArabic ? "" : "rotate-180"
                    }
                  />
                </Link>

                <Link
                  href="/apps"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-7 py-4 text-sm font-bold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-500/40 dark:hover:bg-slate-800"
                >
                  {isArabic
                    ? "شوف التطبيقات"
                    : "View apps"}
                </Link>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-xl">
              <div className="absolute inset-10 rounded-[40px] bg-blue-500/20 blur-3xl dark:bg-blue-500/10" />

              <div className="relative overflow-hidden rounded-[32px] border border-white/80 bg-gradient-to-br from-slate-950 via-blue-950 to-blue-700 p-3 shadow-2xl shadow-blue-900/20 dark:border-blue-400/20">
                <div className="relative overflow-hidden rounded-[25px] bg-slate-950">
                  <div className="relative aspect-[16/12] overflow-hidden bg-gradient-to-br from-blue-950 via-blue-800 to-cyan-500">
                    <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-cyan-300/20 blur-2xl" />

                    <div className="absolute -bottom-20 -left-10 h-60 w-60 rounded-full bg-blue-400/30 blur-3xl" />

                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_25%,rgba(255,255,255,0.22),transparent_28%)]" />

                    <div className="relative flex h-full flex-col justify-between p-7 sm:p-9">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 text-white">
                          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
                            <Tv2 size={22} />
                          </div>

                          <div>
                            <div className="text-sm font-black">
                              شاشتنا
                            </div>

                            <div className="mt-1 text-[9px] font-bold tracking-[0.18em] text-blue-100">
                              ENTERTAINMENT
                            </div>
                          </div>
                        </div>

                        <div className="rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-black text-white backdrop-blur">
                          {isArabic
                            ? "رؤيتنا"
                            : "OUR VISION"}
                        </div>
                      </div>

                      <div>
                        <div className="mb-3 text-xs font-bold text-blue-100">
                          {isArabic
                            ? "وضوح • سهولة • دعم"
                            : "Clarity • Simplicity • Support"}
                        </div>

                        <h2 className="max-w-sm text-3xl font-black leading-tight text-white sm:text-4xl">
                          {isArabic ? (
                            <>
                              نخلي كل خطوة
                              <br />
                              أوضح.
                            </>
                          ) : (
                            <>
                              Making every step
                              <br />
                              clearer.
                            </>
                          )}
                        </h2>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 border-t border-white/5 bg-slate-900/90">
                    <MiniValue
                      value="01"
                      label={
                        isArabic
                          ? "وضوح"
                          : "Clarity"
                      }
                    />

                    <MiniValue
                      value="02"
                      label={
                        isArabic
                          ? "سهولة"
                          : "Simplicity"
                      }
                    />

                    <MiniValue
                      value="03"
                      label={
                        isArabic
                          ? "دعم"
                          : "Support"
                      }
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* WHO WE ARE */}
      <section className="bg-white transition-colors dark:bg-[#070b14]">
        <div className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-28">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <span className="text-xs font-black tracking-[0.2em] text-blue-600 dark:text-blue-400">
                {isArabic
                  ? "من نحن"
                  : "WHO WE ARE"}
              </span>

              <h2 className="mt-4 text-3xl font-black leading-tight text-slate-950 dark:text-white sm:text-4xl">
                {isArabic
                  ? "شاشتنا مبنية على فكرة بسيطة."
                  : "Shashtna is built around a simple idea."}
              </h2>

              <p className="mt-5 text-sm leading-8 text-slate-500 dark:text-slate-400 sm:text-base">
                {isArabic
                  ? "بدل ما تكون عملية الاشتراك مجرد دفع واستلام بيانات، نريدها تكون تجربة مفهومة من البداية للنهاية."
                  : "Instead of treating a subscription as simply paying and receiving credentials, we want it to be a clear experience from beginning to end."}
              </p>

              <p className="mt-4 text-sm leading-8 text-slate-500 dark:text-slate-400 sm:text-base">
                {isArabic
                  ? "من اختيار الباقة، إلى معرفة التطبيق المناسب، إلى متابعة الاشتراك وطلب المساعدة عند الحاجة — كل شيء يكون مرتب وواضح."
                  : "From choosing a plan and finding the right app to tracking your subscription and getting help when needed, everything should feel organized and clear."}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <VisionCard
                icon={<Eye size={21} />}
                title={
                  isArabic
                    ? "الوضوح أولاً"
                    : "Clarity first"
                }
                description={
                  isArabic
                    ? "نشرح لك ما تحتاج معرفته قبل الاشتراك، بدون كلام مبهم."
                    : "We explain what you need to know before subscribing, without unnecessary ambiguity."
                }
              />

              <VisionCard
                icon={<HeartHandshake size={21} />}
                title={
                  isArabic
                    ? "خدمة باحترام"
                    : "Respectful service"
                }
                description={
                  isArabic
                    ? "نتعامل مع المستخدم كعميل يحتاج خدمة واضحة، مو مجرد رقم."
                    : "We treat users as customers who deserve a clear service, not just as numbers."
                }
              />

              <VisionCard
                icon={<ShieldCheck size={21} />}
                title={
                  isArabic
                    ? "شفافية"
                    : "Transparency"
                }
                description={
                  isArabic
                    ? "ما نعدك بشيء ما نقدر نلتزم به."
                    : "We do not promise what we cannot commit to."
                }
              />

              <VisionCard
                icon={<Zap size={21} />}
                title={
                  isArabic
                    ? "سهولة"
                    : "Simplicity"
                }
                description={
                  isArabic
                    ? "نريد الوصول للمعلومة والخدمة بأقل عدد ممكن من الخطوات."
                    : "We want information and support to be accessible with as few steps as possible."
                }
              />
            </div>
          </div>
        </div>
      </section>

      {/* PROMISE */}
      <section className="bg-slate-50 transition-colors dark:bg-slate-900/50">
        <div className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <span className="text-xs font-black tracking-[0.2em] text-blue-600 dark:text-blue-400">
              {isArabic
                ? "شنو نلتزم بيه"
                : "OUR PROMISE"}
            </span>

            <h2 className="mt-4 text-3xl font-black text-slate-950 dark:text-white sm:text-4xl">
              {isArabic
                ? "الثقة ما تنطلب، تنبني."
                : "Trust is built, not requested."}
            </h2>

            <p className="mt-5 text-sm leading-8 text-slate-500 dark:text-slate-400 sm:text-base">
              {isArabic
                ? "بالنسبة إلنا، الثقة مو مجرد كلمة بالموقع. هي أن تكون المعلومات واضحة، الأسعار مفهومة، والخدمة مرتبة، وإذا صار عندك سؤال تعرف وين تروح."
                : "To us, trust is not just a word on a website. It means clear information, understandable pricing, organized service, and knowing where to go when you need help."}
            </p>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-3">
            <PromiseCard
              icon={<Check size={21} />}
              number="01"
              title={
                isArabic
                  ? "ما نخفي التفاصيل"
                  : "No hidden details"
              }
              description={
                isArabic
                  ? "نوضح أهم المعلومات قبل اتخاذ قرار الاشتراك."
                  : "We make the important information clear before you decide to subscribe."
              }
            />

            <PromiseCard
              icon={<Users size={21} />}
              number="02"
              title={
                isArabic
                  ? "المستخدم بالمقدمة"
                  : "Users come first"
              }
              description={
                isArabic
                  ? "نصمم التجربة حتى تكون سهلة حتى لمن ما عنده خبرة تقنية."
                  : "The experience is designed to stay simple even for users without technical experience."
              }
            />

            <PromiseCard
              icon={<Target size={21} />}
              number="03"
              title={
                isArabic
                  ? "نتطور باستمرار"
                  : "We keep improving"
              }
              description={
                isArabic
                  ? "الموقع والخدمات تتطور بناءً على احتياجات المستخدمين."
                  : "The website and services continue to improve based on user needs."
              }
            />
          </div>
        </div>
      </section>

      {/* HOW WE THINK */}
      <section className="relative overflow-hidden bg-slate-950">
        <div className="absolute right-0 top-0 h-full w-1/2 bg-gradient-to-l from-blue-900/30 to-transparent" />

        <div className="relative mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-28">
          <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
            <div>
              <span className="text-xs font-black tracking-[0.2em] text-cyan-400">
                {isArabic
                  ? "رؤيتنا"
                  : "OUR VISION"}
              </span>

              <h2 className="mt-4 text-3xl font-black leading-tight text-white sm:text-4xl">
                {isArabic ? (
                  <>
                    نخلي الاشتراك
                    <span className="block text-blue-400">
                      تجربة مفهومة.
                    </span>
                  </>
                ) : (
                  <>
                    We make subscriptions
                    <span className="block text-blue-400">
                      easier to understand.
                    </span>
                  </>
                )}
              </h2>

              <p className="mt-5 max-w-xl text-sm leading-8 text-slate-400 sm:text-base">
                {isArabic
                  ? "هدفنا مو بس نبيع اشتراكات. هدفنا نبني خدمة يشعر المستخدم وياها أن كل شيء تحت السيطرة وواضح قدامه."
                  : "Our goal is not simply to sell subscriptions. It is to build a service where users feel that everything is clear and easy to manage."}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <DarkVision
                icon={<Tv2 size={22} />}
                title={
                  isArabic
                    ? "مكان واحد"
                    : "One place"
                }
                description={
                  isArabic
                    ? "اشتراكاتك، أجهزتك، تطبيقاتك ومعلوماتك بمكان واحد."
                    : "Subscriptions, devices, apps, and account information in one place."
                }
              />

              <DarkVision
                icon={<ShieldCheck size={22} />}
                title={
                  isArabic
                    ? "وضوح قبل الشراء"
                    : "Clarity before purchase"
                }
                description={
                  isArabic
                    ? "المستخدم يعرف شنو يحصل قبل ما يختار."
                    : "Users know what they are getting before they choose."
                }
              />

              <DarkVision
                icon={<HeadphonesIcon />}
                title={
                  isArabic
                    ? "مساعدة عند الحاجة"
                    : "Help when needed"
                }
                description={
                  isArabic
                    ? "الدعم يكون قريب وواضح عندما تحتاجه."
                    : "Support stays available and easy to understand when needed."
                }
              />

              <DarkVision
                icon={<Sparkles size={22} />}
                title={
                  isArabic
                    ? "تجربة أفضل"
                    : "A better experience"
                }
                description={
                  isArabic
                    ? "نستمر بتحسين التجربة بدل ما نوقف عند أول نسخة."
                    : "We keep improving the experience instead of stopping at the first version."
                }
              />
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-white px-5 py-20 transition-colors dark:bg-[#070b14] lg:px-8 lg:py-28">
        <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[32px] bg-gradient-to-l from-blue-700 via-blue-600 to-cyan-500 px-7 py-12 text-center shadow-2xl shadow-blue-600/20 sm:px-12 lg:py-16">
          <div className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full border border-white/10" />

          <div className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full border border-white/10" />

          <div className="relative">
            <h2 className="text-3xl font-black text-white sm:text-4xl">
              {isArabic
                ? "جاهز تشوف شلون نشتغل؟"
                : "Ready to see how we work?"}
            </h2>

            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-blue-100 sm:text-base">
              {isArabic
                ? "استكشف الباقات أو التطبيقات أو أنشئ حسابك وابدأ من المكان اللي يناسبك."
                : "Explore the plans or apps, or create your account and start wherever it suits you."}
            </p>

            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="/plans"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-7 py-4 text-sm font-black text-blue-700 shadow-xl transition hover:-translate-y-0.5 hover:bg-blue-50"
              >
                {isArabic
                  ? "استعرض الباقات"
                  : "Browse plans"}

                <ArrowLeft
                  size={18}
                  className={
                    isArabic ? "" : "rotate-180"
                  }
                />
              </Link>

              <Link
                href="/register"
                className="inline-flex items-center justify-center rounded-2xl border border-white/20 bg-white/10 px-7 py-4 text-sm font-black text-white backdrop-blur transition hover:bg-white/15"
              >
                {isArabic
                  ? "إنشاء حساب"
                  : "Create account"}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function MiniValue({
  value,
  label,
}: {
  value: string;
  label: string;
}) {
  return (
    <div className="border-r border-white/5 px-4 py-4 text-center first:border-r-0">
      <div className="text-xs font-black text-white">
        {value}
      </div>

      <div className="mt-1 text-[9px] font-bold text-slate-500">
        {label}
      </div>
    </div>
  );
}

function VisionCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
        {icon}
      </div>

      <h3 className="mt-5 text-base font-black">
        {title}
      </h3>

      <p className="mt-2 text-sm leading-7 text-slate-500 dark:text-slate-400">
        {description}
      </p>
    </div>
  );
}

function PromiseCard({
  icon,
  number,
  title,
  description,
}: {
  icon: React.ReactNode;
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
          {icon}
        </div>

        <span className="text-xs font-black tracking-[0.15em] text-slate-300 dark:text-slate-600">
          {number}
        </span>
      </div>

      <h3 className="mt-6 text-lg font-black">
        {title}
      </h3>

      <p className="mt-3 text-sm leading-7 text-slate-500 dark:text-slate-400">
        {description}
      </p>
    </div>
  );
}

function DarkVision({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-sm transition hover:bg-white/[0.06]">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/15 text-cyan-400">
        {icon}
      </div>

      <h3 className="mt-5 text-base font-black text-white">
        {title}
      </h3>

      <p className="mt-2 text-sm leading-7 text-slate-400">
        {description}
      </p>
    </div>
  );
}

function HeadphonesIcon() {
  return (
    <div className="flex h-[22px] w-[22px] items-center justify-center">
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M3 14v-2a9 9 0 0 1 18 0v2" />
        <path d="M5 14h1a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2Z" />
        <path d="M19 14h-1a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2Z" />
      </svg>
    </div>
  );
}