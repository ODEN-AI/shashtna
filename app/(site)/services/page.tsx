"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpLeft,
  Check,
  Code2,
  Globe,
  Headphones,
  Radio,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Tv2,
  ShoppingCart,
  Zap,
} from "lucide-react";

import { useLanguage } from "../components/LanguageProvider";

type Service = {
  icon: ReactNode;
  titleAr: string;
  titleEn: string;
  descAr: string;
  descEn: string;
  priceAr: string;
  priceEn: string;
  featuresAr: string[];
  featuresEn: string[];
  featured?: boolean;
};

const services: Service[] = [
  {
    icon: <Globe size={23} />,
    titleAr: "تطوير المواقع",
    titleEn: "Web Development",
    descAr:
      "مواقع حديثة وسريعة ومصممة حول هوية مشروعك، من صفحات الهبوط إلى مواقع الشركات والمنصات المخصصة.",
    descEn:
      "Modern, fast websites built around your brand, from landing pages to business sites and custom platforms.",
    priceAr: "يبدأ من 250,000 د.ع",
    priceEn: "Starting from IQD 250,000",
    featuresAr: [
      "تصميم مخصص ومتجاوب",
      "هيكل واضح وتجربة استخدام مرتبة",
      "نماذج تواصل وربط الخدمات المطلوبة",
      "تهيئة أساسية لمحركات البحث",
    ],
    featuresEn: [
      "Custom responsive design",
      "Clear structure and UX",
      "Contact forms and required integrations",
      "Basic SEO setup",
    ],
  },
  {
    icon: <ShoppingCart size={23} />,
    titleAr: "المتاجر الإلكترونية",
    titleEn: "E-Commerce",
    descAr:
      "متجر إلكتروني جاهز للبيع والإدارة، مع تجربة شراء واضحة وإمكانية إضافة الخصائص التي يحتاجها نشاطك.",
    descEn:
      "E-commerce stores built for real sales, with a clear buying flow and room for the features your business needs.",
    priceAr: "يبدأ من 700,000 د.ع",
    priceEn: "Starting from IQD 700,000",
    featuresAr: [
      "كتالوج ومنتجات وتصنيفات",
      "إدارة الطلبات والعملاء",
      "سلة شراء وCheckout",
      "تكاملات الدفع والخدمات عند الحاجة",
    ],
    featuresEn: [
      "Products, catalog and categories",
      "Orders and customer management",
      "Cart and checkout flow",
      "Payment and service integrations when needed",
    ],
  },
  {
    icon: <Smartphone size={23} />,
    titleAr: "تطبيقات Android",
    titleEn: "Android Apps",
    descAr:
      "نحوّل فكرة مشروعك إلى تطبيق Android مخصص، مع ربط API وقواعد البيانات والوظائف المناسبة لطبيعة الخدمة.",
    descEn:
      "Turn your product idea into a custom Android app with APIs, databases and features tailored to the service.",
    priceAr: "يبدأ من 800,000 د.ع",
    priceEn: "Starting from IQD 800,000",
    featuresAr: [
      "واجهات مخصصة للموبايل",
      "تسجيل دخول وحسابات عند الحاجة",
      "API وقاعدة بيانات حسب المشروع",
      "APK جاهز للتجربة والتسليم",
    ],
    featuresEn: [
      "Custom mobile interfaces",
      "Accounts and authentication when needed",
      "API and database integration",
      "Testable and deliverable APK",
    ],
    featured: true,
  },
  {
    icon: <Tv2 size={23} />,
    titleAr: "Android TV / Google TV",
    titleEn: "Android TV / Google TV",
    descAr:
      "تطبيقات TV مصممة للشاشات الكبيرة والريموت، مع تنقل واضح وواجهات مناسبة للمشاهدة.",
    descEn:
      "TV applications designed for large screens and remote control, with clear navigation and viewing-first interfaces.",
    priceAr: "يبدأ من 1,200,000 د.ع",
    priceEn: "Starting from IQD 1,200,000",
    featuresAr: [
      "واجهة TV-first",
      "تنقل كامل بالريموت",
      "تركيز واضح للعناصر Focus states",
      "اختبار على Android TV / Google TV",
    ],
    featuresEn: [
      "TV-first interface",
      "Full remote navigation",
      "Clear focus states",
      "Android TV / Google TV testing",
    ],
  },
  {
    icon: <Radio size={23} />,
    titleAr: "حلول IPTV وStreaming",
    titleEn: "IPTV & Streaming Solutions",
    descAr:
      "تطبيقات ومشغلات IPTV مخصصة لاحتياج مشروعك، من Live TV إلى الأفلام والمسلسلات وEPG والمشغل.",
    descEn:
      "Custom IPTV and streaming apps built around your project, from Live TV to movies, series, EPG and playback.",
    priceAr: "يبدأ من 1,000,000 د.ع",
    priceEn: "Starting from IQD 1,000,000",
    featuresAr: [
      "Xtream / M3U",
      "Live TV وMovies وSeries",
      "EPG وSearch وFavorites",
      "Video Player وAudio وSubtitles",
    ],
    featuresEn: [
      "Xtream / M3U",
      "Live TV, Movies and Series",
      "EPG, Search and Favorites",
      "Video Player, Audio and Subtitles",
    ],
  },
];

