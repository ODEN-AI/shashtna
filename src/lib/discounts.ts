import { planOrderPrice } from "@/src/lib/catalogue";

/**
 * Discounts — pure parts (unit-tested).
 *
 * A discount belongs to one package option (a product at one length): a
 * percentage (1–90) or a fixed amount in whole IQD, rounded down, never below
 * 0. It is active inside its optional [startsAt, endsAt) window until ended.
 * It applies to NEW and UPGRADE orders, and to renewals only when
 * `appliesToRenewals`. A VIP device is always full price. The server is the
 * only source of the price; orders store list price, discount and price.
 */

export const DISCOUNT_KINDS = ["PERCENT", "AMOUNT"] as const;
export type DiscountKind = (typeof DISCOUNT_KINDS)[number];

export const MAX_PERCENT = 90;

export type DiscountRule = {
  id: number;
  kind: DiscountKind;
  value: number;
  appliesToRenewals: boolean;
  startsAt: string | null;
  endsAt: string | null;
  endedAt: string | null;
};

const time = (value: string | null | undefined, fallback: number) => {
  const parsed = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
};

/** When a discount actually stops: its end date or the moment it was ended, whichever is first. */
function effectiveEnd(rule: Pick<DiscountRule, "endsAt" | "endedAt">) {
  return Math.min(time(rule.endsAt, Infinity), time(rule.endedAt, Infinity));
}

export function isActiveAt(rule: Pick<DiscountRule, "startsAt" | "endsAt" | "endedAt">, now = new Date()) {
  const at = now.getTime();

  return time(rule.startsAt, -Infinity) <= at && at < effectiveEnd(rule);
}

/** Not started yet (and not ended): shown in the admin list as scheduled. */
export function isScheduled(rule: Pick<DiscountRule, "startsAt" | "endsAt" | "endedAt">, now = new Date()) {
  return time(rule.startsAt, -Infinity) > now.getTime() && time(rule.startsAt, -Infinity) < effectiveEnd(rule);
}

/** Two discounts' windows share a moment (open ends run forever). */
export function overlaps(a: Pick<DiscountRule, "startsAt" | "endsAt" | "endedAt">, b: Pick<DiscountRule, "startsAt" | "endsAt" | "endedAt">) {
  return time(a.startsAt, -Infinity) < effectiveEnd(b) && time(b.startsAt, -Infinity) < effectiveEnd(a);
}

/** The one discount active for an option now (there is at most one by construction). */
export function activeDiscount<T extends DiscountRule>(rules: T[], now = new Date()) {
  return rules.find((rule) => isActiveAt(rule, now)) ?? null;
}

/** The discount amount on a price, rounded so the customer price is whole IQD rounded down, never below 0. */
export function discountAmount(price: number, rule: Pick<DiscountRule, "kind" | "value">) {
  if (!Number.isInteger(price) || price <= 0) return 0;

  const discounted = rule.kind === "PERCENT" ? Math.floor((price * (100 - rule.value)) / 100) : Math.max(0, price - rule.value);

  return price - Math.max(0, discounted);
}

export function appliesTo(rule: Pick<DiscountRule, "appliesToRenewals">, requestType: string) {
  const type = String(requestType).toUpperCase();

  return type === "NEW" || type === "UPGRADE" || (type === "RENEW" && rule.appliesToRenewals);
}

export type OrderPricing = { listPrice: number; price: number; discountIqd: number; discountId: number | null };

/**
 * The price an order is charged: the list price (planOrderPrice, renewal
 * price on renewals, plus a VIP device) minus the option's active discount on
 * the package part only. Without a discount, listPrice = price.
 */
export function orderPricing(
  option: { price: number; renewalPrice?: number | null },
  requestType: string,
  devicePrice: number | null,
  rule: Pick<DiscountRule, "id" | "kind" | "value" | "appliesToRenewals"> | null,
): OrderPricing {
  const listPrice = planOrderPrice(option, requestType, devicePrice);

  if (!rule || !appliesTo(rule, requestType)) {
    return { listPrice, price: listPrice, discountIqd: 0, discountId: null };
  }

  const packagePart = planOrderPrice(option, requestType, null);
  const discountIqd = discountAmount(packagePart, rule);

  return discountIqd > 0 ? { listPrice, price: listPrice - discountIqd, discountIqd, discountId: rule.id } : { listPrice, price: listPrice, discountIqd: 0, discountId: null };
}

/** «خصم 20%» / «وفّر 2,000 د.ع». */
export function discountBadge(rule: Pick<DiscountRule, "kind" | "value">, saved: number, lang: "ar" | "en") {
  const amount = new Intl.NumberFormat("en-US").format(saved);

  if (rule.kind === "PERCENT") return lang === "ar" ? `خصم ${rule.value}%` : `${rule.value}% off`;

  return lang === "ar" ? `وفّر ${amount} د.ع` : `Save ${amount} IQD`;
}

