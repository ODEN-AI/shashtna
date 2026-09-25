import { Check, Crown, Flame } from "lucide-react";

import { formatPrice, type Lang } from "@/src/lib/i18n";
import type { CatalogPackage } from "@/src/server/catalog";

import { Badge } from "./Badge";
import { LinkButton } from "./Button";
import { cn } from "./cn";

export function monthlyEquivalent(price: number, months: number) {
  return months > 0 ? Math.round(price / months / 250) * 250 : null;
}

export function PackageCard({
  pkg,
  lang,
  href,
  ctaLabel,
  featured,
  maxFeatures = 5,
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

  return (
    <article
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-panel p-6 transition duration-300 hover:-translate-y-0.5",
        highlight ? "surface-raised ring-1 ring-brand/50" : "surface",
      )}
    >
      {highlight ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-8 -top-px h-px bg-gradient-to-r from-transparent via-glow/80 to-transparent"
        />
      ) : null}

      <div className="flex items-center justify-between gap-2">
        <Badge tone={isVip ? "glow" : "brand"}>
          {isVip ? <Crown size={12} aria-hidden /> : null}
          {isVip ? "VIP" : "IPTV"}
        </Badge>
        {pkg.isPopular ? (
          <Badge tone="warning">
            <Flame size={12} aria-hidden />
            {isAr ? "الأكثر طلبًا" : "Most popular"}
          </Badge>
        ) : null}
      </div>

      <h3 className="mt-5 text-lg font-bold text-ink">{pkg.name}</h3>
      <p className="mt-1 text-sm text-ink-3">{pkg.durationLabel}</p>

      <div className="mt-5 flex items-end gap-2">
        <span className="nums text-3xl font-bold tracking-tight text-ink" dir="ltr">
          {new Intl.NumberFormat("en-US").format(pkg.price)}
        </span>
        <span className="pb-1 text-sm font-semibold text-ink-3">{isAr ? "د.ع" : "IQD"}</span>
      </div>
      {monthly && pkg.durationMonths > 1 ? (
        <p className="mt-1 text-xs text-ink-3">
          {isAr ? "≈ " : "≈ "}
          <span className="nums">{formatPrice(monthly, lang)}</span>
          {isAr ? " شهريًا" : " / month"}
        </p>
      ) : null}

      {pkg.description ? (
        <p className="mt-4 line-clamp-3 text-sm leading-6 text-ink-2">{pkg.description}</p>
      ) : null}

      {pkg.features.length ? (
        <ul className="mt-5 space-y-2.5 border-t border-line pt-5">
          {pkg.features.slice(0, maxFeatures).map((feature) => (
            <li key={feature} className="flex items-start gap-2.5 text-sm leading-6 text-ink-2">
              <Check size={16} className="mt-1 shrink-0 text-glow" aria-hidden />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-auto pt-6">
        <LinkButton href={href} variant={highlight ? "primary" : "secondary"} className="w-full">
          {ctaLabel ?? (isAr ? "اختر هذه الباقة" : "Choose this plan")}
        </LinkButton>
      </div>
    </article>
  );
}
