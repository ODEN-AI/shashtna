import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Code2,
  Eye,
  Globe,
  HeartHandshake,
  LayoutDashboard,
  ShieldCheck,
  Smartphone,
  TrendingUp,
  Tv,
} from "lucide-react";

import s from "@/app/components/home/home.module.css";
import a from "@/app/components/site/about.module.css";
import { DIGITAL_SERVICE_AREAS } from "@/src/content/digital-services";
import { getI18n } from "@/src/server/i18n";

export const metadata: Metadata = {
  title: "من نحن",
  description:
    "شاشتنا علامة عراقية تجمع بين الترفيه والتقنية — اشتراكات مشاهدة واضحة وتطبيق Shashtna Player، وخدمات رقمية لبناء التطبيقات والمواقع والمنصات.",
  alternates: { canonical: "/about" },
};

const SERVICE_ICONS = {
  apps: <Smartphone size={22} aria-hidden />,
  web: <Globe size={22} aria-hidden />,
  platforms: <LayoutDashboard size={22} aria-hidden />,
  custom: <Code2 size={22} aria-hidden />,
} as const;

/**
 * About Shashtna in the site's navy direction: the idea with the logo on a
 * royal panel, the mission, the brand's two sides (watching, with the
 * account it comes with, and digital services), its values and a closing
 * statement.
 */
