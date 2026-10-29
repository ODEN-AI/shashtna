"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";

import s from "@/app/components/home/home.module.css";
import { monthlyEquivalent } from "@/app/ui/PackageCard";
import { formatPrice, type Lang } from "@/src/lib/i18n";
import { formatDuration } from "@/src/lib/subscription-duration";

export type PlanCard = {
  id: number;
  name: string;
  slug: string;
  price: number;
  renewalPrice: number | null;
  durationMonths: number;
  imageUrl: string | null;
  href: string;
  /** VIP only: the cheapest compatible device. */
  deviceFrom?: number | null;
};

const monthly = (plan: PlanCard) => Math.round(plan.price / Math.max(1, plan.durationMonths));

/**
 * One service's plans as product cards. IPTV gets a duration filter and a
 * "best per month" badge; VIP cards show the device and renewal prices. The
 * first line of every card is its duration, then the name, price and action.
 */
export function PlanCards({ lang, service, plans, vipArt }: { lang: Lang; service: "IPTV" | "VIP"; plans: PlanCard[]; vipArt: string }) {
  const isAr = lang === "ar";
  const isVip = service === "VIP";
  const [filter, setFilter] = useState<number | "all">("all");
  const durations = [...new Set(plans.map((plan) => plan.durationMonths))].sort((a, b) => a - b);
  const bestId = !isVip && plans.length > 1 ? plans.reduce((best, plan) => (monthly(plan) < monthly(best) ? plan : best)).id : null;
  const shown = plans.filter((plan) => filter === "all" || plan.durationMonths === filter);

  return (
    <>
      {!isVip && durations.length > 1 ? (
        <div className={s.tabs} role="group" aria-label={isAr ? "المدة" : "Duration"} style={{ marginTop: 24 }}>
          <button type="button" className={s.tab} aria-pressed={filter === "all"} onClick={() => setFilter("all")}>
            {isAr ? "الكل" : "All"}
          </button>
          {durations.map((months) => (
            <button key={months} type="button" className={s.tab} aria-pressed={filter === months} onClick={() => setFilter(months)}>
              {formatDuration(months, lang)}
            </button>
          ))}
        </div>
      ) : null}

      <ul className={s.planGrid} data-testid={`plan-board-${service.toLowerCase()}`}>
        {shown.map((plan) => (
          <li key={plan.id} data-testid="package-card" style={{ listStyle: "none" }}>
            <Link
              href={plan.href}
              className={`${s.card} ${s.cardLink} ${s.plan} ${isVip ? s.planVip : ""} ${plan.id === bestId ? s.planBest : ""}`}
            >
              <span className={s.planDuration}>{formatDuration(plan.durationMonths, lang)}</span>
              <span className={`${s.planArt} ${isVip ? s.planArtVip : ""}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={plan.imageUrl ?? (isVip ? vipArt : "/brand/shashtna-mark-256.webp")}
                  alt=""
                  loading="lazy"
                  style={plan.imageUrl || isVip ? undefined : { position: "static", width: 96, height: 96, objectFit: "contain" }}
                />
                {plan.id === bestId ? <span className={s.badge}>{isAr ? "الأوفر بالشهر" : "Best per month"}</span> : null}
              </span>
              <h3 dir="auto">{plan.name}</h3>
              {isVip && plan.deviceFrom ? (
                <span className={s.planMeta}>
                  {isAr ? `+ جهاز من ${formatPrice(plan.deviceFrom, lang)}` : `+ device from ${formatPrice(plan.deviceFrom, lang)}`}
                </span>
              ) : null}
              {isVip && plan.renewalPrice !== null && plan.renewalPrice !== plan.price ? (
                <span className={s.planMeta} data-testid="compare-renewal-price">
                  {isAr ? `التجديد: ${formatPrice(plan.renewalPrice, lang)}` : `Renewal: ${formatPrice(plan.renewalPrice, lang)}`}
                </span>
              ) : null}
              <span className={s.planFoot}>
                <span>
                  <span className={`${s.price} nums`}>
                    {new Intl.NumberFormat("en-US").format(plan.price)}
                    <small>{isAr ? "د.ع" : "IQD"}</small>
                  </span>
                  <span className={`${s.perMonth} nums`} style={{ display: "block" }}>
                    {isAr ? `≈ ${formatPrice(monthlyEquivalent(plan.price, plan.durationMonths) ?? 0, lang)} بالشهر` : `≈ ${formatPrice(monthlyEquivalent(plan.price, plan.durationMonths) ?? 0, lang)} a month`}
                  </span>
                </span>
                <span className={`${s.planGo} ${isVip ? s.planGoVip : ""}`} aria-hidden>
                  <ArrowLeft size={20} className="ltr:rotate-180" />
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
