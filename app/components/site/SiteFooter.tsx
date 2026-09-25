import Link from "next/link";
import { Clock3, Phone } from "lucide-react";

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
        { href: "/watch", label: t("الأجهزة المدعومة", "Supported devices") },
        { href: "/apps", label: t("التطبيقات", "Apps") },
        { href: "/devices", label: t("أجهزة VIP", "VIP devices") },
      ],
    },
    {
      title: t("المساعدة", "Help"),
      links: [
        { href: "/help#faq", label: t("الأسئلة الشائعة", "FAQ") },
        { href: "/help/troubleshooting", label: t("حل المشاكل", "Troubleshooting") },
        { href: "/help/payment", label: t("طرق الدفع", "Payment methods") },
        { href: "/help/contact", label: t("تواصل ويانا", "Contact us") },
        { href: "/status", label: t("حالة الخدمة", "Service status") },
      ],
    },
    {
      title: t("شاشتنا", "Shashtna"),
      links: [
        { href: "/about", label: t("من نحن", "About") },
        { href: "/services", label: t("خدماتنا", "Our services") },
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
    <footer className="border-t border-line bg-[#040810] pb-safe lg:pb-0">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)] lg:px-8">
        <div>
          <Logo className="h-16" />
          <p className="mt-5 max-w-xs text-sm leading-7 text-ink-3">
            {t(
              "اشتراكات IPTV وVIP وتطبيق Shashtna Player — وخدمات رقمية لبناء التطبيقات والمواقع.",
              "IPTV and VIP subscriptions and the Shashtna Player app — plus digital services for apps and websites.",
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
      <div className="border-t border-line">
        <p className="mx-auto w-full max-w-6xl px-4 py-6 text-xs text-ink-3 sm:px-6 lg:px-8">
          © <span className="nums">{new Date().getFullYear()}</span> {t("شاشتنا. جميع الحقوق محفوظة.", "Shashtna. All rights reserved.")}
        </p>
      </div>
    </footer>
  );
}
