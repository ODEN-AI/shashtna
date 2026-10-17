/**
 * Subscription durations — pure parts (unit-tested).
 *
 * A package's length is stored canonically as `durationMonths` (what orders,
 * receipts and the activation engine already use). Admins enter it as a value
 * plus a unit (months or years); `durationUnit` only remembers how it was
 * entered so the form shows "2 years" rather than "24 months". Days are not a
 * unit: subscription expiry is calendar-month based end to end.
 */

export const DURATION_UNITS = ["MONTH", "YEAR"] as const;
export type DurationUnit = (typeof DURATION_UNITS)[number];

/** Longest sellable package / renewal: five years. */
export const MAX_DURATION_MONTHS = 60;

export function normalizeDurationUnit(value: unknown): DurationUnit {
  return String(value ?? "").trim().toUpperCase() === "YEAR" ? "YEAR" : "MONTH";
}

export function isValidDurationMonths(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= MAX_DURATION_MONTHS;
}

/**
 * Validates an admin-entered duration. The value must be a whole number (a
 * string, fraction, zero or negative is rejected, never coerced) and the total
 * must be between 1 month and five years.
 */
export function parseDuration(value: unknown, unit: unknown): { ok: true; months: number; unit: DurationUnit } | { ok: false; error: string } {
  const rawUnit = String(unit ?? "MONTH").trim().toUpperCase();

  if (!(DURATION_UNITS as readonly string[]).includes(rawUnit)) {
    return { ok: false, error: "وحدة المدة غير صحيحة (أشهر أو سنوات)." };
  }

  const durationUnit = rawUnit as DurationUnit;

  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    return { ok: false, error: "مدة الاشتراك يجب أن تكون رقمًا صحيحًا أكبر من صفر." };
  }

  const months = durationUnit === "YEAR" ? value * 12 : value;

  if (months > MAX_DURATION_MONTHS) {
    return { ok: false, error: "أقصى مدة للباقة 5 سنوات (60 شهرًا)." };
  }

  return { ok: true, months, unit: durationUnit };
}

/** The value to show in the form for a stored package (falls back to months when years don't divide evenly). */
export function durationValue(months: number, unit: unknown): { value: number; unit: DurationUnit } {
  return normalizeDurationUnit(unit) === "YEAR" && months % 12 === 0 ? { value: months / 12, unit: "YEAR" } : { value: months, unit: "MONTH" };
}

/** Arabic duration with correct number agreement: شهر واحد، شهران، 3 أشهر، 11 شهرًا، سنة واحدة، سنتان، 3 سنوات. */
export function formatDurationAr(months: number) {
  if (months > 0 && months % 12 === 0) {
    const years = months / 12;

    if (years === 1) return "سنة واحدة";
    if (years === 2) return "سنتان";
    if (years <= 10) return `${years} سنوات`;
    return `${years} سنة`;
  }

  if (months === 1) return "شهر واحد";
  if (months === 2) return "شهران";
  if (months >= 3 && months <= 10) return `${months} أشهر`;
  return `${months} شهرًا`;
}

export function formatDurationEn(months: number) {
  if (months > 0 && months % 12 === 0) {
    const years = months / 12;
    return years === 1 ? "1 year" : `${years} years`;
  }

  return months === 1 ? "1 month" : `${months} months`;
}

export function formatDuration(months: number, lang: "ar" | "en") {
  return lang === "ar" ? formatDurationAr(months) : formatDurationEn(months);
}

/** Price per month, rounded to whole dinars (for comparing packages). */
export function monthlyPrice(price: number, months: number) {
  return months > 0 ? Math.round(price / months) : price;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

/**
 * Adds calendar months to a YYYY-MM-DD date. A day that doesn't exist in the
 * target month is clamped to its last day (31 Aug + 6 months = 28/29 Feb), so
 * a subscription never gains extra days by spilling into the next month.
 * Returns null for an invalid date or a non-positive / non-integer month count.
 */
export function addMonthsClamped(dateOnly: string, months: number) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateOnly ?? "").slice(0, 10));

  if (!match || !Number.isInteger(months) || months <= 0) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);

  if (month > 11 || day < 1 || day > new Date(Date.UTC(year, month + 1, 0)).getUTCDate()) {
    return null;
  }

  const targetMonthIndex = month + months;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const targetMonth = targetMonthIndex % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();

  return `${targetYear}-${pad(targetMonth + 1)}-${pad(Math.min(day, lastDay))}`;
}

/**
 * The duration fields of a package write (create or edit), validated on the
 * server. Accepts the form's `durationValue` + `durationUnit`, or the older
 * `durationMonths` alone (months). VIP packages keep the existing rule: three
 * months. An empty label becomes the Arabic duration ("6 أشهر", "سنتان").
 */
export function resolvePackageDuration(
  body: { durationValue?: unknown; durationUnit?: unknown; durationMonths?: unknown; durationLabel?: unknown },
  serviceType: "IPTV" | "VIP",
): { ok: true; durationMonths: number; durationUnit: DurationUnit; durationLabel: string } | { ok: false; error: string } {
  if (serviceType === "VIP") {
    return { ok: true, durationMonths: 3, durationUnit: "MONTH", durationLabel: formatDurationAr(3) };
  }

  const hasUnit = body.durationUnit !== undefined && body.durationUnit !== null && body.durationUnit !== "";
  const parsed = parseDuration(hasUnit ? (body.durationValue ?? body.durationMonths) : body.durationMonths, hasUnit ? body.durationUnit : "MONTH");

  if (!parsed.ok) return parsed;

  const label = typeof body.durationLabel === "string" ? body.durationLabel.trim().slice(0, 40) : "";

  return { ok: true, durationMonths: parsed.months, durationUnit: parsed.unit, durationLabel: label || formatDurationAr(parsed.months) };
}

/** True when the request carries any duration field (an edit may leave duration untouched). */
export function hasDurationFields(body: Record<string, unknown>) {
  return ["durationValue", "durationUnit", "durationMonths", "durationLabel"].some((key) => body[key] !== undefined);
}
