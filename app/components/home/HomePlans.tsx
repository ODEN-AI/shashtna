import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { LinkButton } from "@/app/ui/Button";
import { distinctLines, repeatsDuration } from "@/app/ui/catalogue-text";
import { cn } from "@/app/ui/cn";
import { monthlyEquivalent } from "@/app/ui/PackageCard";
import { Container, SectionHeading } from "@/app/ui/Page";
import { EmptyState } from "@/app/ui/States";
import { formatPrice, translator, type Lang } from "@/src/lib/i18n";
import { formatDuration } from "@/src/lib/subscription-duration";
import { rankPopular, type CatalogDevice, type CatalogPackage } from "@/src/server/catalog";

function planHref(pkg: CatalogPackage) {
  return `/checkout?plan=${encodeURIComponent(pkg.slug)}`;
}

/**
 * Most-requested plans from the live catalogue: the top IPTV plans plus the
 * top VIP plan, so both services are visible. The full comparison lives on
 * /plans. Cards go straight into the existing checkout flow.
 *
 * The cards here are the homepage's own (the shared PackageCard is left as
 * it is for the admin preview): each shows the package name, its duration
 * once, the price and up to three highlights, without repeating any of them.
 */
export function HomePlans({ lang, packages, devices }: { lang: Lang; packages: CatalogPackage[]; devices: CatalogDevice[] }) {
  const t = translator(lang);
  const iptv = rankPopular(packages.filter((pkg) => pkg.serviceType === "IPTV"), 3);
  const vip = rankPopular(packages.filter((pkg) => pkg.serviceType === "VIP"), 3);
  const picks = vip.length ? [...iptv.slice(0, 2), vip[0]] : iptv.slice(0, 3);
  const shown = picks.length ? picks : rankPopular(packages, 3);

  // Cheapest active device that works with each VIP package (display only).
  const deviceFrom = (pkg: CatalogPackage) => {
    const prices = devices.filter((device) => device.packageIds.includes(pkg.id)).map((device) => device.price);
    return prices.length ? Math.min(...prices) : null;
  };

  return (
    <section id="plans" className="scroll-mt-20 py-12 sm:py-20">
      <Container>
        <SectionHeading
          title={t("الباقات الأكثر طلبًا", "The most requested plans")}
          description={t(
            "أسعار واضحة قبل الطلب، مرتبة حسب الاشتراكات الفعلية عندنا.",
            "Clear prices before you order, ranked by real subscriptions.",
          )}
          action={
            <LinkButton href="/plans" variant="secondary">
              {t("كل الباقات والمقارنة", "All plans and comparison")}
              <ArrowLeft size={16} className="ltr:rotate-180" aria-hidden />
            </LinkButton>
          }
        />

        {shown.length ? (
          <ul className="mt-6 grid gap-3 md:mt-8 md:grid-cols-3 md:gap-5" data-testid="home-plans">
            {shown.map((pkg, index) => (
              <li key={pkg.id}>
                <HomePlanCard
                  pkg={pkg}
                  lang={lang}
                  featured={index === 0 && !shown.some((item) => item.isPopular)}
                  deviceFrom={pkg.serviceType === "VIP" ? deviceFrom(pkg) : null}
                />
              </li>
            ))}
          </ul>
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

/**
 * One package on the homepage. The headline is the package name, or its
 * duration when the name only says the duration ("IPTV 3 أشهر"); the
 * duration then appears once, under a distinct name only. Description and
 * specification lines that repeat the headline or the duration are skipped.
 */
function HomePlanCard({
  pkg,
  lang,
  featured,
  deviceFrom,
}: {
  pkg: CatalogPackage;
  lang: Lang;
  featured: boolean;
  deviceFrom: number | null;
}) {
  const t = translator(lang);
  const isVip = pkg.serviceType === "VIP";
  const duration = formatDuration(pkg.durationMonths, lang);
  const nameIsDuration = repeatsDuration(pkg.name, pkg);
  const headline = nameIsDuration ? duration : pkg.name;
  const monthly = monthlyEquivalent(pkg.price, pkg.durationMonths);
  // The duration is always on the card (as the headline or under it), so
  // lines that only repeat it, or the headline, or each other, go.
  const kept = distinctLines([pkg.description || null, ...pkg.features], headline, pkg);
  const description = pkg.description && kept[0] === pkg.description.trim() ? kept[0] : null;
  const highlights = (description ? kept.slice(1) : kept).slice(0, 3);

  return (
    <article
      data-testid="home-plan-card"
      className={cn(
        "flex h-full flex-col overflow-hidden rounded-panel border bg-surface",
        isVip ? "border-vip-line" : featured || pkg.isPopular ? "border-brand" : "border-line",
      )}
    >
      <div className={cn("px-4 pb-3 pt-3 md:px-5 md:pb-5 md:pt-4", isVip ? "bg-vip-field text-vip" : "bg-iptv text-white")}>
        <div className="flex items-center justify-between gap-2">
          <span className={cn("text-sm font-bold", isVip ? "text-vip-text" : "text-iptv-ink")}>{pkg.serviceType}</span>
          {pkg.isPopular ? (
            <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", isVip ? "bg-vip text-vip-ink" : "bg-white text-iptv-deep")}>
              {t("الأكثر طلبًا", "Most popular")}
            </span>
          ) : null}
        </div>
        <h3 dir="auto" className="mt-2 text-xl font-black leading-tight md:mt-4 md:text-2xl" data-testid="home-plan-name">
          {headline}
        </h3>
        {nameIsDuration ? null : (
          <p className={cn("nums mt-1 text-sm", isVip ? "text-vip-text" : "text-iptv-ink")} data-testid="home-plan-duration">
            {duration}
          </p>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4 md:gap-4 md:p-5">
        {/* Phones: an IPTV card puts its price and its order button on one row
            (wrapping on very narrow screens). From md up, and for VIP, the
            row dissolves and the card keeps its column layout. */}
        <div className={cn(isVip ? "contents" : "flex flex-wrap items-center justify-between gap-3 md:contents")}>
        <div>
          <p className="flex items-baseline gap-1.5">
            <span className="nums text-[28px] font-black leading-none text-ink" data-testid="home-plan-price">
              {new Intl.NumberFormat("en-US").format(pkg.price)}
            </span>
            <span className="text-sm font-semibold text-ink-3">{t("د.ع", "IQD")}</span>
          </p>
          {isVip ? (
            <p className="nums mt-1.5 text-sm text-ink-3">
              {deviceFrom !== null
                ? t(`+ جهاز VIP يبدأ من ${formatPrice(deviceFrom, lang)}`, `+ a VIP device from ${formatPrice(deviceFrom, lang)}`)
                : t("+ جهاز VIP تختاره عند الطلب", "+ a VIP device chosen at checkout")}
            </p>
          ) : monthly && pkg.durationMonths > 1 ? (
            <p className="nums mt-1.5 text-sm text-ink-3">≈ {formatPrice(monthly, lang)}{t(" بالشهر", " / month")}</p>
          ) : null}
        </div>

        <Link
          href={planHref(pkg)}
          className={cn(
            "inline-flex items-center gap-3 rounded-xl px-4 text-sm font-bold transition-[background-color,transform] duration-150 active:scale-[0.97] md:order-last md:mt-auto md:h-12 md:w-full md:justify-between",
            isVip ? "order-last mt-auto h-12 w-full justify-between bg-vip text-vip-ink hover:brightness-105" : "h-11 justify-center bg-brand text-white hover:bg-brand-strong",
          )}
        >
          <span>{isVip ? t("اختار الجهاز واطلب", "Pick a device and order") : t("اطلب هذي الباقة", "Order this plan")}</span>
          <ArrowLeft size={17} className="ltr:rotate-180" aria-hidden />
        </Link>
        </div>

        {description ? <p dir="auto" className="text-sm leading-6 text-ink-2">{description}</p> : null}
        {highlights.length ? (
          <ul className="flex flex-wrap gap-2">
            {highlights.map((line) => (
              <li key={line} dir="auto" className="rounded-lg bg-surface-3 px-2.5 py-1 text-sm text-ink-2">
                {line}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </article>
  );
}
