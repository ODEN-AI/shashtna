import type { Metadata } from "next";
import Link from "next/link";
import { Activity, CreditCard, Headphones, LifeBuoy, MessageSquareText, Wrench } from "lucide-react";

import { HelpHero } from "@/app/components/site/HelpHero";
import { Container, SectionHeading } from "@/app/ui/Page";
import { FAQ } from "@/src/content/help";
import { getSessionUser } from "@/src/server/auth";
import { getI18n } from "@/src/server/i18n";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "مركز المساعدة",
  description: "الأسئلة الشائعة، حل المشاكل، طرق الدفع، وقنوات التواصل مع دعم شاشتنا.",
  alternates: { canonical: "/help" },
};

export default async function HelpPage() {
  const [{ t, lang }, user] = await Promise.all([getI18n(), getSessionUser().catch(() => null)]);

  const topics = [
    { href: "/help/troubleshooting", icon: <Wrench size={20} aria-hidden />, title: t("حل المشاكل", "Troubleshooting"), body: t("التقطيع، تسجيل الدخول، تثبيت التطبيق وأجهزة VIP.", "Buffering, sign-in, app installs and VIP devices.") },
    { href: "/help/payment", icon: <CreditCard size={20} aria-hidden />, title: t("الدفع والطلبات", "Payment & orders"), body: t("شلون يتم الدفع وشلون تتابع طلبك.", "How payment works and how to track your order.") },
    { href: user ? "/support" : "/help/contact", icon: <MessageSquareText size={20} aria-hidden />, title: t("تذاكر الدعم", "Support tickets"), body: t("افتح تذكرة من حسابك وتابع الرد.", "Open a ticket from your account and follow replies.") },
    { href: "/help/contact", icon: <Headphones size={20} aria-hidden />, title: t("تواصل ويانا", "Contact us"), body: t("القنوات وساعات الدعم.", "Channels and support hours.") },
    { href: "/status", icon: <Activity size={20} aria-hidden />, title: t("حالة الخدمة", "Service status"), body: t("الأعطال والصيانة المعلنة.", "Announced incidents and maintenance.") },
    { href: "/watch", icon: <LifeBuoy size={20} aria-hidden />, title: t("الأجهزة والتطبيقات", "Devices & apps"), body: t("التطبيق المناسب لجهازك وخطوات الإعداد.", "The right app for your device and setup steps.") },
  ];

  const groups = [
    { key: "start", title: t("البداية والاشتراك", "Getting started") },
    { key: "payment", title: t("الدفع والطلبات", "Payment & orders") },
    { key: "account", title: t("الحساب والتجديد", "Account & renewal") },
    { key: "watch", title: t("المشاهدة", "Watching") },
  ] as const;

  return (
    <>
      <HelpHero
        eyebrow={t("مركز المساعدة", "Help centre")}
        title={t("شلون نكدر نساعدك؟", "How can we help?")}
        description={t("أغلب الأجوبة تلگاها هنا، وإذا احتجت فريق الدعم موجود.", "Most answers are here — and our support team is around when you need them.")}
      />
      <Container className="py-14">
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {topics.map((topic) => (
            <li key={topic.title}>
              <Link href={topic.href} className="surface group flex h-full items-start gap-4 rounded-card p-5 transition hover:border-brand/50">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand/15 text-brand-ink transition group-hover:text-glow">
                  {topic.icon}
                </span>
                <span>
                  <span className="block font-bold text-ink">{topic.title}</span>
                  <span className="mt-1 block text-sm leading-6 text-ink-3">{topic.body}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <section id="faq" className="mt-20 scroll-mt-24">
          <SectionHeading eyebrow={t("الأسئلة الشائعة", "FAQ")} title={t("أجوبة سريعة", "Quick answers")} />
          <div className="mt-8 grid gap-10 lg:grid-cols-2">
            {groups.map((group) => (
              <div key={group.key}>
                <h3 className="text-sm font-bold text-ink-3">{group.title}</h3>
                <div className="mt-3 space-y-3">
                  {FAQ.filter((item) => item.topic === group.key).map((item) => (
                    <details key={item.id} id={item.id} className="surface group scroll-mt-24 rounded-2xl px-5 py-1 open:pb-4">
                      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-bold text-ink [&::-webkit-details-marker]:hidden">
                        {item.q[lang]}
                        <span aria-hidden className="text-xl leading-none text-ink-3 transition group-open:rotate-45">+</span>
                      </summary>
                      <p className="text-sm leading-7 text-ink-2">{item.a[lang]}</p>
                    </details>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </Container>
    </>
  );
}
