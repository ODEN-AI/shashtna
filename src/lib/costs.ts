import { isValidDurationMonths } from "@/src/lib/subscription-duration";

/**
 * Real costs — pure parts (unit-tested).
 *
 * The owner activates SITE orders (site or direct sales) from his panel with
 * prepaid credit, bought in USD and paid in IQD. The latest credit purchase
 * sets the rate (IQD ÷ credit dollars); an order's cost is its length's credit
 * at that rate, snapshotted when the order completes. SUPPLIER orders are
 * made by the supplier from his own panel: no credit, but the supplier keeps
 * a share of the price. Money is whole IQD; credit is whole US cents.
 * A cost that isn't known stays null — it is never counted as zero.
 */

export const CHANNELS = ["SITE", "SUPPLIER"] as const;
export type Channel = (typeof CHANNELS)[number];

export const MAX_CREDIT_CENTS = 100_000_000; // $1,000,000
export const MAX_IQD = 10_000_000_000;

export function normalizeChannel(value: unknown): Channel {
  return String(value ?? "").trim().toUpperCase() === "SUPPLIER" ? "SUPPLIER" : "SITE";
}

/** "200", "1.5", "0.25" → whole cents; anything else (negative, 3 decimals, text) → null. */
export function dollarsToCents(value: unknown): number | null {
  const text = String(value ?? "").trim();
  const match = /^(\d{1,7})(?:\.(\d{1,2}))?$/.exec(text);

  if (!match) return null;

  return Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0") || 0);
}

export function centsToDollars(cents: number) {
  return (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2);
}

export type CreditPurchaseInput = { purchasedOn: string; creditCents: number; iqdPaid: number; note: string | null };

/** Server validation of a credit purchase from the admin form. */
export function parseCreditPurchase(input: { purchasedOn?: unknown; creditUsd?: unknown; iqdPaid?: unknown; note?: unknown }): { ok: true; value: CreditPurchaseInput } | { ok: false; error: string } {
  const day = String(input.purchasedOn ?? "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(Date.parse(`${day}T00:00:00Z`))) {
    return { ok: false, error: "اختر تاريخ الشراء." };
  }

  const creditCents = dollarsToCents(input.creditUsd);

  if (creditCents === null || creditCents <= 0 || creditCents > MAX_CREDIT_CENTS) {
    return { ok: false, error: "مبلغ الرصيد بالدولار غير صحيح (مثال: 200 أو 12.50)." };
  }

  const iqdText = String(input.iqdPaid ?? "").replace(/[,\s]/g, "");
  const iqdPaid = /^\d{1,11}$/.test(iqdText) ? Number(iqdText) : null;

  if (iqdPaid === null || iqdPaid <= 0 || iqdPaid > MAX_IQD) {
    return { ok: false, error: "المبلغ المدفوع بالدينار يجب أن يكون رقمًا صحيحًا أكبر من صفر." };
  }

  const note = String(input.note ?? "").trim().slice(0, 300) || null;

  return { ok: true, value: { purchasedOn: day, creditCents, iqdPaid, note } };
}

export type RateSource = { id: number; creditCents: number; iqdPaid: number };

/** IQD per credit dollar (for display; costs use the exact fraction). */
export function rateIqdPerUsd(purchase: Pick<RateSource, "creditCents" | "iqdPaid">) {
  return (purchase.iqdPaid * 100) / purchase.creditCents;
}

/** The current rate: the latest purchase by date, then by id. */
export function currentRate<T extends RateSource & { purchasedOn: string }>(purchases: T[]): T | null {
  return [...purchases].sort((a, b) => String(b.purchasedOn).localeCompare(String(a.purchasedOn)) || b.id - a.id)[0] ?? null;
}

/** IQD cost of `creditCents` of credit at a purchase's rate, rounded to the dinar. */
export function creditCostIqd(creditCents: number, purchase: Pick<RateSource, "creditCents" | "iqdPaid">) {
  return Math.round((creditCents * purchase.iqdPaid) / purchase.creditCents);
}

export type CostSnapshot = { creditCostCents: number | null; creditCostIqd: number | null; creditPurchaseId: number | null };

/**
 * What an order stores when it completes. SUPPLIER orders cost no credit (a
 * known zero); a SITE order's cost is unknown when its length has no credit
 * set or no credit purchase is recorded.
 */
