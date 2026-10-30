import type { Metadata } from "next";
import Link from "next/link";
import { Activity, ChevronLeft, CreditCard, Headphones, LifeBuoy, MessageSquareText, Wrench } from "lucide-react";

import s from "@/app/components/home/home.module.css";
import h from "@/app/components/site/help.module.css";
import { HelpHero } from "@/app/components/site/HelpHero";
import { Container } from "@/app/ui/Page";
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
    { href: "/help/troubleshooting", icon: <Wrench size={22} aria-hidden />, title: t("حل المشاكل", "Troubleshooting"), body: t("التقطيع، تسجيل الدخول، تثبيت التطبيق وأجهزة VIP.", "Buffering, sign-in, app installs and VIP devices.") },
    { href: "/help/payment", icon: <CreditCard size={22} aria-hidden />, title: t("الدفع والطلبات", "Payment & orders"), body: t("شلون يتم الدفع وشلون تتابع طلبك.", "How payment works and how to track your order.") },
    { href: user ? "/support" : "/help/contact", icon: <MessageSquareText size={22} aria-hidden />, title: t("تذاكر الدعم", "Support tickets"), body: t("افتح تذكرة من حسابك وتابع الرد.", "Open a ticket from your account and follow replies.") },
    { href: "/help/contact", icon: <Headphones size={22} aria-hidden />, title: t("تواصل ويانا", "Contact us"), body: t("القنوات وساعات الدعم.", "Channels and support hours.") },
    { href: "/status", icon: <Activity size={22} aria-hidden />, title: t("حالة الخدمة", "Service status"), body: t("الأعطال والصيانة المعلنة.", "Announced incidents and maintenance.") },
    { href: "/watch", icon: <LifeBuoy size={22} aria-hidden />, title: t("الأجهزة والتطبيقات", "Devices & apps"), body: t("التطبيق المناسب لجهازك وخطوات الإعداد.", "The right app for your device and setup steps.") },
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
      <Container className="pt-7">
        <ul className={h.topics}>
          {topics.map((topic) => (
            <li key={topic.title}>
              <Link href={topic.href} className={h.topic}>
                <span className={h.topicIcon}>{topic.icon}</span>
                <span className="min-w-0">
                  <b>{topic.title}</b>
                  <small>{topic.body}</small>
                </span>
                <ChevronLeft size={20} className={`${h.topicGo} ltr:rotate-180`} aria-hidden />
              </Link>
            </li>
          ))}
        </ul>

        <section id="faq" className="scroll-mt-24" aria-labelledby="faq-title">
          <div className={h.faqHead}>
            <p className={s.kicker}>{t("الأسئلة الشائعة", "FAQ")}</p>
            <h2 id="faq-title" className={h.h2}>
              {t("أجوبة سريعة", "Quick answers")}
            </h2>
          </div>
          <div className={h.faqGroups}>
            {groups.map((group) => (
              <div key={group.key} className={h.faqGroup}>
                <h3>{group.title}</h3>
                {FAQ.filter((item) => item.topic === group.key).map((item) => (
                  <details key={item.id} id={item.id} className={`${s.question} scroll-mt-24`}>
                    <summary>
                      {item.q[lang]}
                      <span className={s.plus} aria-hidden>
                        +
                      </span>
                    </summary>
                    <p>{item.a[lang]}</p>
                  </details>
                ))}
              </div>
            ))}
          </div>
        </section>
      </Container>
    </>
  );
}
