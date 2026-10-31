import s from "@/app/components/home/home.module.css";
import { discountBadge, endsInLabel } from "@/src/lib/discounts";
import type { Lang } from "@/src/lib/i18n";

export type OptionDeal = { kind: "PERCENT" | "AMOUNT"; value: number; price: number; endsInDays: number | null };

/** «خصم 20%» / «وفّر 2,000 د.ع» and «ينتهي خلال X أيام» for a discounted length. */
export function DealTag({ deal, listPrice, lang, className }: { deal: OptionDeal; listPrice: number; lang: Lang; className?: string }) {
  return (
    <span className={`${s.deal} ${className ?? ""}`} data-testid="deal-tag">
      <span className={`${s.dealBadge} nums`}>{discountBadge(deal, listPrice - deal.price, lang)}</span>
      {deal.endsInDays !== null ? <span className={`${s.dealEnds} nums`}>{endsInLabel(deal.endsInDays, lang)}</span> : null}
    </span>
  );
}

/** The struck-through list price shown before a discounted price. */
export function WasPrice({ price, lang }: { price: number; lang: Lang }) {
  return (
    <del className={`${s.wasPrice} nums`} aria-label={lang === "ar" ? `السعر قبل الخصم ${price}` : `Price before discount ${price}`}>
      {new Intl.NumberFormat("en-US").format(price)}
    </del>
  );
}
