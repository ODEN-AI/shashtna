import { CircleHelp, Clock3, Headphones } from "lucide-react";

import { FacebookIcon, TelegramIcon, WhatsAppIcon } from "@/app/ui/BrandIcons";
import { LinkButton } from "@/app/ui/Button";
import { Container, SectionHeading } from "@/app/ui/Page";
import { FAQ } from "@/src/content/help";
import { translator, type Lang } from "@/src/lib/i18n";
import { safeExternalUrl, whatsappLink, type SiteSettings } from "@/src/server/settings";

type Settings = SiteSettings;

/** Five real help-centre answers, and the ways to reach the team. */
export function HomeFaq({ lang, settings, hours }: { lang: Lang; settings: Settings; hours: string }) {
  const t = translator(lang);

  return (
    <section className="py-12 sm:py-24">
      <Container className="grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:gap-10">
        <div>
          <SectionHeading title={t("قبل ما تشترك", "Before you subscribe")} />
          <div className="mt-6 space-y-2.5 sm:mt-8 sm:space-y-3">
            {FAQ.slice(0, 5).map((item) => (
              <details key={item.id} className="surface group rounded-2xl px-5 py-1 open:pb-4">
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-bold text-ink [&::-webkit-details-marker]:hidden">
                  {item.q[lang]}
                  <span
                    aria-hidden
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-3 text-lg leading-none text-ink-2 transition group-open:rotate-45 group-open:bg-brand/25 group-open:text-glow"
                  >
                    +
                  </span>
                </summary>
                <p className="text-sm leading-7 text-ink-2">{item.a[lang]}</p>
              </details>
            ))}
          </div>
          <LinkButton href="/help#faq" variant="ghost" className="mt-3 sm:mt-5">
            <CircleHelp size={16} aria-hidden />
            {t("كل الأسئلة", "All questions")}
          </LinkButton>
        </div>

        <SupportCard lang={lang} settings={settings} hours={hours} />
      </Container>
    </section>
  );
}

function SupportCard({ lang, settings, hours }: { lang: Lang; settings: Settings; hours: string }) {
  const t = translator(lang);
  const channels = [
    safeExternalUrl(settings["contact.telegram"]) && {
      href: safeExternalUrl(settings["contact.telegram"])!,
      label: "Telegram",
      icon: <TelegramIcon size={18} />,
    },
    whatsappLink(settings["contact.whatsapp"]) && {
      href: whatsappLink(settings["contact.whatsapp"])!,
      label: "WhatsApp",
      icon: <WhatsAppIcon size={18} />,
    },
    safeExternalUrl(settings["contact.facebook"]) && {
      href: safeExternalUrl(settings["contact.facebook"])!,
      label: "Facebook",
      icon: <FacebookIcon size={18} />,
    },
  ].filter(Boolean) as { href: string; label: string; icon: React.ReactNode }[];

  return (
    <aside className="surface-raised h-fit rounded-panel p-5 sm:p-8" data-testid="home-support">
      <h2 className="flex items-center gap-2 text-xl font-bold text-ink">
        <Headphones size={20} className="shrink-0 text-brand-ink" aria-hidden />
        {t("نحتاج نساعدك؟", "Need a hand?")}
      </h2>
      <p className="mt-2 text-sm leading-7 text-ink-2">
        {t("مركز المساعدة بيه حلول لأكثر المشاكل شيوعًا، وفريقنا موجود إذا احتجت.", "The help centre covers the most common issues, and our team is here if you need them.")}
      </p>
      {hours ? (
        <p className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-ink-2">
          <Clock3 size={14} className="shrink-0" aria-hidden />
          {hours}
        </p>
      ) : null}
      <div className="mt-4 grid gap-2 sm:mt-6">
        <LinkButton href="/help" variant="primary">
          {t("مركز المساعدة", "Help centre")}
        </LinkButton>
        {channels.length ? (
          <div className="flex flex-wrap gap-2">
            {channels.map((channel) => (
              <LinkButton key={channel.label} href={channel.href} external variant="secondary" className="flex-1 basis-28">
                {channel.icon}
                {channel.label}
              </LinkButton>
            ))}
          </div>
        ) : null}
      </div>
    </aside>
  );
}
