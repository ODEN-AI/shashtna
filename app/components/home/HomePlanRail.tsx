"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";

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
};

// Placeholder art for a package without an uploaded image: one of a few
// fixed tones, chosen from the slug so a package keeps its colour.
const TONES = ["#ff3d6e", "#2ec8ff", "#4a7dff", "#ff7a1a", "#a35bff", "#29d19b", "#ffd23f", "#ff5ad1"];
const tone = (slug: string) => TONES[[...slug].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % TONES.length];

/**
 * IPTV packages as a row of product cards, filterable by duration. Every
 * name, price, duration and image comes from the catalogue; the "best per
 * month" badge marks the package with the lowest monthly cost.
 */
export function HomePlanRail({ lang, plans }: { lang: Lang; plans: RailPlan[] }) {
  const isAr = lang === "ar";
  const [filter, setFilter] = useState<number | "all">("all");
  const durations = [...new Set(plans.map((plan) => plan.durationMonths))].sort((a, b) => a - b);
  const monthly = (plan: RailPlan) => Math.round(plan.price / Math.max(1, plan.durationMonths));
  const bestId = plans.length > 1 ? plans.reduce((best, plan) => (monthly(plan) < monthly(best) ? plan : best)).id : null;
  const shown = plans.filter((plan) => filter === "all" || plan.durationMonths === filter);

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
        {shown.map((plan) => (
          <Link
            key={plan.id}
            href={`/plans/${encodeURIComponent(plan.slug)}`}
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
              <span className={s.chip}>{formatDuration(plan.durationMonths, lang)}</span>
              <span className={s.chip}>IPTV</span>
            </span>
            <span className={s.planFoot}>
              <span>
                <span className={`${s.price} nums`} data-testid="home-plan-price">
                  {new Intl.NumberFormat("en-US").format(plan.price)}
                  <small>{isAr ? "د.ع" : "IQD"}</small>
                </span>
                <span className={`${s.perMonth} nums`} style={{ display: "block" }}>
                  {isAr ? `≈ ${formatPrice(monthlyEquivalent(plan.price, plan.durationMonths) ?? 0, lang)} بالشهر` : `≈ ${formatPrice(monthlyEquivalent(plan.price, plan.durationMonths) ?? 0, lang)} a month`}
                </span>
              </span>
              <span className={s.planGo} aria-hidden>
                <ArrowLeft size={20} className="ltr:rotate-180" />
              </span>
            </span>
          </Link>
        ))}
      </div>
      <p className={s.note}>{isAr ? "الأسعار بالدينار العراقي، وتطلع نفسها بصفحة الطلب." : "Prices are in Iraqi dinars and are the same at checkout."}</p>
    </section>
  );
}
