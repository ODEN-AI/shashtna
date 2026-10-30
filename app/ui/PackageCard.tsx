import { ArrowLeft, Check } from "lucide-react";
import Link from "next/link";

import { formatPrice, type Lang } from "@/src/lib/i18n";
import { formatDuration } from "@/src/lib/subscription-duration";
import type { CatalogPackage } from "@/src/server/catalog";

import { cn } from "./cn";

export function monthlyEquivalent(price: number, months: number) {
  return months > 0 ? Math.round(price / months / 250) * 250 : null;
}

/** Specification lines minus the ones that only repeat the duration. */
export function packageHighlights(pkg: Pick<CatalogPackage, "features" | "durationLabel" | "durationMonths">, max: number) {
  const repeats = new Set([pkg.durationLabel, formatDuration(pkg.durationMonths, "ar"), formatDuration(pkg.durationMonths, "en")].map((item) => item.trim()));

  return pkg.features.filter((feature) => feature && !repeats.has(feature.trim())).slice(0, max);
}

/**
 * A package as a compact card: a band in the service's own colour (IPTV
 * cobalt, VIP champagne on warm black) carrying the duration, then the
 * price, up to a few highlights and one action. Every value comes from the
 * catalogue record; the duration is formatted for the reader's language.
 */
export function PackageCard({
  pkg,
  lang,
  href,
  ctaLabel,
  featured,
  maxFeatures = 3,
}: {
  pkg: CatalogPackage;
  lang: Lang;
  href: string;
  ctaLabel?: string;
  featured?: boolean;
  maxFeatures?: number;
}) {
  const isAr = lang === "ar";
  const isVip = pkg.serviceType === "VIP";
  const monthly = monthlyEquivalent(pkg.price, pkg.durationMonths);
  const highlight = featured || pkg.isPopular;
  const highlights = packageHighlights(pkg, maxFeatures);

  return (
    <article
      data-testid="package-card"
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-panel border bg-surface transition-colors duration-200",
        highlight ? (isVip ? "border-vip/60" : "border-brand") : "border-line hover:border-line-strong",
      )}
    >
      <div className={cn("relative px-5 pb-5 pt-4", isVip ? "bg-vip-field text-vip" : "bg-iptv text-white")}>
        {pkg.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={pkg.imageUrl} alt="" aria-hidden loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover opacity-25" />
        ) : null}
        <div className="relative flex items-center justify-between gap-2">
          <span className={cn("text-sm font-bold", isVip ? "text-vip" : "text-iptv-ink")}>{isVip ? "VIP" : "IPTV"}</span>
          {pkg.isPopular ? (
            <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", isVip ? "bg-vip text-vip-ink" : "bg-white text-iptv-deep")}>
              {isAr ? "الأكثر طلبًا" : "Most popular"}
            </span>
          ) : null}
        </div>
        <p className="nums relative mt-5 text-3xl font-black leading-none">{formatDuration(pkg.durationMonths, lang)}</p>
        <h3 dir="auto" className={cn("relative mt-2 text-sm font-semibold", isVip ? "text-vip-text" : "text-iptv-ink")}>{pkg.name}</h3>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-5">
        <div>
          <p className="flex items-baseline gap-1.5">
            <span className="nums text-[28px] font-black leading-none text-ink">{new Intl.NumberFormat("en-US").format(pkg.price)}</span>
            <span className="text-sm font-semibold text-ink-3">{isAr ? "د.ع" : "IQD"}</span>
          </p>
          {monthly && pkg.durationMonths > 1 ? (
            <p className="nums mt-1.5 text-sm text-ink-3">≈ {formatPrice(monthly, lang)}{isAr ? " بالشهر" : " / month"}</p>
          ) : isVip ? (
            <p className="mt-1.5 text-sm text-ink-3">{isAr ? "سعر الباقة، والجهاز تختاره عند الطلب" : "Plan price; you pick the device when ordering"}</p>
          ) : null}
        </div>

        {highlights.length ? (
          <ul className="space-y-2">
            {highlights.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm leading-6 text-ink-2">
                <Check size={15} className={cn("mt-1 shrink-0", isVip ? "text-vip" : "text-brand-ink")} aria-hidden />
                <span dir="auto">{item}</span>
              </li>
            ))}
          </ul>
        ) : null}

        <Link
          href={href}
          className={cn(
            "mt-auto inline-flex h-12 items-center justify-between gap-3 rounded-xl px-4 text-sm font-bold transition-[background-color,transform] duration-150 active:scale-[0.97]",
            isVip ? "bg-vip text-vip-ink hover:brightness-105" : highlight ? "bg-brand text-white hover:bg-brand-strong" : "bg-surface-3 text-ink hover:bg-line-strong",
          )}
        >
          <span>{ctaLabel ?? (isAr ? "اطلب هذي الباقة" : "Order this plan")}</span>
          <ArrowLeft size={17} className="ltr:rotate-180" aria-hidden />
        </Link>
      </div>
    </article>
  );
}
