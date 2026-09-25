import type { Metadata } from "next";
import { Eye, HeartHandshake, ShieldCheck, TrendingUp } from "lucide-react";

import { LinkButton } from "@/app/ui/Button";
import { Container, Eyebrow, SectionHeading } from "@/app/ui/Page";
import { getI18n } from "@/src/server/i18n";

export const metadata: Metadata = {
  title: "من نحن",
  description: "شاشتنا منصة هدفها تخلي تجربة الاشتراك أوضح وأسهل — من اختيار الباقة إلى الدعم.",
  alternates: { canonical: "/about" },
};

export default async function AboutPage() {
  const { t } = await getI18n();

  const values = [
    { icon: <Eye size={20} aria-hidden />, title: t("ما نخفي التفاصيل", "We don't hide details"), body: t("نوضح أهم المعلومات قبل اتخاذ قرار الاشتراك.", "We explain what matters before you decide to subscribe.") },
    { icon: <HeartHandshake size={20} aria-hidden />, title: t("المستخدم بالمقدمة", "People first"), body: t("نصمم التجربة حتى تكون سهلة حتى لمن ما عنده خبرة تقنية.", "We design the experience to be easy even without technical know-how.") },
    { icon: <ShieldCheck size={20} aria-hidden />, title: t("ما نعد بشي ما نقدر نلتزم به", "No promises we can't keep"), body: t("الثقة ما تنطلب، تنبني.", "Trust isn't asked for — it's built.") },
    { icon: <TrendingUp size={20} aria-hidden />, title: t("نتطور باستمرار", "Always improving"), body: t("الموقع والخدمات تتطور بناءً على احتياجات المستخدمين.", "The site and services evolve with what customers need.") },
  ];

  return (
    <>
      <section className="bg-cinema border-b border-line">
        <Container className="py-16 sm:py-24">
          <Eyebrow>{t("من نحن", "About us")}</Eyebrow>
          <h1 className="mt-4 max-w-3xl text-balance text-4xl font-bold leading-tight text-ink sm:text-5xl">
            {t("شاشتنا مبنية على فكرة بسيطة.", "Shashtna is built on a simple idea.")}
          </h1>
          <p className="mt-6 max-w-2xl text-[15px] leading-8 text-ink-2 sm:text-lg">
            {t(
              "بدل ما تكون عملية الاشتراك مجرد دفع واستلام بيانات، نريدها تكون تجربة مفهومة من البداية للنهاية — من اختيار الباقة، إلى معرفة التطبيق المناسب، إلى متابعة الاشتراك وطلب المساعدة عند الحاجة.",
              "Instead of subscribing being just a payment and a set of credentials, we want it to be clear from start to finish — from choosing a plan, to finding the right app, to managing your subscription and getting help when you need it.",
            )}
          </p>
        </Container>
      </section>

      <Container className="py-16 sm:py-20">
        <SectionHeading eyebrow={t("قيمنا", "Our values")} title={t("وضوح • سهولة • دعم", "Clarity • Simplicity • Support")} />
        <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {values.map((value) => (
            <li key={value.title} className="surface rounded-card p-6">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand/15 text-brand-ink">{value.icon}</span>
              <h2 className="mt-5 font-bold text-ink">{value.title}</h2>
              <p className="mt-2 text-sm leading-7 text-ink-2">{value.body}</p>
            </li>
          ))}
        </ul>

        <div className="surface-raised mt-16 rounded-panel p-8 text-center sm:p-12">
          <p className="mx-auto max-w-2xl text-balance text-xl font-bold leading-9 text-ink sm:text-2xl">
            {t(
              "هدفنا مو بس نبيع اشتراكات. هدفنا نبني خدمة يشعر المستخدم وياها أن كل شي تحت السيطرة وواضح قدامه.",
              "Our goal isn't just to sell subscriptions. It's to build a service where you feel everything is clear and under control.",
            )}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <LinkButton href="/plans">{t("استعرض الباقات", "Browse plans")}</LinkButton>
            <LinkButton href="/watch" variant="secondary">
              {t("شاهد على", "Watch on")}
            </LinkButton>
          </div>
        </div>
      </Container>
    </>
  );
}