const extrasAr = [
  "لوحات تحكم وإدارة",
  "Backend وقواعد بيانات",
  "ربط APIs وخدمات خارجية",
  "بوابات دفع",
  "تجهيز الاستضافة والنشر",
  "صيانة وتحديثات بعد الإطلاق",
];

const extrasEn = [
  "Admin dashboards",
  "Backend and databases",
  "API and third-party integrations",
  "Payment gateways",
  "Hosting and deployment setup",
  "Post-launch maintenance and updates",
];

const faqAr = [
  {
    q: "هل الأسعار ثابتة؟",
    a: "لا. الأسعار المعروضة هي أسعار بداية. السعر النهائي يتحدد بعد فهم الصفحات والوظائف والتكاملات المطلوبة للمشروع.",
  },
  {
    q: "هل تشمل الخدمة التصميم والتطوير؟",
    a: "نعم، الباقات مصممة لتكون حلاً متكاملاً. تفاصيل التصميم، الـBackend، التكاملات والدعم تتحدد حسب نطاق المشروع.",
  },
  {
    q: "هل توفرون الصيانة بعد التسليم؟",
    a: "نعم، الصيانة والتحديثات متوفرة كخدمة مستقلة بعد الإطلاق.",
  },
  {
    q: "هل يمكن تنفيذ فكرة خاصة غير موجودة ضمن الباقات؟",
    a: "أكيد. المشاريع الخاصة والمنصات المخصصة تحصل على عرض سعر حسب المتطلبات.",
  },
];

const faqEn = [
  {
    q: "Are the prices fixed?",
    a: "No. The displayed prices are starting points. The final quote depends on pages, features and integrations.",
  },
  {
    q: "Does the service include design and development?",
    a: "Yes. The packages are designed as complete solutions, with the exact scope defined for each project.",
  },
  {
    q: "Do you provide maintenance after delivery?",
    a: "Yes. Maintenance and updates are available as a separate post-launch service.",
  },
  {
    q: "Can you build something outside the listed packages?",
    a: "Absolutely. Custom projects and platforms are quoted based on the requirements.",
  },
];

