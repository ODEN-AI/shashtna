import { isValidPrice, parseRenewalPrice } from "@/src/lib/catalogue";
import { parsePointsEarned } from "@/src/lib/loyalty";
import { formatDurationAr, parseDuration, type DurationUnit } from "@/src/lib/subscription-duration";

/**
 * Package options — pure parts (unit-tested).
 *
 * A package (IPTV 4K, VIP Premium, …) is sold in one or more lengths, each
 * with its own price and optional renewal price: its options. Orders store
 * the chosen option's length and price as a snapshot, so editing or removing
 * an option never changes past orders, receipts or subscriptions.
 *
 * The package's own price / renewalPrice / duration* columns mirror its
 * default option (the shortest active one), so readers that know nothing
 * about options (older app builds, reports) keep seeing a real, sellable
 * length and price.
 */

/** The most lengths one package may offer. */
export const MAX_PACKAGE_OPTIONS = 12;

/** VIP packages are sold for exactly this length (renewals and activation rely on it). */
export const VIP_DURATION_MONTHS = 3;

export type PackageOption = {
  id: number;
  durationMonths: number;
  durationUnit: string;
  durationLabel: string;
  price: number;
  renewalPrice: number | null;
  /** Loyalty points an order of this length earns (null = automatic: price ÷ 1,000). */
  pointsEarned?: number | null;
  isActive: boolean;
};

/** An option as the admin form sends it; `id` is set for an option that already exists. */
export type ParsedOption = {
  id: number | null;
  durationMonths: number;
  durationUnit: DurationUnit;
  durationLabel: string;
  price: number;
  renewalPrice: number | null;
  /** Loyalty points override; null = automatic, undefined = not sent (keep what is stored). */
  pointsEarned?: number | null;
  isActive: boolean;
};

type Fail = { ok: false; error: string };

function positiveId(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

/**
 * Validates the options sent with a package. Every value is checked on the
 * server: whole numbers only (strings and fractions are rejected, never
 * coerced), lengths of 1 month to 5 years, no two options with the same
 * length, at least one active option. A VIP package has exactly one option,
 * always three months.
 */
export function parsePackageOptions(raw: unknown, serviceType: "IPTV" | "VIP"): { ok: true; options: ParsedOption[] } | Fail {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { ok: false, error: "أضف مدة واحدة على الأقل مع سعرها." };
  }

  if (raw.length > MAX_PACKAGE_OPTIONS) {
    return { ok: false, error: `أقصى عدد للمدد في الباقة الواحدة ${MAX_PACKAGE_OPTIONS}.` };
  }

  if (serviceType === "VIP" && raw.length !== 1) {
    return { ok: false, error: "باقات VIP مدتها 3 أشهر فقط: مدة واحدة لكل باقة." };
  }

  const options: ParsedOption[] = [];

  for (const [index, item] of raw.entries()) {
    const row = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    const position = `المدة ${index + 1}`;
    const id = row.id === undefined || row.id === null ? null : positiveId(row.id);

    if (row.id !== undefined && row.id !== null && id === null) {
      return { ok: false, error: `${position}: معرّف غير صحيح.` };
    }

    let durationMonths: number = VIP_DURATION_MONTHS;
    let durationUnit: DurationUnit = "MONTH";

    if (serviceType === "IPTV") {
      const duration = parseDuration(row.durationValue, row.durationUnit);
      if (!duration.ok) return { ok: false, error: `${position}: ${duration.error}` };
      durationMonths = duration.months;
      durationUnit = duration.unit;
    }

    if (!isValidPrice(row.price)) {
      return { ok: false, error: `${position}: السعر غير صحيح.` };
    }

    const renewal = parseRenewalPrice(row.renewalPrice);
    if (!renewal.ok) return { ok: false, error: `${position}: سعر التجديد غير صحيح.` };

    const points = row.pointsEarned === undefined ? undefined : parsePointsEarned(row.pointsEarned);
    if (points && !points.ok) return { ok: false, error: `${position}: نقاط الطلب يجب أن تكون رقمًا صحيحًا من 0 إلى 100000، أو فارغة.` };

    if (row.isActive !== undefined && typeof row.isActive !== "boolean") {
      return { ok: false, error: `${position}: حالة المدة غير صحيحة.` };
    }

    const label = typeof row.durationLabel === "string" ? row.durationLabel.trim().slice(0, 40) : "";

    options.push({
      id,
      durationMonths,
      durationUnit,
      durationLabel: label || formatDurationAr(durationMonths),
      price: row.price,
      renewalPrice: renewal.value,
      // VIP never earns points (v1): its override is always cleared.
      ...(serviceType === "VIP" ? { pointsEarned: null } : points ? { pointsEarned: points.value } : {}),
      isActive: row.isActive ?? true,
    });
  }

  const months = options.map((option) => option.durationMonths);
  if (new Set(months).size !== months.length) {
    return { ok: false, error: "لا يمكن تكرار نفس المدة مرتين في الباقة." };
  }

  const ids = options.map((option) => option.id).filter((id): id is number => id !== null);
  if (new Set(ids).size !== ids.length) {
    return { ok: false, error: "نفس المدة مكررة في الطلب." };
  }

  if (!options.some((option) => option.isActive)) {
    return { ok: false, error: "فعّل مدة واحدة على الأقل حتى تقدر تبيع الباقة." };
  }

  return { ok: true, options };
}

/** Shortest first, then cheaper, then older — the order customers read them in. */
export function sortOptions<T extends { durationMonths: number; price: number; id?: number | null }>(options: T[]) {
  return [...options].sort((a, b) => a.durationMonths - b.durationMonths || a.price - b.price || (a.id ?? 0) - (b.id ?? 0));
}

/** The option a package is sold in when no length is chosen: its shortest active one. */
export function defaultOption<T extends { durationMonths: number; price: number; isActive: boolean; id?: number | null }>(options: T[]): T | null {
  return sortOptions(options.filter((option) => option.isActive))[0] ?? null;
}

/** The package columns that mirror its default option. */
export function packageMirror(option: { price: number; renewalPrice: number | null; durationMonths: number; durationUnit: string; durationLabel: string }) {
  return {
    price: option.price,
    renewalPrice: option.renewalPrice,
    durationMonths: option.durationMonths,
    durationUnit: option.durationUnit,
    durationLabel: option.durationLabel,
  };
}

/**
 * The option an order is priced from. A requested option must be one of this
 * package's active options; anything else (another package's option, an
 * inactive or removed one, a malformed id) is refused rather than replaced,
 * so the customer never pays for a length they didn't choose. Without a
 * request (older app builds, old links) the package's default option is used.
 */
export function resolveOrderOption<T extends { id: number; durationMonths: number; price: number; isActive: boolean }>(
  options: T[],
  requested: unknown,
): { ok: true; option: T } | Fail {
  const hasRequest = requested !== undefined && requested !== null && requested !== "";

  if (hasRequest) {
    const id = Number(requested);
    const option = Number.isInteger(id) && id > 0 ? options.find((item) => item.id === id && item.isActive) : undefined;

    return option ? { ok: true, option } : { ok: false, error: "مدة الاشتراك المختارة غير متاحة. اختر المدة من جديد." };
  }

  const fallback = defaultOption(options);

  return fallback ? { ok: true, option: fallback } : { ok: false, error: "الباقة المحددة غير متاحة حاليًا." };
}

/** Reads an option id from a URL or form value; null when absent or malformed. */
export function optionIdParam(value: unknown) {
  const id = Number(Array.isArray(value) ? value[0] : value);

  return Number.isInteger(id) && id > 0 ? id : null;
}
