import type { Metadata } from "next";
import { Clock3, MessageSquarePlus, Phone } from "lucide-react";

import { HelpHero } from "@/app/components/site/HelpHero";
import { FacebookIcon, TelegramIcon, WhatsAppIcon } from "@/app/ui/BrandIcons";
import { LinkButton } from "@/app/ui/Button";
import { Container } from "@/app/ui/Page";
import { Notice } from "@/app/ui/States";
import { getSessionUser } from "@/src/server/auth";
import { getI18n } from "@/src/server/i18n";
import { getSettings, safeExternalUrl, whatsappLink } from "@/src/server/settings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "تواصل ويانا",
  description: "قنوات التواصل مع شاشتنا وساعات الدعم الفني.",
  alternates: { canonical: "/help/contact" },
};

export default async function ContactPage() {
  const [{ t, isAr }, user, settings] = await Promise.all([
    getI18n(),
    getSessionUser().catch(() => null),
    getSettings(),
  ]);

  const hours = isAr ? settings["support.hours"] : settings["support.hoursEn"];
  const phone = settings["contact.phone"].trim();
  const list = [
    whatsappLink(settings["contact.whatsapp"]) && {
      key: "whatsapp",
      href: whatsappLink(settings["contact.whatsapp"])!,
      icon: <WhatsAppIcon size={22} />,
      title: "WhatsApp",
      body: t("راسلنا مباشرة على واتساب.", "Message us directly on WhatsApp."),
    },
    safeExternalUrl(settings["contact.telegram"]) && {
      key: "telegram",
      href: safeExternalUrl(settings["contact.telegram"])!,
      icon: <TelegramIcon size={22} />,
      title: "Telegram",
      body: t("تواصل ويانا عبر تيليجرام.", "Reach us on Telegram."),
    },
    safeExternalUrl(settings["contact.facebook"]) && {
      key: "facebook",
      href: safeExternalUrl(settings["contact.facebook"])!,
      icon: <FacebookIcon size={22} />,
      title: "Facebook Messenger",
      body: t("راسلنا على صفحة فيسبوك.", "Message our Facebook page."),
    },
  ].filter(Boolean) as { key: string; href: string; icon: React.ReactNode; title: string; body: string }[];

  return (
    <>
      <HelpHero
        eyebrow={t("مركز المساعدة", "Help centre")}
        title={t("تواصل ويانا", "Contact us")}
        description={t(
          "لأي مشكلة بالاشتراك، أفضل طريقة هي تذكرة دعم من حسابك لأنها تنربط باشتراكك مباشرة.",
          "For anything about your subscription, a support ticket from your account is best — it's linked to your subscription automatically.",
        )}
      />
      <Container className="grid gap-8 py-14 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-4">
          <article className="surface-raised rounded-panel p-6 ring-1 ring-brand/40 sm:p-8">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand text-white shadow-brand">
              <MessageSquarePlus size={22} aria-hidden />
            </span>
            <h2 className="mt-5 text-xl font-bold text-ink">{t("تذكرة دعم", "Support ticket")}</h2>
            <p className="mt-2 text-sm leading-7 text-ink-2">
              {t("اكتب المشكلة، وتوصلك إشعارات الرد بحسابك.", "Describe the issue and get notified of replies in your account.")}
            </p>
            <LinkButton
              href={user ? "/support/new" : `/login?redirect=${encodeURIComponent("/support/new")}`}
              className="mt-5"
            >
              {user ? t("افتح تذكرة", "Open a ticket") : t("سجّل دخولك لفتح تذكرة", "Sign in to open a ticket")}
            </LinkButton>
          </article>

          {list.length ? (
            <ul className="grid gap-4 sm:grid-cols-2">
              {list.map((channel) => (
                <li key={channel.key}>
                  <a
                    href={channel.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="surface flex h-full items-start gap-4 rounded-card p-5 transition hover:border-brand/50"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-line bg-surface-3 text-ink">
                      {channel.icon}
                    </span>
                    <span>
                      <span className="block font-bold text-ink">{channel.title}</span>
                      <span className="mt-1 block text-sm text-ink-3">{channel.body}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <Notice tone="info">{t("قنوات التواصل غير متوفرة حاليًا — استخدم تذاكر الدعم.", "Contact channels aren't available right now — please use support tickets.")}</Notice>
          )}
        </div>

        <aside className="space-y-4">
          <div className="surface rounded-card p-6">
            <h2 className="flex items-center gap-2 font-bold text-ink">
              <Clock3 size={18} className="text-glow" aria-hidden />
              {t("ساعات الدعم", "Support hours")}
            </h2>
            <p className="mt-3 text-sm text-ink-2">{hours || t("غير محددة حاليًا", "Not set yet")}</p>
          </div>
          {phone ? (
            <div className="surface rounded-card p-6">
              <h2 className="flex items-center gap-2 font-bold text-ink">
                <Phone size={18} className="text-glow" aria-hidden />
                {t("الهاتف", "Phone")}
              </h2>
              <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className="nums mt-3 block text-sm font-semibold text-brand-ink" dir="ltr">
                {phone}
              </a>
            </div>
          ) : null}
          <div className="surface rounded-card p-6">
            <h2 className="font-bold text-ink">{t("قبل ما تراسلنا", "Before you message us")}</h2>
            <p className="mt-2 text-sm leading-7 text-ink-2">
              {t("شوف حالة الخدمة — إذا اكو عطل معلن، فريقنا يشتغل عليه.", "Check the service status — if there's an announced incident, our team is on it.")}
            </p>
            <LinkButton href="/status" variant="secondary" size="sm" className="mt-4">
              {t("حالة الخدمة", "Service status")}
            </LinkButton>
          </div>
        </aside>
      </Container>
    </>
  );
}
