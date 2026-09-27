import { Crown, Flame } from "lucide-react";

import { formatPrice, type Lang } from "@/src/lib/i18n";
import type { CatalogPackage } from "@/src/server/catalog";

import { Badge } from "./Badge";
import { cn } from "./cn";
import { FactTiles, FeatureList, PriceBlock, ProductCta, ProductStage, productKind } from "./product/Product";

export function monthlyEquivalent(price: number, months: number) {
  return months > 0 ? Math.round(price / months / 250) * 250 : null;
}

/**
 * A package presented as a product (Shashtna Mobile's product card): the
 * dominant visual band first (admin artwork or the branded emblem), then
 * name and duration, fact tiles, a short value line, benefits, price and one
 * action. Every value comes from the catalogue record.
 */
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
  // Fact tiles: the first specification lines (the duration is already on
  // the visual; it fills in only when there are fewer than two lines). The
  // remaining lines are listed as benefits.
  const tileCount = pkg.features.length >= 3 ? 3 : 2;
  const facts = pkg.features.length >= 2 ? pkg.features.slice(0, tileCount) : [pkg.durationLabel, ...pkg.features];
  const benefits = pkg.features.slice(facts.length, facts.length + Math.max(0, maxFeatures - facts.length));

  return (
    <article
      data-testid="package-card"
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-panel border bg-surface/70 transition duration-300 hover:-translate-y-1",
        highlight
          ? "border-sky/50 shadow-[0_12px_36px_rgb(25_81_252/0.4)] [border-top-color:rgb(203_233_253/0.6)]"
          : "border-line shadow-card [border-top-color:rgb(203_233_253/0.18)] hover:border-line-strong",
      )}
    >
      <ProductStage
        kind={productKind(pkg.serviceType)}
        imageUrl={pkg.imageUrl}
        alt={pkg.name}
        className="aspect-[16/11]"
        top={
          <>
            <Badge tone={isVip ? "warning" : "glow"}>
              {isVip ? <Crown size={12} aria-hidden /> : null}
              {isVip ? "VIP" : "IPTV"}
            </Badge>
            {pkg.isPopular ? (
              <Badge tone="success" dot>
                <Flame size={12} aria-hidden />
                {isAr ? "الأكثر طلبًا" : "Most popular"}
              </Badge>
            ) : null}
          </>
        }
      >
        <h3 className="text-balance text-xl font-bold leading-8 text-white drop-shadow">{pkg.name}</h3>
        <p className="text-sm font-bold text-glow">{pkg.durationLabel}</p>
      </ProductStage>

      <div className="flex flex-1 flex-col gap-4 p-5 sm:p-6">
        <FactTiles facts={facts} />
        {pkg.description ? <p className="line-clamp-2 text-sm leading-6 text-ink-2">{pkg.description}</p> : null}
        <FeatureList features={benefits} max={benefits.length} />

        <div className="mt-auto flex items-end justify-between gap-3 border-t border-line pt-4">
          <PriceBlock
            amount={pkg.price}
            currency={isAr ? "د.ع" : "IQD"}
            note={monthly && pkg.durationMonths > 1 ? `≈ ${formatPrice(monthly, lang)}${isAr ? " شهريًا" : " / month"}` : null}
          />
        </div>
        <ProductCta
          href={href}
          label={ctaLabel ?? (isAr ? "اشترك الآن" : "Subscribe now")}
          emphasis={highlight ? "primary" : "secondary"}
          className="w-full"
        />
      </div>
    </article>
  );
}
