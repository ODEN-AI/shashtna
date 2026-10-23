import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { formatPrice, type Lang } from "@/src/lib/i18n";
import { formatDuration } from "@/src/lib/subscription-duration";
import type { CatalogPackage } from "@/src/server/catalog";

import { distinctHighlights, repeatsDuration } from "./catalogue-text";
import { cn } from "./cn";
import { monthlyEquivalent } from "./PackageCard";

/**
 * A price board: one row per package, so every duration of a service can be
 * compared in one look (duration, per-month, price, action). Used inside a
 * service "chapter" on /plans: IPTV on the cobalt field, VIP on warm black.
 * Values come from the catalogue; nothing here decides a price.
 */
export function PlanBoard({
  packages,
  lang,
  service,
  hrefFor,
  devicesFrom,
}: {
  packages: CatalogPackage[];
  lang: Lang;
  service: "IPTV" | "VIP";
  hrefFor: (pkg: CatalogPackage) => string;
  /** Cheapest compatible device per VIP package id (for the "+ device" note). */
  devicesFrom?: Map<number, number>;
}) {
  const isAr = lang === "ar";
  const isVip = service === "VIP";

  return (
    <ul className={cn("divide-y", isVip ? "divide-vip-line" : "divide-white/20")} data-testid={`plan-board-${service.toLowerCase()}`}>
      {packages.map((pkg) => {
        const monthly = monthlyEquivalent(pkg.price, pkg.durationMonths);
        const deviceFrom = devicesFrom?.get(pkg.id);
        const note = isVip ? distinctHighlights(pkg, 1)[0] ?? (repeatsDuration(pkg.description, pkg) ? null : pkg.description) : null;
        // IPTV rows lead with the duration; the name only adds a line when it
        // says more than the duration (e.g. not "IPTV 3 أشهر").
        const subtitle = isVip ? formatDuration(pkg.durationMonths, lang) : repeatsDuration(pkg.name, pkg) ? null : pkg.name;

        return (
          <li key={pkg.id} className="py-5 sm:py-6" data-testid="package-card">
            <div className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto_auto] md:gap-x-8">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className={cn("text-2xl font-black leading-tight sm:text-[28px]", isVip ? "text-vip" : "text-white")}>
                    {isVip ? <bdi>{pkg.name}</bdi> : formatDuration(pkg.durationMonths, lang)}
                  </span>
                  {pkg.isPopular ? (
                    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", isVip ? "bg-vip text-vip-ink" : "bg-white text-iptv-deep")}>
                      {isAr ? "الأكثر طلبًا" : "Most popular"}
                    </span>
                  ) : null}
                </p>
                {subtitle ? (
                  <p className={cn("mt-1 text-sm", isVip ? "text-vip-text" : "text-iptv-ink")}>
                    <bdi>{subtitle}</bdi>
                    {note ? <span className="hidden sm:inline"> · <bdi>{note}</bdi></span> : null}
                  </p>
                ) : null}
              </div>

              <p className={cn("nums order-3 col-span-2 text-sm md:order-none md:col-span-1", isVip ? "text-vip-text" : "text-iptv-ink")}>
                {isVip
                  ? deviceFrom !== undefined
                    ? isAr
                      ? `+ جهاز يبدأ من ${formatPrice(deviceFrom, lang)}`
                      : `+ device from ${formatPrice(deviceFrom, lang)}`
                    : isAr
                      ? "+ جهاز VIP تختاره عند الطلب"
                      : "+ a VIP device chosen at checkout"
                  : monthly && pkg.durationMonths > 1
                    ? `≈ ${formatPrice(monthly, lang)}${isAr ? " بالشهر" : " / month"}`
                    : null}
                {pkg.renewalPrice !== null && pkg.renewalPrice !== pkg.price ? (
                  <span className="block" data-testid="compare-renewal-price">
                    {isAr ? "التجديد: " : "Renewal: "}
                    {formatPrice(pkg.renewalPrice, lang)}
                  </span>
                ) : null}
              </p>

              <p className="flex items-baseline justify-end gap-1.5 md:justify-start">
                <span className={cn("nums text-[28px] font-black leading-none", isVip ? "text-vip" : "text-white")}>
                  {new Intl.NumberFormat("en-US").format(pkg.price)}
                </span>
                <span className={cn("text-sm font-semibold", isVip ? "text-vip-text" : "text-iptv-ink")}>{isAr ? "د.ع" : "IQD"}</span>
              </p>

              <Link
                href={hrefFor(pkg)}
                aria-label={`${isAr ? "اطلب" : "Order"} ${pkg.name}`}
                className={cn(
                  "order-4 col-span-2 inline-flex h-12 items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold transition-[background-color,transform] duration-150 active:scale-[0.97] md:order-none md:col-span-1",
                  isVip ? "bg-vip text-vip-ink hover:brightness-105" : "bg-white text-iptv-deep hover:bg-iptv-ink",
                )}
              >
                {isVip ? (isAr ? "اختار الجهاز واطلب" : "Pick a device and order") : isAr ? "اطلب" : "Order"}
                <ArrowLeft size={16} className="ltr:rotate-180" aria-hidden />
              </Link>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
