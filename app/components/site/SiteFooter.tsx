import Link from "next/link";
import { ArrowLeft, Clock3, Code2, Phone } from "lucide-react";

import { FacebookIcon, TelegramIcon, WhatsAppIcon } from "@/app/ui/BrandIcons";

import { cn } from "@/app/ui/cn";
import { Logo } from "@/app/ui/Logo";
import { getI18n } from "@/src/server/i18n";
import { getSettings, safeExternalUrl, whatsappLink } from "@/src/server/settings";

/**
 * Site footer. On phones Explore and Help sit side by side and the
 * Shashtna links run in one wrapped row, so every link keeps a 44px target
 * without a tall stack. Shashtna Digital is a separate business: a quiet
 * strip of its own under the links, apart from the subscription brand.
 *
 * Bottom room is kept only where a fixed bar sits over the end of the page
 * on phones: the signed-in bottom navigation (`bottomNav`) and the checkout
 * action bar.
 */
export async function SiteFooter({ bottomNav = false }: { bottomNav?: boolean }) {
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
  ];
  const company = {
    title: t("شاشتنا", "Shashtna"),
    links: [
      { href: "/about", label: t("من نحن", "About") },
      { href: "/terms", label: t("الشروط والأحكام", "Terms") },
      { href: "/privacy", label: t("سياسة الخصوصية", "Privacy") },
      { href: "/refund", label: t("سياسة الاسترجاع", "Refunds") },
    ],
  };

  const social = [
    telegram && { href: telegram, label: "Telegram", icon: <TelegramIcon size={17} /> },
    whatsapp && { href: whatsapp, label: "WhatsApp", icon: <WhatsAppIcon size={17} /> },
    facebook && { href: facebook, label: "Facebook", icon: <FacebookIcon size={17} /> },
  ].filter(Boolean) as { href: string; label: string; icon: React.ReactNode }[];

  const link = "flex min-h-11 items-center text-sm text-ink-3 transition hover:text-ink md:min-h-9";

  return (
    <footer
      className={cn(
        "border-t border-line bg-canvas-deep",
        bottomNav && "pb-safe lg:pb-0",
        // The checkout page's fixed action bar (phones and tablets, about 113px tall).
        "max-lg:[body:has([data-testid=checkout-summary])_&]:pb-[calc(env(safe-area-inset-bottom)+7.5rem)]",
      )}
    >
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)] md:gap-10 md:py-12 lg:px-8">
        <div>
          <Logo plain />
          <p className="mt-3 max-w-xs text-sm leading-6 text-ink-3">
            {t(
              "اشتراكات IPTV وVIP وتطبيق Shashtna Player، وحسابك يتابع طلبك واشتراكك لحد التفعيل والتجديد.",
              "IPTV and VIP subscriptions and the Shashtna Player app, with an account that follows your order and plan through activation and renewal.",
            )}
          </p>
          {hours || phone ? (
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-3">
              {hours ? (
                <p className="inline-flex items-center gap-2">
                  <Clock3 size={14} aria-hidden />
                  {t("الدعم: ", "Support: ")}
                  {hours}
                </p>
              ) : null}
              {phone ? (
                <p className="inline-flex items-center gap-2">
                  <Phone size={14} aria-hidden />
                  <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className="nums inline-flex min-h-11 items-center hover:text-ink md:min-h-0" dir="ltr">
                    {phone}
                  </a>
                </p>
              ) : null}
            </div>
          ) : null}
          {social.length ? (
            <ul className="mt-4 flex gap-2">
              {social.map((item) => (
                <li key={item.label}>
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={item.label}
                    className="flex h-11 w-11 items-center justify-center rounded-xl border border-line text-ink-2 transition hover:border-brand/60 hover:text-ink"
                  >
                    {item.icon}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {/* Phones: Explore and Help side by side; wider screens: one column each. */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-8 md:contents">
          {columns.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <h2 className="text-sm font-bold text-ink">{column.title}</h2>
              <ul className="mt-2 md:mt-3">
                {column.links.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className={link}>
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
          <nav aria-label={company.title} className="col-span-2 md:col-span-1">
            <h2 className="text-sm font-bold text-ink">{company.title}</h2>
            <ul className="mt-2 flex flex-wrap gap-x-5 md:mt-3 md:block">
              {company.links.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className={link}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>

      {/* Shashtna Digital: a separate business surface, kept out of the
          consumer navigation and homepage, and set apart from the
          subscription brand here. */}
      <div className="border-t border-line">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Code2 size={18} className="shrink-0 text-ink-3" aria-hidden />
            <p className="text-sm text-ink-3">
              <span className="font-bold text-ink-2">{t("شاشتنا للحلول الرقمية", "Shashtna Digital")}</span>
              <span aria-hidden className="max-sm:hidden"> · </span>
              <span className="max-sm:block">
                {t("نبني تطبيقات ومواقع ومنصات رقمية للشركات والمشاريع.", "We build apps, websites and digital platforms for businesses and projects.")}
              </span>
            </p>
          </div>
          <div className="flex flex-wrap gap-x-4">
            <Link href="/services" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-ink-2 transition hover:text-ink">
              {t("خدماتنا", "Our services")}
              <ArrowLeft size={15} className="ltr:rotate-180" aria-hidden />
            </Link>
            <Link href="/services/request" className="inline-flex min-h-11 items-center text-sm font-semibold text-ink-2 transition hover:text-ink">
              {t("اطلب عرض سعر", "Request a quote")}
            </Link>
          </div>
        </div>
      </div>
      <div className="border-t border-line">
        <p className="mx-auto w-full max-w-6xl px-4 py-5 text-xs text-ink-3 sm:px-6 lg:px-8">
          © <span className="nums">{new Date().getFullYear()}</span> {t("شاشتنا. جميع الحقوق محفوظة.", "Shashtna. All rights reserved.")}
        </p>
      </div>
    </footer>
  );
}