export default function ServicesPage() {
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const faq = isArabic ? faqAr : faqEn;
  const extras = isArabic ? extrasAr : extrasEn;

  return (
    <main dir={isArabic ? "rtl" : "ltr"} className="overflow-hidden">
      <section className="relative isolate border-b border-slate-200/70 dark:border-slate-800/70">
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute left-1/2 top-0 h-[520px] w-[760px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-blue-500/[0.10] blur-3xl dark:bg-blue-500/[0.11]" />
          <div className="absolute right-0 top-20 h-64 w-64 rounded-full bg-cyan-400/[0.08] blur-3xl" />
        </div>

        <div className="mx-auto max-w-7xl px-5 pb-20 pt-16 lg:px-8 lg:pb-28 lg:pt-24">
          <div className="mx-auto max-w-4xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200/80 bg-blue-50/70 px-4 py-2 text-[11px] font-black tracking-[0.18em] text-blue-700 shadow-sm backdrop-blur-xl dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300">
              <Sparkles size={14} />
              {isArabic ? "شاشتنا للحلول الرقمية" : "SHASHTNA DIGITAL SOLUTIONS"}
            </div>

            <h1 className="mt-7 text-4xl font-black leading-tight tracking-tight text-slate-950 dark:text-white sm:text-5xl lg:text-6xl">
              {isArabic ? (
                <>
                  نحوّل أفكارك إلى
                  <span className="block bg-gradient-to-r from-blue-700 via-blue-500 to-cyan-500 bg-clip-text text-transparent dark:from-blue-400 dark:via-cyan-300 dark:to-cyan-400">
                    منتجات رقمية.
                  </span>
                </>
              ) : (
                <>
                  We turn your ideas into
                  <span className="block bg-gradient-to-r from-blue-700 via-blue-500 to-cyan-500 bg-clip-text text-transparent dark:from-blue-400 dark:via-cyan-300 dark:to-cyan-400">
                    digital products.
                  </span>
                </>
              )}
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-sm leading-8 text-slate-500 dark:text-slate-400 sm:text-base">
              {isArabic
                ? "مواقع، متاجر، تطبيقات Android، Android TV، وحلول IPTV مخصصة لمشروعك — من الفكرة إلى التسليم."
                : "Websites, stores, Android apps, Android TV and custom IPTV solutions — from idea to delivery."}
            </p>

            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/services/request"
                className="group inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-6 py-3.5 text-sm font-black text-white shadow-xl shadow-blue-600/20 transition-all duration-300 hover:-translate-y-0.5 hover:bg-blue-700"
              >
                {isArabic ? "اطلب عرض سعر" : "Request a quote"}
                <ArrowLeft
                  size={17}
                  className={`transition-transform duration-300 ${isArabic ? "group-hover:-translate-x-1" : "rotate-180 group-hover:translate-x-1"}`}
                />
              </Link>

              <a
                href="#services"
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/70 px-6 py-3.5 text-sm font-black text-slate-700 shadow-sm backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:border-blue-200 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:border-blue-500/40 dark:hover:text-blue-400"
              >
                {isArabic ? "استكشف الخدمات" : "Explore services"}
                <ArrowUpLeft size={17} />
              </a>
            </div>
          </div>
        </div>
      </section>

      <section id="services" className="relative">
        <div className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-28">
          <div className="max-w-2xl">
            <span className="text-xs font-black tracking-[0.2em] text-blue-600 dark:text-blue-400">
              {isArabic ? "الخدمات" : "SERVICES"}
            </span>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950 dark:text-white sm:text-4xl">
              {isArabic ? "حلول واضحة لمشاريع حقيقية." : "Clear solutions for real projects."}
            </h2>
            <p className="mt-4 text-sm leading-8 text-slate-500 dark:text-slate-400 sm:text-base">
              {isArabic
                ? "كل مشروع يبدأ من المتطلبات، مو من قالب جاهز. نحدد النطاق، ثم نختار التقنية والتنفيذ المناسبين."
                : "Every project starts with requirements, not a template. We define the scope first, then choose the right implementation."}
            </p>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {services.map((service) => {
              const features = isArabic ? service.featuresAr : service.featuresEn;
              return (
                <article
                  key={service.titleEn}
                  className={`group relative flex h-full flex-col overflow-hidden rounded-[30px] border p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl ${
                    service.featured
                      ? "border-blue-300/80 bg-gradient-to-b from-blue-50/90 to-white shadow-[0_20px_60px_rgba(37,99,235,0.11)] dark:border-blue-500/30 dark:from-blue-500/[0.10] dark:to-slate-900/80"
                      : "border-slate-200/80 bg-white/75 shadow-[0_18px_50px_rgba(15,23,42,0.06)] backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-900/60 dark:shadow-black/20"
                  }`}
                >
                  {service.featured && (
                    <div className="absolute right-5 top-5 rounded-full bg-blue-600 px-3 py-1 text-[10px] font-black tracking-wide text-white shadow-lg shadow-blue-600/20">
                      {isArabic ? "مميز" : "FEATURED"}
                    </div>
                  )}

                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-200 bg-blue-50 text-blue-600 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-400">
                    {service.icon}
                  </div>

                  <h3 className="mt-6 text-xl font-black text-slate-950 dark:text-white">
                    {isArabic ? service.titleAr : service.titleEn}
                  </h3>

                  <p className="mt-3 text-sm leading-7 text-slate-500 dark:text-slate-400">
                    {isArabic ? service.descAr : service.descEn}
                  </p>

                  <div className="mt-7 border-t border-slate-200/80 pt-5 dark:border-slate-800">
                    <div className="text-xs font-black uppercase tracking-[0.12em] text-blue-700 dark:text-blue-300">
                      {isArabic ? service.priceAr : service.priceEn}
                    </div>

                    <div className="mt-5 space-y-3">
                      {features.map((feature) => (
                        <div key={feature} className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-300">
                          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                            <Check size={13} />
                          </span>
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Link
                    href="/services/request"
                    className="mt-8 inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-800 transition-all duration-300 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-100 dark:hover:border-blue-500/30 dark:hover:bg-blue-500/10 dark:hover:text-blue-300"
                  >
                    {isArabic ? "ناقش مشروعك" : "Discuss your project"}
                    <ArrowLeft size={16} className={isArabic ? "" : "rotate-180"} />
                  </Link>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200/70 bg-slate-50/70 dark:border-slate-800/70 dark:bg-slate-900/40">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-20 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-24">
          <div>
            <span className="text-xs font-black tracking-[0.2em] text-blue-600 dark:text-blue-400">
              {isArabic ? "لماذا شاشتنا؟" : "WHY SHASHTNA"}
            </span>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950 dark:text-white sm:text-4xl">
              {isArabic ? "مو مجرد برمجة." : "More than coding."}
            </h2>
            <p className="mt-5 max-w-xl text-sm leading-8 text-slate-500 dark:text-slate-400 sm:text-base">
              {isArabic
                ? "نشتغل على الحل كمنتج كامل: وضوح بالمتطلبات، تجربة استخدام مرتبة، تطوير فعلي، واختبار وتسليم منظم."
                : "We approach the solution as a product: clear requirements, a structured experience, real development, testing and organized delivery."}
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <ValueCard icon={<Code2 size={19} />} title={isArabic ? "تطوير مخصص" : "Custom development"} text={isArabic ? "نبني حسب احتياج المشروع، مو حسب قالب ثابت." : "Built around the project, not a fixed template."} />
              <ValueCard icon={<Zap size={19} />} title={isArabic ? "تنفيذ واضح" : "Clear execution"} text={isArabic ? "نحدد النطاق والمراحل قبل الدخول بالتنفيذ." : "Scope and milestones are defined before implementation."} />
              <ValueCard icon={<ShieldCheck size={19} />} title={isArabic ? "تسليم منظم" : "Organized delivery"} text={isArabic ? "نسخة جاهزة للتجربة والتسليم حسب الاتفاق." : "A tested build and organized delivery based on the agreed scope."} />
              <ValueCard icon={<Headphones size={19} />} title={isArabic ? "دعم بعد الإطلاق" : "Post-launch support"} text={isArabic ? "الصيانة والتحديثات متوفرة كخدمات مستقلة." : "Maintenance and updates are available as separate services."} />
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-slate-950 p-7 shadow-2xl dark:border-white/[0.06] sm:p-8">
            <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-blue-500/15 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 -left-12 h-52 w-52 rounded-full bg-cyan-400/10 blur-3xl" />

            <div className="relative">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 text-white">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/10">
                    <Tv2 size={20} />
                  </div>
                  <div>
                    <div className="text-sm font-black">شاشتنا</div>
                    <div className="mt-1 text-[9px] font-bold tracking-[0.18em] text-cyan-300">DIGITAL SOLUTIONS</div>
                  </div>
                </div>
                <div className="rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-black text-white backdrop-blur">
                  {isArabic ? "بناء من الفكرة إلى المنتج" : "IDEA TO PRODUCT"}
                </div>
              </div>

              <div className="mt-10">
                <div className="text-xs font-bold text-blue-200">
                  {isArabic ? "إضافات متاحة حسب المشروع" : "Available project add-ons"}
                </div>
                <div className="mt-5 space-y-3">
                  {extras.map((item) => (
                    <div key={item} className="flex items-center gap-3 text-sm text-slate-200">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500/15 text-cyan-300">
                        <Check size={12} />
                      </span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                <div className="text-xs font-black text-white">
                  {isArabic ? "المشاريع الخاصة" : "Custom projects"}
                </div>
                <p className="mt-2 text-xs leading-6 text-slate-400">
                  {isArabic
                    ? "منصة أو فكرة ما تدخل ضمن أي باقة؟ نحدد المتطلبات ونبني عرض سعر مخصص للمشروع."
                    : "Need a platform or product outside the packages? We define the requirements and prepare a custom quote."}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white dark:bg-[#070b14]">
        <div className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-24">
          <div className="max-w-2xl">
            <span className="text-xs font-black tracking-[0.2em] text-blue-600 dark:text-blue-400">
              {isArabic ? "شلون نشتغل" : "HOW WE WORK"}
            </span>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950 dark:text-white sm:text-4xl">
              {isArabic ? "أربع خطوات واضحة." : "Four clear steps."}
            </h2>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-4">
            {[
              ["01", isArabic ? "نسمع الفكرة" : "Understand", isArabic ? "نحدد الهدف والوظائف المطلوبة." : "Define the goal and required features."],
              ["02", isArabic ? "نحدد النطاق" : "Scope", isArabic ? "نحول المتطلبات إلى مشروع واضح وعرض سعر." : "Turn the requirements into a clear scope and quote."],
              ["03", isArabic ? "نطوّر ونختبر" : "Build & test", isArabic ? "ننفذ ونراجع الواجهة والوظائف قبل التسليم." : "Build and review the interface and functionality before delivery."],
              ["04", isArabic ? "نسلّم" : "Deliver", isArabic ? "نسلّم النسخة المتفق عليها مع الدعم حسب الباقة." : "Deliver the agreed build with support based on the package."],
            ].map(([number, title, description]) => (
              <div key={number} className="rounded-3xl border border-slate-200/80 bg-white/80 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
                <div className="text-xs font-black tracking-[0.18em] text-blue-600 dark:text-blue-400">{number}</div>
                <h3 className="mt-4 text-base font-black text-slate-950 dark:text-white">{title}</h3>
                <p className="mt-2 text-xs leading-6 text-slate-500 dark:text-slate-400">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-slate-200/70 dark:border-slate-800/70">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 lg:grid-cols-[0.95fr_1.05fr] lg:px-8 lg:py-24">
          <div>
            <span className="text-xs font-black tracking-[0.2em] text-blue-600 dark:text-blue-400">
              {isArabic ? "الأسعار" : "PRICING"}
            </span>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950 dark:text-white sm:text-4xl">
              {isArabic ? "ابدأ من الباقة المناسبة، وكمل حسب احتياجك." : "Start from the right package, then scale to your needs."}
            </h2>
            <p className="mt-5 text-sm leading-8 text-slate-500 dark:text-slate-400">
              {isArabic
                ? "الأسعار المعروضة هي أسعار بداية وليست أسعاراً نهائية ثابتة. كل عرض سعر يعتمد على نطاق المشروع الفعلي."
                : "Displayed prices are starting points, not fixed final prices. Every quote depends on the actual scope of the project."}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {services.map((service) => (
              <div key={`price-${service.titleEn}`} className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-4 dark:border-slate-800 dark:bg-slate-900/50">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="text-blue-600 dark:text-blue-400">{service.icon}</span>
                  <span className="truncate text-sm font-black text-slate-900 dark:text-white">{isArabic ? service.titleAr : service.titleEn}</span>
                </div>
                <span className="shrink-0 text-xs font-black text-blue-700 dark:text-blue-300">
                  {isArabic ? service.priceAr.replace("يبدأ من ", "") : service.priceEn.replace("Starting from ", "")}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-slate-200/70 dark:border-slate-800/70">
        <div className="mx-auto max-w-4xl px-5 py-20 lg:px-8 lg:py-24">
          <div className="text-center">
            <span className="text-xs font-black tracking-[0.2em] text-blue-600 dark:text-blue-400">
              {isArabic ? "أسئلة شائعة" : "FAQ"}
            </span>
            <h2 className="mt-4 text-3xl font-black text-slate-950 dark:text-white sm:text-4xl">
              {isArabic ? "قبل ما نبدأ" : "Before we start"}
            </h2>
          </div>

          <div className="mt-10 space-y-3">
            {faq.map((item) => (
              <details key={item.q} className="group rounded-3xl border border-slate-200/80 bg-white/80 px-5 py-4 dark:border-slate-800 dark:bg-slate-900/55">
                <summary className="cursor-pointer list-none text-sm font-black text-slate-900 outline-none dark:text-white [&::-webkit-details-marker]:hidden">
                  <div className="flex items-center justify-between gap-5">
                    <span>{item.q}</span>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition-transform duration-200 group-open:rotate-45 dark:bg-slate-800 dark:text-slate-300">
                      <span className="text-lg leading-none">+</span>
                    </span>
                  </div>
                </summary>
                <p className="max-w-3xl pb-2 pt-4 text-sm leading-7 text-slate-500 dark:text-slate-400">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-gradient-to-br from-blue-700 via-blue-600 to-cyan-500">
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full border border-white/10" />
        <div className="pointer-events-none absolute -bottom-20 -left-16 h-72 w-72 rounded-full border border-white/10" />
        <div className="mx-auto max-w-4xl px-5 py-20 text-center lg:px-8 lg:py-24">
          <div className="text-xs font-black tracking-[0.2em] text-blue-100">
            SHASHTNA DIGITAL SOLUTIONS
          </div>
          <h2 className="mt-4 text-3xl font-black text-white sm:text-4xl">
            {isArabic ? "عندك فكرة؟ خلّينا نحولها إلى مشروع." : "Have an idea? Let’s turn it into a project."}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-blue-100 sm:text-base">
            {isArabic
              ? "أرسل تفاصيل فكرتك، ونرجع لك بنطاق واضح وعرض سعر مناسب للمشروع."
              : "Send us the idea and requirements, and we’ll come back with a clear scope and a project quote."}
          </p>
          <Link
            href="/services/request"
            className="group mt-8 inline-flex items-center gap-2 rounded-2xl bg-white px-7 py-4 text-sm font-black text-blue-700 shadow-xl transition-all duration-300 hover:-translate-y-1 hover:bg-blue-50"
          >
            {isArabic ? "ابدأ مشروعك" : "Start your project"}
            <ArrowLeft size={18} className={isArabic ? "transition-transform group-hover:-translate-x-1" : "rotate-180 transition-transform group-hover:translate-x-1"} />
          </Link>
        </div>
      </section>
    </main>
  );
}

function ValueCard({
  icon,
  title,
  text,
}: {
  icon: ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white/80 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/55">
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
        {icon}
      </div>
      <h3 className="mt-4 text-sm font-black text-slate-900 dark:text-white">{title}</h3>
      <p className="mt-2 text-xs leading-6 text-slate-500 dark:text-slate-400">{text}</p>
    </div>
  );
}
