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
import s from "@/app/components/home/home.module.css";
import v from "@/app/components/site/services.module.css";

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

/**
 * Shashtna Digital in the site's navy direction: the promise, the five
 * services (Android apps highlighted), why Shashtna with the project
 * add-ons, how we work, starting prices, questions and a closing band.
 * Every price here is a starting price, as the page says.
 */
export default function ServicesPage() {
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const faq = isArabic ? faqAr : faqEn;
  const extras = isArabic ? extrasAr : extrasEn;
  const arrow = <ArrowLeft size={18} className={isArabic ? "" : "rotate-180"} aria-hidden />;

  return (
    // -mt-[80px]/pt-[80px]: the navy ground runs up behind the floating header.
    <div dir={isArabic ? "rtl" : "ltr"} className={`${s.home} -mt-[80px] pt-[80px] pb-16`}>
      <div className={s.wrap}>
        <section className={v.hero} aria-labelledby="services-title">
          <span className={v.badge}>
            <Sparkles size={15} aria-hidden />
            {isArabic ? "شاشتنا للحلول الرقمية" : "Shashtna Digital Solutions"}
          </span>
          <h1 id="services-title" className={v.title}>
            {isArabic ? "نحوّل أفكارك إلى" : "We turn your ideas into"}
            <span className={s.hl}>{isArabic ? "منتجات رقمية." : "digital products."}</span>
          </h1>
          <p className={v.lead}>
            {isArabic
              ? "مواقع، متاجر، تطبيقات Android، Android TV، وحلول IPTV مخصصة لمشروعك — من الفكرة إلى التسليم."
              : "Websites, stores, Android apps, Android TV and custom IPTV solutions — from idea to delivery."}
          </p>
          <div className={v.heroActions}>
            <Link href="/services/request" className={`${s.btn} ${s.btnPrimary}`}>
              {isArabic ? "اطلب عرض سعر" : "Request a quote"}
              {arrow}
            </Link>
            <a href="#services" className={`${s.btn} ${s.btnGhost}`}>
              {isArabic ? "استكشف الخدمات" : "Explore services"}
              <ArrowUpLeft size={18} className={isArabic ? "" : "-scale-x-100"} aria-hidden />
            </a>
          </div>
        </section>

        <section id="services" className={`${s.section} scroll-mt-24`} aria-labelledby="list-title">
          <p className={s.kicker}>{isArabic ? "الخدمات" : "Services"}</p>
          <h2 id="list-title" className={v.h2}>
            {isArabic ? "حلول واضحة لمشاريع حقيقية." : "Clear solutions for real projects."}
          </h2>
          <p className={v.intro}>
            {isArabic
              ? "كل مشروع يبدأ من المتطلبات، مو من قالب جاهز. نحدد النطاق، ثم نختار التقنية والتنفيذ المناسبين."
              : "Every project starts with requirements, not a template. We define the scope first, then choose the right implementation."}
          </p>

          <div className={v.grid}>
            {services.map((service) => {
              const features = isArabic ? service.featuresAr : service.featuresEn;

              return (
                <article key={service.titleEn} className={`${v.service} ${service.featured ? v.featured : ""}`}>
                  {service.featured ? <span className={v.featuredTag}>{isArabic ? "مميز" : "Featured"}</span> : null}
                  <span className={v.icon}>{service.icon}</span>
                  <h3>{isArabic ? service.titleAr : service.titleEn}</h3>
                  <p>{isArabic ? service.descAr : service.descEn}</p>
                  <span className={`${v.price} nums`}>{isArabic ? service.priceAr : service.priceEn}</span>
                  <ul className={v.ticks}>
                    {features.map((feature) => (
                      <li key={feature}>
                        <span className={v.tick}>
                          <Check size={13} aria-hidden />
                        </span>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <div className={v.serviceFoot}>
                    <Link href="/services/request" className={`${s.btn} ${service.featured ? s.btnWhite : s.btnGhost}`}>
                      {isArabic ? "ناقش مشروعك" : "Discuss your project"}
                      {arrow}
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className={v.why} aria-labelledby="why-title">
          <div>
            <p className={s.kicker}>{isArabic ? "لماذا شاشتنا؟" : "Why Shashtna"}</p>
            <h2 id="why-title" className={v.h2}>
              {isArabic ? "مو مجرد برمجة." : "More than coding."}
            </h2>
            <p className={v.intro}>
              {isArabic
                ? "نشتغل على الحل كمنتج كامل: وضوح بالمتطلبات، تجربة استخدام مرتبة، تطوير فعلي، واختبار وتسليم منظم."
                : "We approach the solution as a product: clear requirements, a structured experience, real development, testing and organized delivery."}
            </p>
            <div className={v.values}>
              <ValueCard icon={<Code2 size={20} />} title={isArabic ? "تطوير مخصص" : "Custom development"} text={isArabic ? "نبني حسب احتياج المشروع، مو حسب قالب ثابت." : "Built around the project, not a fixed template."} />
              <ValueCard icon={<Zap size={20} />} title={isArabic ? "تنفيذ واضح" : "Clear execution"} text={isArabic ? "نحدد النطاق والمراحل قبل الدخول بالتنفيذ." : "Scope and milestones are defined before implementation."} />
              <ValueCard icon={<ShieldCheck size={20} />} title={isArabic ? "تسليم منظم" : "Organized delivery"} text={isArabic ? "نسخة جاهزة للتجربة والتسليم حسب الاتفاق." : "A tested build and organized delivery based on the agreed scope."} />
              <ValueCard icon={<Headphones size={20} />} title={isArabic ? "دعم بعد الإطلاق" : "Post-launch support"} text={isArabic ? "الصيانة والتحديثات متوفرة كخدمات مستقلة." : "Maintenance and updates are available as separate services."} />
            </div>
          </div>

          <aside className={v.extras}>
            <div className={v.extrasHead}>
              <div className={v.extrasBrand}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/brand/shashtna-logo-white-256.webp" alt="" />
                <span>
                  <b>شاشتنا</b>
                  <small>DIGITAL SOLUTIONS</small>
                </span>
              </div>
              <span className={v.pill}>{isArabic ? "بناء من الفكرة إلى المنتج" : "Idea to product"}</span>
            </div>
            <p className={v.extrasLabel}>{isArabic ? "إضافات متاحة حسب المشروع" : "Available project add-ons"}</p>
            <ul className={v.ticks}>
              {extras.map((item) => (
                <li key={item}>
                  <span className={v.tick}>
                    <Check size={13} aria-hidden />
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div className={v.custom}>
              <b>{isArabic ? "المشاريع الخاصة" : "Custom projects"}</b>
              <p>
                {isArabic
                  ? "منصة أو فكرة ما تدخل ضمن أي باقة؟ نحدد المتطلبات ونبني عرض سعر مخصص للمشروع."
                  : "Need a platform or product outside the packages? We define the requirements and prepare a custom quote."}
              </p>
            </div>
          </aside>
        </section>

        <section className={s.section} aria-labelledby="how-title">
          <p className={s.kicker}>{isArabic ? "شلون نشتغل" : "How we work"}</p>
          <h2 id="how-title" className={v.h2}>
            {isArabic ? "أربع خطوات واضحة." : "Four clear steps."}
          </h2>
          <ol className={v.steps}>
            {[
              ["01", isArabic ? "نسمع الفكرة" : "Understand", isArabic ? "نحدد الهدف والوظائف المطلوبة." : "Define the goal and required features."],
              ["02", isArabic ? "نحدد النطاق" : "Scope", isArabic ? "نحول المتطلبات إلى مشروع واضح وعرض سعر." : "Turn the requirements into a clear scope and quote."],
              ["03", isArabic ? "نطوّر ونختبر" : "Build & test", isArabic ? "ننفذ ونراجع الواجهة والوظائف قبل التسليم." : "Build and review the interface and functionality before delivery."],
              ["04", isArabic ? "نسلّم" : "Deliver", isArabic ? "نسلّم النسخة المتفق عليها مع الدعم حسب الباقة." : "Deliver the agreed build with support based on the package."],
            ].map(([number, title, description]) => (
              <li key={number} className={v.step}>
                <span className={`${v.stepNum} nums`}>{number}</span>
                <h3>{title}</h3>
                <p>{description}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className={v.pricing} aria-labelledby="pricing-title">
          <div>
            <p className={s.kicker}>{isArabic ? "الأسعار" : "Pricing"}</p>
            <h2 id="pricing-title" className={v.h2}>
              {isArabic ? "ابدأ من الباقة المناسبة، وكمل حسب احتياجك." : "Start from the right package, then scale to your needs."}
            </h2>
            <p className={v.intro}>
              {isArabic
                ? "الأسعار المعروضة هي أسعار بداية وليست أسعاراً نهائية ثابتة. كل عرض سعر يعتمد على نطاق المشروع الفعلي."
                : "Displayed prices are starting points, not fixed final prices. Every quote depends on the actual scope of the project."}
            </p>
          </div>
          <ul className={v.priceList}>
            {services.map((service) => (
              <li key={`price-${service.titleEn}`} className={v.priceRow}>
                <span aria-hidden>{service.icon}</span>
                <b className="truncate">{isArabic ? service.titleAr : service.titleEn}</b>
                <strong className="nums">
                  {isArabic ? service.priceAr.replace("يبدأ من ", "") : service.priceEn.replace("Starting from ", "")}
                </strong>
              </li>
            ))}
          </ul>
        </section>

        <section className={`${s.section} ${v.faq}`} aria-labelledby="faq-title">
          <h2 id="faq-title" className={v.h2}>
            {isArabic ? "قبل ما نبدأ" : "Before we start"}
          </h2>
          <div className={v.faqList}>
            {faq.map((item) => (
              <details key={item.q} className={s.question}>
                <summary>
                  {item.q}
                  <span className={s.plus} aria-hidden>
                    +
                  </span>
                </summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className={v.band} aria-labelledby="band-title">
          <small>SHASHTNA DIGITAL SOLUTIONS</small>
          <h2 id="band-title">{isArabic ? "عندك فكرة؟ خلّينا نحولها إلى مشروع." : "Have an idea? Let’s turn it into a project."}</h2>
          <p>
            {isArabic
              ? "أرسل تفاصيل فكرتك، ونرجع لك بنطاق واضح وعرض سعر مناسب للمشروع."
              : "Send us the idea and requirements, and we’ll come back with a clear scope and a project quote."}
          </p>
          <div className={v.heroActions}>
            <Link href="/services/request" className={`${s.btn} ${s.btnWhite}`}>
              {isArabic ? "ابدأ مشروعك" : "Start your project"}
              {arrow}
            </Link>
          </div>
        </section>
      </div>
    </div>
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
    <div className={v.value}>
      <span className={v.valueIcon}>{icon}</span>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
