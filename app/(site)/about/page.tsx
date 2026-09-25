import type { Metadata } from "next";
import {
  ArrowLeft,
  Code2,
  Eye,
  Globe,
  HeartHandshake,
  LayoutDashboard,
  MonitorPlay,
  ShieldCheck,
  Smartphone,
  TrendingUp,
  Tv,
} from "lucide-react";

import { LinkButton } from "@/app/ui/Button";
import { LogoImage } from "@/app/ui/Logo";
import { Container, Eyebrow, SectionHeading } from "@/app/ui/Page";
import { DIGITAL_SERVICE_AREAS } from "@/src/content/digital-services";
import { getI18n } from "@/src/server/i18n";

export const metadata: Metadata = {
  title: "من نحن",
  description:
    "شاشتنا علامة عراقية تجمع بين الترفيه والتقنية — اشتراكات مشاهدة واضحة وتطبيق Shashtna Player، وخدمات رقمية لبناء التطبيقات والمواقع والمنصات.",
  alternates: { canonical: "/about" },
};

const SERVICE_ICONS = {
  apps: <Smartphone size={18} aria-hidden />,
  web: <Globe size={18} aria-hidden />,
  platforms: <LayoutDashboard size={18} aria-hidden />,
  custom: <Code2 size={18} aria-hidden />,
} as const;