/** Whole days left until endsAt (rounded up), or null without an end. */
export function daysLeft(endsAt: string | null, now = new Date()) {
  if (!endsAt) return null;

  const ms = Date.parse(endsAt) - now.getTime();

  return Number.isFinite(ms) ? Math.max(0, Math.ceil(ms / 86_400_000)) : null;
}

/** «ينتهي خلال X أيام» with natural Arabic number agreement. */
export function endsInLabel(days: number, lang: "ar" | "en") {
  if (lang === "en") return days <= 0 ? "Ends today" : `Ends in ${days} day${days === 1 ? "" : "s"}`;
  if (days <= 0) return "ينتهي اليوم";
  if (days === 1) return "ينتهي خلال يوم";
  if (days === 2) return "ينتهي خلال يومين";
  if (days <= 10) return `ينتهي خلال ${days} أيام`;

  return `ينتهي خلال ${days} يوم`;
}

// ------------------------------------------------------------------- admin input

export type DiscountInput = { kind: DiscountKind; value: number; appliesToRenewals: boolean; startsAt: string | null; endsAt: string | null };

/** "2026-11-01T10:00" (a datetime-local, Baghdad time) or an ISO instant → ISO; empty → null. */
function parseMoment(value: unknown): string | null | false {
  const text = String(value ?? "").trim();

  if (!text) return null;

  const local = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}))?$/.exec(text);
  const iso = local ? `${local[1]}T${local[2] ?? "00:00"}:00+03:00` : text;
  const at = Date.parse(iso);

  return Number.isFinite(at) ? new Date(at).toISOString() : false;
}

/**
 * Server validation of a discount from the package form. `prices` are the
 * option's normal and renewal prices: a fixed amount must leave a price above
 * zero for each order type it applies to.
 */
export function parseDiscount(input: Record<string, unknown>, prices: { price: number; renewalPrice: number | null }): { ok: true; value: DiscountInput } | { ok: false; error: string } {
  const kind = String(input.kind ?? "").toUpperCase();

  if (kind !== "PERCENT" && kind !== "AMOUNT") return { ok: false, error: "اختر نوع الخصم: نسبة أو مبلغ." };

  const valueText = String(input.value ?? "").replace(/[,\s]/g, "");
  const value = /^\d{1,9}$/.test(valueText) ? Number(valueText) : null;
  const appliesToRenewals = input.appliesToRenewals === true || input.appliesToRenewals === "on" || input.appliesToRenewals === "true";

  if (kind === "PERCENT" && (value === null || value < 1 || value > MAX_PERCENT)) {
    return { ok: false, error: `نسبة الخصم يجب أن تكون رقمًا صحيحًا من 1 إلى ${MAX_PERCENT}.` };
  }

  if (kind === "AMOUNT") {
    const lowest = appliesToRenewals ? Math.min(prices.price, prices.renewalPrice ?? prices.price) : prices.price;

    if (value === null || value < 1 || value >= lowest) {
      return { ok: false, error: "مبلغ الخصم يجب أن يكون رقمًا صحيحًا أقل من سعر المدة." };
    }
  }

  const startsAt = parseMoment(input.startsAt);
  const endsAt = parseMoment(input.endsAt);

  if (startsAt === false || endsAt === false) return { ok: false, error: "تاريخ البداية أو النهاية غير صحيح." };
  if (startsAt && endsAt && Date.parse(endsAt) <= Date.parse(startsAt)) return { ok: false, error: "تاريخ النهاية لازم يكون بعد البداية." };

  return { ok: true, value: { kind, value: value!, appliesToRenewals, startsAt, endsAt } };
}

/** «تصير 4,800 د.ع» — the live preview in the admin form (null when the input isn't valid yet). */
export function previewPrice(price: number, kind: string, value: string) {
  const amount = /^\d{1,9}$/.test(value.trim()) ? Number(value.trim()) : null;

  if (amount === null || (kind !== "PERCENT" && kind !== "AMOUNT")) return null;
  if (kind === "PERCENT" && (amount < 1 || amount > MAX_PERCENT)) return null;
  if (kind === "AMOUNT" && (amount < 1 || amount >= price)) return null;

  return price - discountAmount(price, { kind, value: amount });
}

/** An ISO instant as a Baghdad "YYYY-MM-DDTHH:mm" for a datetime-local field ("" for none). */
export function toBaghdadLocal(iso: string | null) {
  if (!iso) return "";

  const at = Date.parse(iso);

  return Number.isFinite(at) ? new Date(at + 3 * 3_600_000).toISOString().slice(0, 16) : "";
}
