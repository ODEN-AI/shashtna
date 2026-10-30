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
  /** Every length on sale with its price; the fields above are the default one. */
  options: { id: number; durationMonths: number; price: number; renewalPrice: number | null }[];
};

type Shown = { plan: PlanCard; option: PlanCard["options"][number] | null; price: number; renewalPrice: number | null; durationMonths: number };

const monthly = (card: Shown) => Math.round(card.price / Math.max(1, card.durationMonths));

/**
 * One service's plans as product cards. IPTV gets a length filter over
 * every length on sale and a "best per month" badge; VIP cards show the
 * device and renewal prices. The first line of every card is its length (or
 * its lengths), then the name, price and action. A card filtered to one
 * length shows that length's price and opens the plan with it chosen.
 */
export function PlanCards({ lang, service, plans, vipArt }: { lang: Lang; service: "IPTV" | "VIP"; plans: PlanCard[]; vipArt: string }) {
  const isAr = lang === "ar";
  const isVip = service === "VIP";
  const [filter, setFilter] = useState<number | "all">("all");
  const durations = [...new Set(plans.flatMap((plan) => plan.options.map((option) => option.durationMonths)))].sort((a, b) => a - b);
  const shown: Shown[] = plans.flatMap((plan): Shown[] => {
    if (filter === "all") return [{ plan, option: null, price: plan.price, renewalPrice: plan.renewalPrice, durationMonths: plan.durationMonths }];
    const option = plan.options.find((item) => item.durationMonths === filter);
    return option ? [{ plan, option, price: option.price, renewalPrice: option.renewalPrice, durationMonths: option.durationMonths }] : [];
  });
  const bestId = !isVip && shown.length > 1 ? shown.reduce((best, card) => (monthly(card) < monthly(best) ? card : best)).plan.id : null;
  const linkFor = (card: Shown) =>
    card.option && card.plan.options.length > 1
      ? `${card.plan.href}${card.plan.href.includes("?") ? "&" : "?"}option=${card.option.id}`
      : card.plan.href;

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
        {shown.map((card) => {
          const { plan } = card;
          const several = plan.options.length > 1 && !card.option;

          return (
          <li key={plan.id} data-testid="package-card" style={{ listStyle: "none" }}>
            <Link
              href={linkFor(card)}
              className={`${s.card} ${s.cardLink} ${s.plan} ${isVip ? s.planVip : ""} ${plan.id === bestId ? s.planBest : ""}`}
            >
              <span className={s.planDuration}>
                {several
                  ? `${formatDuration(plan.options[0].durationMonths, lang)} – ${formatDuration(plan.options[plan.options.length - 1].durationMonths, lang)}`
                  : formatDuration(card.durationMonths, lang)}
              </span>
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
              {several ? (
                <span className={s.planMeta} data-testid="package-card-lengths">
                  {isAr ? `${plan.options.length} مدد، كل مدة بسعرها` : `${plan.options.length} lengths, each with its price`}
                </span>
              ) : null}
              {isVip && plan.deviceFrom ? (
                <span className={s.planMeta}>
                  {isAr ? `+ جهاز من ${formatPrice(plan.deviceFrom, lang)}` : `+ device from ${formatPrice(plan.deviceFrom, lang)}`}
                </span>
              ) : null}
              {isVip && card.renewalPrice !== null && card.renewalPrice !== card.price ? (
                <span className={s.planMeta} data-testid="compare-renewal-price">
                  {isAr ? `التجديد: ${formatPrice(card.renewalPrice, lang)}` : `Renewal: ${formatPrice(card.renewalPrice, lang)}`}
                </span>
              ) : null}
              <span className={s.planFoot}>
                <span>
                  <span className={`${s.price} nums`}>
                    {several ? <small>{isAr ? "من " : "from "}</small> : null}
                    {new Intl.NumberFormat("en-US").format(card.price)}
                    <small>{isAr ? "د.ع" : "IQD"}</small>
                  </span>
                  <span className={`${s.perMonth} nums`} style={{ display: "block" }}>
                    {isAr ? `≈ ${formatPrice(monthlyEquivalent(card.price, card.durationMonths) ?? 0, lang)} بالشهر` : `≈ ${formatPrice(monthlyEquivalent(card.price, card.durationMonths) ?? 0, lang)} a month`}
                  </span>
                </span>
                <span className={`${s.planGo} ${isVip ? s.planGoVip : ""}`} aria-hidden>
                  <ArrowLeft size={20} className="ltr:rotate-180" />
                </span>
              </span>
            </Link>
          </li>
          );
        })}
      </ul>
    </>
  );
}
