import { ArrowLeft, Crown, Tv } from "lucide-react";
import Link from "next/link";

import { LinkButton } from "@/app/ui/Button";
import { PackageCard } from "@/app/ui/PackageCard";
import { Container, SectionHeading } from "@/app/ui/Page";
import { EmptyState } from "@/app/ui/States";
import { formatPrice, translator, type Lang } from "@/src/lib/i18n";
import { rankPopular, type CatalogPackage } from "@/src/server/catalog";

function planHref(pkg: CatalogPackage) {
  return `/checkout?plan=${encodeURIComponent(pkg.slug)}`;
}

/**
 * Most-requested plans from the live catalogue: the top IPTV plans plus the
 * top VIP plan, so both services are visible. The full comparison lives on
 * /plans. Cards go straight into the existing checkout flow.
 */
export function HomePlans({ lang, packages }: { lang: Lang; packages: CatalogPackage[] }) {
  const t = translator(lang);
  const iptv = rankPopular(packages.filter((pkg) => pkg.serviceType === "IPTV"), 3);
  const vip = rankPopular(packages.filter((pkg) => pkg.serviceType === "VIP"), 3);
  const picks = vip.length ? [...iptv.slice(0, 2), vip[0]] : iptv.slice(0, 3);
  const shown = picks.length ? picks : rankPopular(packages, 3);
  const from = (list: CatalogPackage[]) => (list.length ? Math.min(...list.map((pkg) => pkg.price)) : null);

  const lanes = [
    { key: "iptv", label: t("باقات IPTV", "IPTV plans"), icon: <Tv size={16} aria-hidden />, from: from(packages.filter((pkg) => pkg.serviceType === "IPTV")) },
    { key: "vip", label: t("باقات VIP", "VIP plans"), icon: <Crown size={16} aria-hidden />, from: from(packages.filter((pkg) => pkg.serviceType === "VIP")) },
  ].filter((lane) => lane.from !== null);

  return (
    <section id="plans" className="scroll-mt-20 py-16 sm:py-20">
      <Container>
        <SectionHeading
          eyebrow={t("الباقات", "Plans")}
          title={t("الباقات الأكثر طلبًا", "The most requested plans")}
          description={t(
            "أسعار واضحة قبل الطلب، مرتبة حسب الاشتراكات الفعلية عندنا.",
            "Clear prices before you order, ranked by real subscriptions.",
          )}
          action={
            <LinkButton href="/plans" variant="ghost">
              {t("قارن كل الباقات", "Compare all plans")}
              <ArrowLeft size={16} className="ltr:rotate-180" aria-hidden />
            </LinkButton>
          }
        />

        {lanes.length ? (
          <ul className="mt-6 flex flex-wrap gap-2.5">
            {lanes.map((lane) => (
              <li key={lane.key}>
                <Link
                  href={`/plans#${lane.key}`}
                  className="inline-flex h-10 items-center gap-2 rounded-full border border-line-strong bg-surface px-4 text-sm font-semibold text-ink-2 transition hover:border-brand/60 hover:text-ink"
                >
                  <span className="text-brand-ink">{lane.icon}</span>
                  {lane.label}
                  <span className="text-ink-3">·</span>
                  <span className="text-xs text-ink-3">
                    {t("من ", "from ")}
                    <span className="nums font-bold text-ink">{formatPrice(lane.from!, lang)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}

        {shown.length ? (
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {shown.map((pkg, index) => (
              <PackageCard
                key={pkg.id}
                pkg={pkg}
                lang={lang}
                href={planHref(pkg)}
                maxFeatures={4}
                featured={index === 0 && !shown.some((item) => item.isPopular)}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            className="mt-10"
            title={t("ماكو باقات منشورة حاليًا", "No plans are published right now")}
            description={t(
              "راح تظهر الباقات هنا أول ما تنشر. تكدر تتواصل ويانا بأي وقت.",
              "Plans will appear here as soon as they're published. You can contact us any time.",
            )}
            action={
              <LinkButton href="/help/contact" variant="secondary">
                {t("تواصل ويانا", "Contact us")}
              </LinkButton>
            }
          />
        )}
      </Container>
    </section>
  );
}
