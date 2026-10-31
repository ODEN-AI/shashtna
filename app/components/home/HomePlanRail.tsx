"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";

import { DealTag, WasPrice, type OptionDeal } from "@/app/components/plans/DealTag";
import { monthlyEquivalent } from "@/app/ui/PackageCard";
import { formatPrice, type Lang } from "@/src/lib/i18n";
import { formatDuration } from "@/src/lib/subscription-duration";

import s from "./home.module.css";

export type RailPlan = {
  id: number;
  name: string;
  slug: string;
  price: number;
  durationMonths: number;
  imageUrl: string | null;
  /** Every length on sale with its price; price / durationMonths above are the default one. */
  options: { id: number; durationMonths: number; price: number; discount?: OptionDeal | null }[];
};

// Placeholder art for a package without an uploaded image: one of a few
// fixed tones, chosen from the slug so a package keeps its colour.
const TONES = ["#ff3d6e", "#2ec8ff", "#4a7dff", "#ff7a1a", "#a35bff", "#29d19b", "#ffd23f", "#ff5ad1"];
const tone = (slug: string) => TONES[[...slug].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % TONES.length];

/**
 * IPTV packages as a row of product cards, filterable by any length on
 * sale (a card filtered to a length shows that length's price and opens the
 * plan with it chosen). Every name, price, length and image comes from the
 * catalogue; the "best per month" badge marks the lowest monthly cost.
 */
export function HomePlanRail({ lang, plans }: { lang: Lang; plans: RailPlan[] }) {
  const isAr = lang === "ar";
  const [filter, setFilter] = useState<number | "all">("all");
  const durations = [...new Set(plans.flatMap((plan) => plan.options.map((option) => option.durationMonths)))].sort((a, b) => a - b);
  type Item = { plan: RailPlan; months: number; price: number; optionId: number | null; several: boolean; deal: OptionDeal | null };
  const shown = plans.flatMap((plan): Item[] => {
    if (filter === "all") return [{ plan, months: plan.durationMonths, price: plan.price, optionId: null, several: plan.options.length > 1, deal: plan.options[0]?.discount ?? null }];
    const option = plan.options.find((item) => item.durationMonths === filter);
    return option ? [{ plan, months: option.durationMonths, price: option.price, optionId: plan.options.length > 1 ? option.id : null, several: false, deal: option.discount ?? null }] : [];
  });
  const monthly = (item: Item) => Math.round((item.deal?.price ?? item.price) / Math.max(1, item.months));
  const bestId = shown.length > 1 ? shown.reduce((best, item) => (monthly(item) < monthly(best) ? item : best)).plan.id : null;

  if (!plans.length) {
    return null;
  }

  return (
    <section className={`${s.wrap} ${s.sectionTight}`} id="plans" aria-labelledby="home-plans-title">
      <div className={s.plansHead}>
        <div>
          <p className={s.kicker}>{isAr ? "الباقات والأسعار" : "Plans and prices"}</p>
          <h2 id="home-plans-title" className={s.h2}>
            {isAr ? "اختار باقة IPTV" : "Choose an IPTV plan"}
          </h2>
        </div>
        {durations.length > 1 ? (
          <div className={s.tabs} role="group" aria-label={isAr ? "المدة" : "Duration"}>
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
      </div>

      <div className={s.rail} data-testid="home-plan-rail">
        {shown.map(({ plan, months, price: listPrice, optionId, several, deal }) => {
          const price = deal?.price ?? listPrice;

          return (

          <Link
            key={plan.id}
            href={`/plans/${encodeURIComponent(plan.slug)}${optionId ? `?option=${optionId}` : ""}`}
            className={`${s.card} ${s.cardLink} ${s.plan} ${plan.id === bestId ? s.planBest : ""}`}
            data-testid="home-plan-card"
          >
            {plan.id === bestId ? <span className={s.badge}>{isAr ? "الأوفر بالشهر" : "Best per month"}</span> : null}
            <span
              className={s.planArt}
              style={
                plan.imageUrl
                  ? undefined
                  : { background: `radial-gradient(90% 90% at 50% 100%, ${tone(plan.slug)}88, transparent 70%), linear-gradient(160deg, #10204f, #060d27)` }
              }
            >
              {plan.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={plan.imageUrl} alt="" loading="lazy" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src="/brand/shashtna-mark-256.webp" alt="" width={96} height={96} style={{ position: "static", width: 96, height: 96, objectFit: "contain" }} />
              )}
            </span>
            <h3 dir="auto" data-testid="home-plan-name">
              {plan.name}
            </h3>
            <span className={s.planChips}>
              <span className={s.chip}>{several ? (isAr ? `${plan.options.length} مدد` : `${plan.options.length} lengths`) : formatDuration(months, lang)}</span>
              <span className={s.chip}>IPTV</span>
            </span>
            <span className={s.planFoot}>
              <span>
                {deal ? <DealTag deal={deal} listPrice={listPrice} lang={lang} className="mb-1.5" /> : null}
                <span className={`${s.price} nums`} data-testid="home-plan-price">
                  {several ? <small>{isAr ? "من " : "from "}</small> : null}
                  {deal ? <WasPrice price={listPrice} lang={lang} /> : null}
                  {new Intl.NumberFormat("en-US").format(price)}
                  <small>{isAr ? "د.ع" : "IQD"}</small>
                </span>
                <span className={`${s.perMonth} nums`} style={{ display: "block" }}>
                  {isAr ? `≈ ${formatPrice(monthlyEquivalent(price, months) ?? 0, lang)} بالشهر` : `≈ ${formatPrice(monthlyEquivalent(price, months) ?? 0, lang)} a month`}
                </span>
              </span>
              <span className={s.planGo} aria-hidden>
                <ArrowLeft size={20} className="ltr:rotate-180" />
              </span>
            </span>
          </Link>
          );
        })}
      </div>
      <p className={s.note}>{isAr ? "الأسعار بالدينار العراقي، وتطلع نفسها بصفحة الطلب." : "Prices are in Iraqi dinars and are the same at checkout."}</p>
    </section>
  );
}
