import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Megaphone } from "lucide-react";

import { buttonClass } from "@/app/ui/Button";
import { Container } from "@/app/ui/Page";
import { formatDate } from "@/src/lib/i18n";
import { safeHref } from "@/src/server/catalog";
import { getLiveAnnouncement } from "@/src/server/content";
import { getI18n } from "@/src/server/i18n";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "إعلان", robots: { index: false } };

/**
 * One announcement or offer. Notifications that point at an announcement
 * open this page on the website (the app opens its own screen for the same
 * record). Once the announcement is deactivated or expired it is gone here
 * too.
 */
export default async function AnnouncementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { t, lang } = await getI18n();
  const item = await getLiveAnnouncement(Number(id), "WEBSITE").catch(() => null);

  if (!item) {
    notFound();
  }

  const cta = safeHref(item.ctaUrl);
  const image = safeHref(item.imageUrl);

  return (
    <Container className="max-w-3xl py-14">
      <article className="surface overflow-hidden rounded-panel">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="aspect-[16/9] w-full object-cover" />
        ) : null}
        <div className="space-y-4 p-6 sm:p-8">
          <p className="flex items-center gap-2 text-sm font-semibold text-glow">
            <Megaphone size={16} aria-hidden />
            {item.kind === "ANNOUNCEMENT" ? t("خبر", "News") : t("عرض", "Offer")}
            {item.endsAt ? <span className="nums text-ink-3">· {t("لغاية", "Until")} {formatDate(item.endsAt, lang)}</span> : null}
          </p>
          <h1 className="text-2xl font-extrabold text-ink sm:text-3xl">{item.title}</h1>
          {item.description ? <p className="whitespace-pre-line leading-8 text-ink-2">{item.description}</p> : null}
          {cta ? (
            <Link href={cta} className={buttonClass("primary", "lg")}>
              {item.ctaLabel || t("التفاصيل", "Details")}
            </Link>
          ) : null}
        </div>
      </article>
    </Container>
  );
}
