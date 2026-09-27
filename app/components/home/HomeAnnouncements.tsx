import Link from "next/link";
import { ArrowLeft, Megaphone } from "lucide-react";

import { cn } from "@/app/ui/cn";
import { Container, SectionHeading } from "@/app/ui/Page";
import { formatDate, translator, type Lang } from "@/src/lib/i18n";

export type HomeAnnouncement = {
  id: number;
  title: string;
  description: string | null;
  imageUrl: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
  style: string;
  date: string | null;
};

const ACCENT: Record<string, string> = {
  STANDARD: "bg-brand/20 text-glow",
  HIGHLIGHT: "bg-brand text-white",
  INFO: "bg-info/15 text-info",
  WARNING: "bg-warning/15 text-warning",
};

function isExternal(url: string) {
  return /^https?:\/\//.test(url);
}

/**
 * Latest announcements published from Admin → Ads & announcements (kind
 * ANNOUNCEMENT, live on the website). The section is not rendered when there
 * are none — it never shows placeholder content.
 */
export function HomeAnnouncements({ lang, items }: { lang: Lang; items: HomeAnnouncement[] }) {
  const t = translator(lang);

  if (!items.length) {
    return null;
  }

  return (
    <section className="py-16 sm:py-20">
      <Container>
        <SectionHeading
          eyebrow={t("آخر الأخبار", "Latest")}
          title={t("آخر إعلانات شاشتنا", "Latest from Shashtna")}
        />
        <ul className={cn("mt-10 grid gap-5", items.length > 1 && "md:grid-cols-2", items.length > 2 && "lg:grid-cols-3")}>
          {items.map((item) => (
            <li key={item.id} className="surface flex flex-col overflow-hidden rounded-panel">
              {item.imageUrl ? (
                <div className="relative aspect-[16/8] overflow-hidden bg-surface-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.imageUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                  <div aria-hidden className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-surface to-transparent" />
                </div>
              ) : null}
              <div className="flex flex-1 flex-col p-6">
                <div className="flex items-center gap-3">
                  <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", ACCENT[item.style] ?? ACCENT.STANDARD)}>
                    <Megaphone size={16} aria-hidden />
                  </span>
                  {item.date ? <p className="nums text-xs text-ink-3">{formatDate(item.date, lang)}</p> : null}
                </div>
                <h3 className="mt-4 text-base font-bold leading-7 text-ink">{item.title}</h3>
                {item.description ? <p className="mt-2 line-clamp-3 text-sm leading-7 text-ink-2">{item.description}</p> : null}
                {item.ctaUrl && item.ctaLabel ? (
                  <div className="mt-auto pt-5">
                    {isExternal(item.ctaUrl) ? (
                      <a
                        href={item.ctaUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm font-bold text-brand-ink hover:text-ink"
                      >
                        {item.ctaLabel}
                        <ArrowLeft size={15} className="ltr:rotate-180" aria-hidden />
                      </a>
                    ) : (
                      <Link href={item.ctaUrl} className="inline-flex items-center gap-1.5 text-sm font-bold text-brand-ink hover:text-ink">
                        {item.ctaLabel}
                        <ArrowLeft size={15} className="ltr:rotate-180" aria-hidden />
                      </Link>
                    )}
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
