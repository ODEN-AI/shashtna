export type Lang = "ar" | "en";

/** Cookie that carries the visitor's language so pages render server-side in
 * the right language and direction, without a client-side flash. */
export const LANG_COOKIE = "shashtna_lang";

export function normalizeLang(value: unknown): Lang {
  return value === "en" ? "en" : "ar";
}

export type Translate = (ar: string, en: string) => string;

export function translator(lang: Lang): Translate {
  return (ar, en) => (lang === "ar" ? ar : en);
}

export function directionOf(lang: Lang) {
  return lang === "ar" ? "rtl" : "ltr";
}

/** Locale used for numbers and dates. Arabic uses Latin digits, which is how
 * prices and dates are written across Shashtna today. */
export function localeOf(lang: Lang) {
  return lang === "ar" ? "ar-IQ-u-nu-latn" : "en-GB";
}

export function formatPrice(value: number, lang: Lang) {
  const amount = new Intl.NumberFormat(localeOf(lang)).format(value);

  return lang === "ar" ? `${amount} د.ع` : `${amount} IQD`;
}

/** Parses the timestamps the database returns ("2026-09-30 04:42:27.79+00")
 * in a way every browser accepts, plus plain "YYYY-MM-DD" dates. */
export function toDate(value: string | Date | null | undefined) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const text = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return new Date(`${text}T00:00:00`);
  }

  const normalized = text
    .replace(" ", "T")
    .replace(/([+-]\d{2})$/, "$1:00");
  const date = new Date(normalized);

  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value: string | Date | null | undefined, lang: Lang) {
  const date = toDate(value);

  if (!date) {
    return "—";
  }

  return new Intl.DateTimeFormat(localeOf(lang), {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

export function formatDateTime(value: string | Date | null | undefined, lang: Lang) {
  const date = toDate(value);

  if (!date) {
    return "—";
  }

  return new Intl.DateTimeFormat(localeOf(lang), {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