export default async function AboutPage() {
  const { t, lang } = await getI18n();

  const values = [
    { icon: <Eye size={20} aria-hidden />, title: t("ما نخفي التفاصيل", "We don't hide details"), body: t("نوضح أهم المعلومات قبل اتخاذ قرار الاشتراك.", "We explain what matters before you decide to subscribe.") },
    { icon: <HeartHandshake size={20} aria-hidden />, title: t("المستخدم بالمقدمة", "People first"), body: t("نصمم التجربة حتى تكون سهلة حتى لمن ما عنده خبرة تقنية.", "We design the experience to be easy even without technical know-how.") },
    { icon: <ShieldCheck size={20} aria-hidden />, title: t("ما نعد بشي ما نقدر نلتزم به", "No promises we can't keep"), body: t("الثقة ما تنطلب، تنبني.", "Trust isn't asked for — it's built.") },
    { icon: <TrendingUp size={20} aria-hidden />, title: t("نتطور باستمرار", "Always improving"), body: t("الموقع والخدمات تتطور بناءً على احتياجات المستخدمين.", "The site and services evolve with what customers need.") },
  ];

  const entertainment = [
    t("اشتراكات IPTV وVIP بأسعار ومدد معلنة", "IPTV and VIP plans with published prices and durations"),
    t("تطبيق Shashtna Player للمشاهدة", "The Shashtna Player app for watching"),
    t("دليل للأجهزة والتطبيقات المدعومة", "A guide to supported devices and apps"),
    t("حساب لمتابعة الاشتراك والتجديد والدعم", "An account to follow your plan, renewals and support"),
  ];

  return (
    <>
      <section className="bg-cinema border-b border-line">
        <Container className="grid items-center gap-10 py-16 sm:py-24 lg:grid-cols-[1.3fr_1fr]">
          <div>
            <Eyebrow>{t("من نحن", "About us")}</Eyebrow>
            <h1 className="mt-4 max-w-3xl text-balance text-4xl font-bold leading-tight text-ink sm:text-5xl">
              {t("شاشتنا مبنية على فكرة بسيطة.", "Shashtna is built on a simple idea.")}
            </h1>
            <p className="mt-6 max-w-2xl text-[15px] leading-8 text-ink-2 sm:text-lg sm:leading-9">
              {t(
                "شاشتنا علامة عراقية هدفها تخلي تجربة الاشتراك أوضح وأسهل. نريدك تعرف شنو تشترك، شلون تستخدمه، وين تحصل المساعدة، وتقدر تتابع معلوماتك من مكان واحد.",
                "Shashtna is an Iraqi brand built to make subscribing clearer and easier. We want you to know what you're getting, how to use it, where to get help, and to manage it all in one place.",
              )}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <LinkButton href="/plans">{t("استعرض الباقات", "Browse plans")}</LinkButton>
              <LinkButton href="/services" variant="secondary">
                {t("خدماتنا الرقمية", "Our digital services")}
              </LinkButton>
            </div>
          </div>
          <div className="flex justify-center lg:justify-end">
            <LogoImage className="h-40 sm:h-52" />
          </div>
        </Container>
      </section>

      <Container className="py-16 sm:py-20">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-start">
          <SectionHeading
            eyebrow={t("رسالتنا", "Our mission")}
            title={t("تجربة مفهومة من البداية للنهاية", "An experience that makes sense from start to finish")}
          />
          <div className="space-y-4 text-[15px] leading-8 text-ink-2">
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
        </div>

        <div className="mt-16">
          <SectionHeading
            eyebrow={t("شنو نقدم", "What we do")}
            title={t("جانبين، علامة وحدة", "Two sides, one brand")}
          />
          <div className="mt-10 grid gap-5 lg:grid-cols-2">
            <article className="surface flex flex-col rounded-panel p-6 sm:p-8">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand/15 text-brand-ink">
                <Tv size={20} aria-hidden />
              </span>
              <h2 className="mt-5 text-xl font-bold text-ink">{t("الترفيه والمشاهدة", "Entertainment and viewing")}</h2>
              <p className="mt-2 text-sm leading-7 text-ink-2">
                {t(
                  "قنوات مباشرة وأفلام ومسلسلات على الأجهزة اللي تستخدمها، باشتراك واضح وحساب تتابع منه كل شي.",
                  "Live channels, films and series on the devices you already use, with a clear plan and an account to follow everything.",
                )}
              </p>
              <ul className="mt-5 space-y-2.5 border-t border-line pt-5">
                {entertainment.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm leading-6 text-ink-2">
                    <MonitorPlay size={16} className="mt-1 shrink-0 text-glow" aria-hidden />
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-auto pt-6">
                <LinkButton href="/watch" variant="secondary">
                  {t("شاهد على", "Watch on")}
                  <ArrowLeft size={16} aria-hidden className="ltr:rotate-180" />
                </LinkButton>
              </div>
            </article>

            <article className="surface-raised flex flex-col rounded-panel p-6 sm:p-8">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-glow/15 text-glow">
                <Code2 size={20} aria-hidden />
              </span>
              <h2 className="mt-5 text-xl font-bold text-ink">{t("الخدمات الرقمية", "Digital services")}</h2>
              <p className="mt-2 text-sm leading-7 text-ink-2">
                {t(
                  "نفس الفريق يبني منتجات رقمية للأفراد والمشاريع: من الفكرة إلى النسخة الجاهزة.",
                  "The same team builds digital products for people and businesses: from the idea to a finished product.",
                )}
              </p>
              <ul className="mt-5 grid gap-3 border-t border-line pt-5 sm:grid-cols-2">
                {DIGITAL_SERVICE_AREAS.map((area) => (
                  <li key={area.id} className="flex items-start gap-2.5">
                    <span className="mt-0.5 text-glow">{SERVICE_ICONS[area.id]}</span>
                    <span>
                      <span className="block text-sm font-bold text-ink">{area.title[lang]}</span>
                      <span className="block text-xs leading-5 text-ink-3">{area.body[lang]}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-auto flex flex-wrap gap-3 pt-6">
                <LinkButton href="/services">{t("استكشف خدماتنا", "Explore our services")}</LinkButton>
                <LinkButton href="/services/request" variant="ghost">
                  {t("اطلب عرض سعر", "Request a quote")}
                </LinkButton>
              </div>
            </article>
          </div>
        </div>

        <div className="mt-16">
          <SectionHeading eyebrow={t("قيمنا", "Our values")} title={t("وضوح • سهولة • دعم", "Clarity • Simplicity • Support")} />
          <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {values.map((value) => (
              <li key={value.title} className="surface rounded-card p-6">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand/15 text-brand-ink">{value.icon}</span>
                <h3 className="mt-5 font-bold text-ink">{value.title}</h3>
                <p className="mt-2 text-sm leading-7 text-ink-2">{value.body}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className="surface-raised mt-16 rounded-panel p-8 text-center sm:p-12">
          <p className="mx-auto max-w-2xl text-balance text-xl font-bold leading-9 text-ink sm:text-2xl">
            {t(
              "هدفنا مو بس نبيع اشتراكات. هدفنا نبني خدمة يشعر المستخدم وياها أن كل شي تحت السيطرة وواضح قدامه.",
              "Our goal isn't just to sell subscriptions. It's to build a service where you feel everything is clear and under control.",
            )}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <LinkButton href="/plans">{t("استعرض الباقات", "Browse plans")}</LinkButton>
            <LinkButton href="/help/contact" variant="secondary">
              {t("تواصل ويانا", "Contact us")}
            </LinkButton>
          </div>
        </div>
      </Container>
    </>
  );
}
