import { Check, Crown, Flame } from "lucide-react";

import { formatPrice, type Lang } from "@/src/lib/i18n";
import type { CatalogPackage } from "@/src/server/catalog";

import { Badge } from "./Badge";
import { LinkButton } from "./Button";
import { cn } from "./cn";
import { MARK_SRC } from "./Logo";

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

  const badges = (
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
  );

  return (
    <article
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-panel transition duration-300 hover:-translate-y-0.5",
        highlight ? "surface-raised ring-1 ring-brand/50" : "surface",
      )}
    >
      {highlight ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-8 top-0 z-10 h-px bg-gradient-to-r from-transparent via-glow/80 to-transparent"
        />
      ) : null}

      <PackageArtwork imageUrl={pkg.imageUrl} name={pkg.name} isVip={isVip} raised={highlight} />

      <div className="relative z-10 -mt-11 px-5 sm:px-6">{badges}</div>

      <div className="relative flex flex-1 flex-col px-5 pb-5 pt-4 sm:px-6 sm:pb-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-lg font-bold leading-7 text-ink">{pkg.name}</h3>
            <p className="text-sm text-ink-3">{pkg.durationLabel}</p>
          </div>
          <div className="shrink-0 text-end">
            <p className="flex items-baseline justify-end gap-1.5">
              <span className="nums text-2xl font-bold tracking-tight text-ink sm:text-[28px]" dir="ltr">
                {new Intl.NumberFormat("en-US").format(pkg.price)}
              </span>
              <span className="text-xs font-semibold text-ink-3">{isAr ? "د.ع" : "IQD"}</span>
            </p>
            {monthly && pkg.durationMonths > 1 ? (
              <p className="text-xs text-ink-3">
                {"≈ "}
                <span className="nums">{formatPrice(monthly, lang)}</span>
                {isAr ? " شهريًا" : " / month"}
              </p>
            ) : null}
          </div>
        </div>

        {pkg.description ? (
          <p className="mt-3 line-clamp-2 text-sm leading-6 text-ink-2">{pkg.description}</p>
        ) : null}

        {pkg.features.length ? (
          <ul className="mt-4 space-y-2 border-t border-line pt-4">
            {pkg.features.slice(0, maxFeatures).map((feature) => (
              <li key={feature} className="flex items-start gap-2.5 text-sm leading-6 text-ink-2">
                <Check size={16} className="mt-1 shrink-0 text-glow" aria-hidden />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-auto pt-5">
          <LinkButton href={href} variant={highlight ? "primary" : "secondary"} className="w-full">
            {ctaLabel ?? (isAr ? "اختر هذه الباقة" : "Choose this plan")}
          </LinkButton>
        </div>
      </div>
    </article>
  );
}

/**
 * Package artwork uploaded from the admin package editor. Artwork is often a
 * portrait poster with text in it, so it is shown whole (object-contain) over
 * a blurred copy of itself rather than cropped. Without artwork the frame
 * keeps its size and shows the Shashtna mark.
 */
function PackageArtwork({
  imageUrl,
  name,
  isVip,
  raised,
}: {
  imageUrl: string | null;
  name: string;
  isVip: boolean;
  raised?: boolean;
}) {
  return (
    <div className="relative aspect-[16/10] w-full overflow-hidden bg-surface-2">
      {imageUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt=""
            aria-hidden
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full scale-110 object-cover opacity-50 blur-2xl"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={name}
            loading="lazy"
            decoding="async"
            className="relative h-full w-full object-contain transition duration-500 group-hover:scale-[1.03]"
          />
        </>
      ) : (
        <div
          className={cn(
            "flex h-full w-full items-center justify-center bg-gradient-to-br",
            isVip ? "from-[#0b2a3a] via-[#0a1830] to-[#07101f]" : "from-[#10265e] via-[#0b1733] to-[#07101f]",
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={MARK_SRC} alt="" aria-hidden className="h-24 w-24 object-contain opacity-80" />
        </div>
      )}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t to-transparent",
          raised ? "from-surface-2" : "from-surface",
        )}
      />
    </div>
  );
}