export function costSnapshot(channel: Channel, optionCreditCents: number | null | undefined, rate: RateSource | null): CostSnapshot {
  if (channel === "SUPPLIER") return { creditCostCents: 0, creditCostIqd: 0, creditPurchaseId: null };

  if (typeof optionCreditCents !== "number" || !Number.isInteger(optionCreditCents) || optionCreditCents < 0 || !rate) {
    return { creditCostCents: null, creditCostIqd: null, creditPurchaseId: null };
  }

  return { creditCostCents: optionCreditCents, creditCostIqd: creditCostIqd(optionCreditCents, rate), creditPurchaseId: rate.id };
}

/** The package form's credit field: dollars as typed ("1", "0.5") → cents; empty = unknown. */
export function parseCreditCost(value: unknown): { ok: true; value: number | null } | { ok: false } {
  if (value === null || value === undefined || value === "") return { ok: true, value: null };
  if (typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= MAX_CREDIT_CENTS) return { ok: true, value };

  return { ok: false };
}

// ------------------------------------------------------------------- supplier orders

export const SUPPLIER_DEFAULTS = { months: 24, price: 15000, supplierShare: 10000 } as const;

export type SupplierOrderInput = {
  months: number;
  price: number;
  supplierShare: number;
  username: string;
  password: string | null;
  macAddress: string | null;
  subscriptionId: number | null;
};

function wholeIqd(value: unknown) {
  const text = String(value ?? "").replace(/[,\s]/g, "");
  return /^\d{1,11}$/.test(text) ? Number(text) : null;
}

/** Server validation of the "subscription through the supplier" form. */
export function parseSupplierOrder(input: Record<string, unknown>): { ok: true; value: SupplierOrderInput } | { ok: false; error: string } {
  const months = Number(String(input.months ?? "").trim());

  if (!isValidDurationMonths(months)) return { ok: false, error: "المدة يجب أن تكون بين شهر و5 سنوات." };

  const price = wholeIqd(input.price);

  if (price === null || price <= 0 || price > 100_000_000) return { ok: false, error: "السعر يجب أن يكون رقمًا صحيحًا أكبر من صفر." };

  const supplierShare = wholeIqd(input.supplierShare);

  if (supplierShare === null || supplierShare > price) return { ok: false, error: "حصة المورّد يجب أن تكون رقمًا صحيحًا من صفر لحد السعر." };

  const subscriptionText = String(input.subscriptionId ?? "").trim();
  const subscriptionId = subscriptionText ? Number(subscriptionText) : null;

  if (subscriptionId !== null && (!Number.isInteger(subscriptionId) || subscriptionId <= 0)) return { ok: false, error: "الاشتراك المحدد غير صحيح." };

  const username = String(input.username ?? "").trim().slice(0, 120);

  // A renewal keeps the subscription's credentials; a new one needs a username.
  if (subscriptionId === null && !username) return { ok: false, error: "اكتب اسم المستخدم للاشتراك الجديد." };

  return {
    ok: true,
    value: {
      months,
      price,
      supplierShare,
      username,
      password: String(input.password ?? "").trim().slice(0, 200) || null,
      macAddress: String(input.macAddress ?? "").trim().slice(0, 60) || null,
      subscriptionId,
    },
  };
}

// ------------------------------------------------------------------- profit

export type CostedSale = { amount: number; channel: Channel; costIqd: number | null; supplierShareIqd: number | null };

export type ChannelProfit = {
  sales: number;
  revenue: number;
  creditCost: number;
  supplierShare: number;
  /** Revenue − credit cost − supplier share, over sales whose cost is known. */
  netProfit: number;
  unknownCostSales: number;
  unknownCostRevenue: number;
};

function blank(): ChannelProfit {
  return { sales: 0, revenue: 0, creditCost: 0, supplierShare: 0, netProfit: 0, unknownCostSales: 0, unknownCostRevenue: 0 };
}

/**
 * Profit split by channel. A sale with an unknown cost adds to revenue and to
 * the «تكلفة غير معروفة» counters, never to net profit as if it cost nothing.
 */
export function profitByChannel(sales: CostedSale[]) {
  const site = blank();
  const supplier = blank();

  for (const sale of sales) {
    const row = sale.channel === "SUPPLIER" ? supplier : site;
    const share = Math.max(0, sale.supplierShareIqd ?? 0);

    row.sales += 1;
    row.revenue += sale.amount;
    row.supplierShare += share;

    if (sale.costIqd === null) {
      row.unknownCostSales += 1;
      row.unknownCostRevenue += sale.amount;
    } else {
      row.creditCost += sale.costIqd;
      row.netProfit += sale.amount - sale.costIqd - share;
    }
  }

  const total = blank();
  for (const row of [site, supplier]) for (const key of Object.keys(total) as (keyof ChannelProfit)[]) total[key] += row[key];

  return { site, supplier, total };
}
