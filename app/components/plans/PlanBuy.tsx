"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Check } from "lucide-react";

import { monthlyEquivalent } from "@/app/ui/PackageCard";
import { formatPrice, translator, type Lang } from "@/src/lib/i18n";
import { formatDuration } from "@/src/lib/subscription-duration";

import p from "./plan.module.css";

export type BuyOption = { id: number; durationMonths: number; durationLabel: string; price: number; renewalPrice: number | null };

/**
 * The buying part of a plan's page: the lengths it is sold in (when there
 * is more than one), the chosen length's price and renewal price, and
 * "Subscribe now", which opens checkout with this plan and length. The
 * server prices the order again from the catalogue; nothing here is trusted.
 */
export function PlanBuy({
  lang,
  slug,
  options,
  initialId,
  carry,
  isVip,
  deviceFrom,
  hasOthers,
}: {
  lang: Lang;
  slug: string;
  options: BuyOption[];
  initialId: number;
  /** "renew=12" / "upgrade=12" when choosing for an existing subscription. */
  carry: string;
  isVip: boolean;
  deviceFrom: number | null;
  hasOthers: boolean;
}) {
  const t = translator(lang);
  const [selectedId, setSelectedId] = useState(initialId);
  const selected = options.find((option) => option.id === selectedId) ?? options[0];
  const perMonth = monthlyEquivalent(selected.price, selected.durationMonths);
  const orderHref = `/checkout?plan=${encodeURIComponent(slug)}&option=${selected.id}${carry ? `&${carry}` : ""}`;

  return (
    <>
      {options.length > 1 ? (
        <fieldset className={p.lengths}>
          <legend>{t("اختار المدة", "Choose the length")}</legend>
          <div className={p.lengthList}>
            {options.map((option) => {
              const active = option.id === selected.id;

              return (
                <label key={option.id} className={`${p.length} ${active ? p.lengthOn : ""}`} data-testid="plan-option" data-option-id={option.id} data-months={option.durationMonths}>
                  <input
                    type="radio"
                    name="planOption"
                    value={option.id}
                    checked={active}
                    onChange={() => {
                      setSelectedId(option.id);
                      // Keep the choice in the address, so back / reload / sharing keep it.
                      const url = new URL(window.location.href);
                      url.searchParams.set("option", String(option.id));
                      window.history.replaceState(null, "", url);
                    }}
                    className="sr-only"
                  />
                  <span className={p.lengthTick} aria-hidden>
                    {active ? <Check size={14} /> : null}
                  </span>
                  <span className={`${p.lengthName} nums`}>{formatDuration(option.durationMonths, lang)}</span>
                  <span className={`${p.lengthPrice} nums`}>{formatPrice(option.price, lang)}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      <div className={p.priceRow}>
        <span className={`${p.price} nums`} data-testid="plan-price" data-option-id={selected.id}>
          {new Intl.NumberFormat("en-US").format(selected.price)}
          <small>{t("د.ع", "IQD")}</small>
        </span>
        <span className={`${p.perMonth} nums`}>
          {formatDuration(selected.durationMonths, lang)}
          {perMonth && selected.durationMonths > 1 ? t(` · ≈ ${formatPrice(perMonth, lang)} بالشهر`, ` · ≈ ${formatPrice(perMonth, lang)} a month`) : ""}
        </span>
      </div>

      <ul className={p.facts}>
        {isVip && deviceFrom !== null ? (
          <li className="nums">{t(`+ جهاز من ${formatPrice(deviceFrom, lang)}`, `+ device from ${formatPrice(deviceFrom, lang)}`)}</li>
        ) : null}
        {selected.renewalPrice !== null && selected.renewalPrice !== selected.price ? (
          <li className="nums" data-testid="plan-renewal-price">
            {t(`التجديد: ${formatPrice(selected.renewalPrice, lang)}`, `Renewal: ${formatPrice(selected.renewalPrice, lang)}`)}
          </li>
        ) : null}
        <li>{t("الدفع بالتحويل بعد تأكيد الطلب", "Pay by transfer after you confirm")}</li>
      </ul>

      <div className={p.actions}>
        <Link href={orderHref} className={`${p.btn} ${isVip ? p.btnGold : p.btnWhite}`} data-testid="plan-subscribe">
          {t("اشترك الآن", "Subscribe now")}
          <ArrowLeft size={18} className="ltr:rotate-180" aria-hidden />
        </Link>
        {hasOthers ? (
          <a href="#other-plans" className={`${p.btn} ${p.btnGlass}`}>
            {t("باقات ثانية", "Other plans")}
          </a>
        ) : null}
      </div>
    </>
  );
}
