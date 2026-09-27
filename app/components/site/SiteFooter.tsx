import Link from "next/link";
import { ArrowLeft, Clock3, Code2, Phone } from "lucide-react";

import { FacebookIcon, TelegramIcon, WhatsAppIcon } from "@/app/ui/BrandIcons";

import { Logo } from "@/app/ui/Logo";
import { getI18n } from "@/src/server/i18n";
import { getSettings, safeExternalUrl, whatsappLink } from "@/src/server/settings";

export async function SiteFooter() {
  const [{ t, lang }, settings] = await Promise.all([getI18n(), getSettings()]);

  const telegram = safeExternalUrl(settings["contact.telegram"]);
  const facebook = safeExternalUrl(settings["contact.facebook"]);
  const whatsapp = whatsappLink(settings["contact.whatsapp"]);
  const phone = settings["contact.phone"].trim();
  const hours = lang === "ar" ? settings["support.hours"] : settings["support.hoursEn"];

  const columns = [
    {
      title: t("استكشف", "Explore"),
      links: [
        { href: "/plans", label: t("الباقات", "Plans") },
        { href: "/watch/player", label: "Shashtna Player" },
        { href: "/apps", label: t("التطبيقات", "Apps") },
        { href: "/watch", label: t("الأجهزة المدعومة", "Supported devices") },
        { href: "/devices", label: t("أجهزة VIP", "VIP devices") },
      ],
    },
    {
      title: t("المساعدة", "Help"),
      links: [
        { href: "/help#faq", label: t("الأسئلة الشائعة", "FAQ") },
        { href: "/help/troubleshooting", label: t("حل المشاكل", "Troubleshooting") },
        { href: "/help/payment", label: t("الدفع", "Payment") },
        { href: "/status", label: t("حالة الخدمة", "Service status") },
        { href: "/help/contact", label: t("تواصل ويانا", "Contact us") },
      ],
    },
    {
      title: t("شاشتنا", "Shashtna"),
      links: [
        { href: "/about", label: t("من نحن", "About") },
        { href: "/terms", label: t("الشروط والأحكام", "Terms") },
        { href: "/privacy", label: t("سياسة الخصوصية", "Privacy") },
        { href: "/refund", label: t("سياسة الاسترجاع", "Refunds") },
      ],
    },
  ];

  const social = [
    telegram && { href: telegram, label: "Telegram", icon: <TelegramIcon size={17} /> },
    whatsapp && { href: whatsapp, label: "WhatsApp", icon: <WhatsAppIcon size={17} /> },
    facebook && { href: facebook, label: "Facebook", icon: <FacebookIcon size={17} /> },
  ].filter(Boolean) as { href: string; label: string; icon: React.ReactNode }[];

  return (
    <footer className="border-t border-line bg-canvas-deep pb-safe lg:pb-0">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)] lg:px-8">
        <div>
          <Logo className="h-16" />
          <p className="mt-5 max-w-xs text-sm leading-7 text-ink-3">
            {t(
              "اشتراكات IPTV وVIP وتطبيق Shashtna Player، وحسابك يتابع طلبك واشتراكك لحد التفعيل والتجديد.",
              "IPTV and VIP subscriptions and the Shashtna Player app, with an account that follows your order and plan through activation and renewal.",
            )}
          </p>
          {hours ? (
            <p className="mt-4 inline-flex items-center gap-2 text-xs text-ink-3">
              <Clock3 size={14} aria-hidden />
              {t("الدعم: ", "Support: ")}
              {hours}
            </p>
          ) : null}
          {phone ? (
            <p className="mt-2 inline-flex items-center gap-2 text-xs text-ink-3">
              <Phone size={14} aria-hidden />
              <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className="nums hover:text-ink" dir="ltr">
                {phone}
              </a>
            </p>
          ) : null}
          {social.length ? (
            <ul className="mt-5 flex gap-2">
              {social.map((item) => (
                <li key={item.label}>
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={item.label}
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-line text-ink-2 transition hover:border-brand/60 hover:text-ink"
                  >
                    {item.icon}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {columns.map((column) => (
          <nav key={column.title} aria-label={column.title}>
            <h2 className="text-sm font-bold text-ink">{column.title}</h2>
            <ul className="mt-4 space-y-2.5">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-ink-3 transition hover:text-ink">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      {/* Shashtna Digital: a separate business surface, kept out of the
          consumer navigation and homepage. */}
      <div className="mx-auto w-full max-w-6xl px-4 pb-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 rounded-card border border-line bg-surface/60 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-surface-3 text-brand-ink">
              <Code2 size={18} aria-hidden />
            </span>
            <div>
              <p className="text-sm font-bold text-ink">{t("شاشتنا للحلول الرقمية", "Shashtna Digital")}</p>
              <p className="mt-1 text-sm leading-6 text-ink-3">
                {t("نبني تطبيقات ومواقع ومنصات رقمية للشركات والمشاريع.", "We build apps, websites and digital platforms for businesses and projects.")}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 sm:shrink-0">
            <Link
              href="/services"
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-line-strong px-4 text-sm font-semibold text-ink-2 transition hover:border-brand/60 hover:text-ink"
            >
              {t("خدماتنا", "Our services")}
              <ArrowLeft size={15} className="ltr:rotate-180" aria-hidden />
            </Link>
            <Link
              href="/services/request"
              className="inline-flex h-10 items-center rounded-xl px-4 text-sm font-semibold text-brand-ink transition hover:text-ink"
            >
              {t("اطلب عرض سعر", "Request a quote")}
            </Link>
          </div>
        </div>
      </div>
      <div className="border-t border-line">
        <p className="mx-auto w-full max-w-6xl px-4 py-6 text-xs text-ink-3 sm:px-6 lg:px-8">
          © <span className="nums">{new Date().getFullYear()}</span> {t("شاشتنا. جميع الحقوق محفوظة.", "Shashtna. All rights reserved.")}
        </p>
      </div>
    </footer>
  );
}