export default async function AboutPage() {
  const { t, lang } = await getI18n();

  const values = [
    { icon: <Eye size={22} aria-hidden />, title: t("ما نخفي التفاصيل", "We don't hide details"), body: t("نوضح أهم المعلومات قبل اتخاذ قرار الاشتراك.", "We explain what matters before you decide to subscribe.") },
    { icon: <HeartHandshake size={22} aria-hidden />, title: t("المستخدم بالمقدمة", "People first"), body: t("نصمم التجربة حتى تكون سهلة حتى لمن ما عنده خبرة تقنية.", "We design the experience to be easy even without technical know-how.") },
    { icon: <ShieldCheck size={22} aria-hidden />, title: t("ما نعد بشي ما نقدر نلتزم به", "No promises we can't keep"), body: t("الثقة ما تنطلب، تنبني.", "Trust isn't asked for — it's built.") },
    { icon: <TrendingUp size={22} aria-hidden />, title: t("نتطور باستمرار", "Always improving"), body: t("الموقع والخدمات تتطور بناءً على احتياجات المستخدمين.", "The site and services evolve with what customers need.") },
  ];

  const entertainment = [
    t("اشتراكات IPTV وVIP بأسعار ومدد معلنة", "IPTV and VIP plans with published prices and durations"),
    t("تطبيق Shashtna Player للمشاهدة", "The Shashtna Player app for watching"),
    t("دليل للأجهزة والتطبيقات المدعومة", "A guide to supported devices and apps"),
    t("حساب لمتابعة الاشتراك والتجديد والدعم", "An account to follow your plan, renewals and support"),
  ];

  return (
    // -mt-[80px]/pt-[80px]: the navy ground runs up behind the floating header.
    <div className={`${s.home} -mt-[80px] pt-[80px] pb-16`}>
      <div className={s.wrap}>
        <section className={a.hero} aria-labelledby="about-title">
          <div>
            <p className={s.kicker}>{t("من نحن", "About us")}</p>
            <h1 id="about-title" className={`${a.title} text-balance`}>
              {t("شاشتنا مبنية على فكرة بسيطة.", "Shashtna is built on a simple idea.")}
            </h1>
            <p className={a.lead}>
              {t(
                "شاشتنا علامة عراقية هدفها تخلي تجربة الاشتراك أوضح وأسهل. نريدك تعرف شنو تشترك، شلون تستخدمه، وين تحصل المساعدة، وتقدر تتابع معلوماتك من مكان واحد.",
                "Shashtna is an Iraqi brand built to make subscribing clearer and easier. We want you to know what you're getting, how to use it, where to get help, and to manage it all in one place.",
              )}
            </p>
            <div className={a.actions}>
              <Link href="/plans" className={`${s.btn} ${s.btnPrimary}`}>
                {t("استعرض الباقات", "Browse plans")}
              </Link>
              <Link href="/services" className={`${s.btn} ${s.btnGhost}`}>
                {t("خدماتنا الرقمية", "Our digital services")}
              </Link>
            </div>
          </div>
          <div className={a.mark}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/shashtna-logo-white-256.webp" alt={t("شعار شاشتنا", "Shashtna logo")} />
            <span className={`${a.markChip} ${a.chipA}`}>IPTV</span>
            <span className={`${a.markChip} ${a.chipB}`}>VIP</span>
            <span className={`${a.markChip} ${a.chipC}`}>Shashtna Player</span>
          </div>
        </section>

        <section className={`${a.mission} ${s.section}`} aria-labelledby="mission-title">
          <div>
            <p className={s.kicker}>{t("رسالتنا", "Our mission")}</p>
            <h2 id="mission-title" className={a.h2}>
              {t("تجربة مفهومة من البداية للنهاية", "An experience that makes sense from start to finish")}
            </h2>
          </div>
          <div className={a.body}>
            <p>
              {t(
                "بدل ما تكون عملية الاشتراك مجرد دفع واستلام بيانات، نريدها تكون تجربة مفهومة من البداية للنهاية.",
                "Instead of subscribing being just a payment and a set of credentials, we want it to make sense from start to finish.",
              )}
            </p>
            <p>
              {t(
                "من اختيار الباقة، إلى معرفة التطبيق المناسب، إلى متابعة الاشتراك وطلب المساعدة عند الحاجة — كل شي يكون مرتب وواضح.",
                "From choosing a plan and finding the right app to following your subscription and getting help when you need it — everything should be organised and clear.",
              )}
            </p>
          </div>
        </section>

        <section aria-labelledby="sides-title">
          <p className={s.kicker}>{t("شنو نقدم", "What we do")}</p>
          <h2 id="sides-title" className={a.h2}>
            {t("جانبين، علامة وحدة", "Two sides, one brand")}
          </h2>
          <div className={a.sides}>
            <article className={`${a.side} ${a.sideWatch}`}>
              <span className={a.sideIcon}>
                <Tv size={24} aria-hidden />
              </span>
              <h2>{t("الترفيه والمشاهدة", "Entertainment and viewing")}</h2>
              <p>
                {t(
                  "قنوات مباشرة وأفلام ومسلسلات على الأجهزة اللي تستخدمها، باشتراك واضح وحساب تتابع منه كل شي.",
                  "Live channels, films and series on the devices you already use, with a clear plan and an account to follow everything.",
                )}
              </p>
              <ul className={a.ticks}>
                {entertainment.map((item) => (
                  <li key={item}>
                    <span className={a.tick}>
                      <Check size={14} aria-hidden />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
              <div className={a.shot}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/brand/account-preview.jpg" alt={t("حساب شاشتنا", "The Shashtna account")} loading="lazy" />
              </div>
              <div className={a.sideFoot}>
                <Link href="/watch" className={`${s.btn} ${s.btnWhite}`}>
                  {t("شاهد على", "Watch on")}
                  <ArrowLeft size={18} aria-hidden className="ltr:rotate-180" />
                </Link>
              </div>
            </article>

            <article className={`${a.side} ${a.sideDigital}`}>
              <span className={a.sideIcon}>
                <Code2 size={24} aria-hidden />
              </span>
              <h2>{t("الخدمات الرقمية", "Digital services")}</h2>
              <p>
                {t(
                  "نفس الفريق يبني منتجات رقمية للأفراد والمشاريع: من الفكرة إلى النسخة الجاهزة.",
                  "The same team builds digital products for people and businesses: from the idea to a finished product.",
                )}
              </p>
              <ul className={a.areas}>
                {DIGITAL_SERVICE_AREAS.map((area) => (
                  <li key={area.id} className={a.area}>
                    <span className={a.areaIcon}>{SERVICE_ICONS[area.id]}</span>
                    <b>{area.title[lang]}</b>
                    <small>{area.body[lang]}</small>
                  </li>
                ))}
              </ul>
              <div className={a.sideFoot}>
                <Link href="/services" className={`${s.btn} ${s.btnPrimary}`}>
                  {t("استكشف خدماتنا", "Explore our services")}
                </Link>
                <Link href="/services/request" className={`${s.btn} ${s.btnGhost}`}>
                  {t("اطلب عرض سعر", "Request a quote")}
                </Link>
              </div>
            </article>
          </div>
        </section>

        <section className={s.section} aria-labelledby="values-title">
          <p className={s.kicker}>{t("قيمنا", "Our values")}</p>
          <h2 id="values-title" className={a.h2}>
            {t("وضوح • سهولة • دعم", "Clarity • Simplicity • Support")}
          </h2>
          <ul className={a.values}>
            {values.map((value) => (
              <li key={value.title} className={a.value}>
                <span className={a.valueIcon}>{value.icon}</span>
                <h3>{value.title}</h3>
                <p>{value.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className={a.close}>
          <p className="text-balance">
            {t(
              "هدفنا مو بس نبيع اشتراكات. هدفنا نبني خدمة يشعر المستخدم وياها أن كل شي تحت السيطرة وواضح قدامه.",
              "Our goal isn't just to sell subscriptions. It's to build a service where you feel everything is clear and under control.",
            )}
          </p>
          <div className={a.actions}>
            <Link href="/plans" className={`${s.btn} ${s.btnWhite}`}>
              {t("استعرض الباقات", "Browse plans")}
            </Link>
            <Link href="/help/contact" className={`${s.btn} ${s.btnGhost}`}>
              {t("تواصل ويانا", "Contact us")}
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
