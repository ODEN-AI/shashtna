/**
 * Business calendar for Shashtna's financial reporting.
 *
 * Shashtna trades in Iraq, so "today", "this week", "this month" and "this
 * year" are Baghdad calendar periods (UTC+3, no daylight saving), whatever
 * timezone the server runs in (Netlify functions run in UTC). Weeks start
 * on Saturday, the start of the Iraqi working week.
 *
 * All functions return UTC instants (Date) for the period boundaries, so
 * they can be compared directly with stored timestamptz values.
 */

export const BUSINESS_TIME_ZONE = "Asia/Baghdad";
const OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type PeriodKey = "today" | "week" | "month" | "year" | "custom";
export type Granularity = "day" | "week" | "month" | "year";

export type Range = { start: Date; end: Date };

/** Baghdad wall-clock parts for an instant. */
function local(date: Date) {
  const shifted = new Date(date.getTime() + OFFSET_MS);

  return { y: shifted.getUTCFullYear(), m: shifted.getUTCMonth(), d: shifted.getUTCDate(), dow: shifted.getUTCDay() };
}

/** UTC instant of Baghdad midnight for a local date. */
function midnight(y: number, m: number, d: number) {
  return new Date(Date.UTC(y, m, d) - OFFSET_MS);
}

export function startOfDay(date: Date) {
  const { y, m, d } = local(date);

  return midnight(y, m, d);
}

export function startOfWeek(date: Date) {
  const { y, m, d, dow } = local(date);
  const sinceSaturday = (dow + 1) % 7;

  return midnight(y, m, d - sinceSaturday);
}

export function startOfMonth(date: Date) {
  const { y, m } = local(date);

  return midnight(y, m, 1);
}

export function startOfYear(date: Date) {
  const { y } = local(date);

  return midnight(y, 0, 1);
}

export function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_MS);
}

export function addMonths(date: Date, months: number) {
  const { y, m, d } = local(date);

  return midnight(y, m + months, d);
}

/** Baghdad calendar date "YYYY-MM-DD" for an instant. */
export function businessDay(date: Date) {
  const { y, m, d } = local(date);

  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Parse a "YYYY-MM-DD" business date as Baghdad midnight. */
export function parseBusinessDay(value: string | null | undefined) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? ""));

  if (!match) {
    return null;
  }

  const date = midnight(Number(match[1]), Number(match[2]) - 1, Number(match[3]));

  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * The selected reporting range (end exclusive) and the comparison range of
 * the same length immediately before it ("this month vs previous month").
 * Current periods run up to `now`, and the previous period is cut at the
 * same elapsed point, so a half-finished month is compared like for like.
 */
export function resolveRange(period: PeriodKey, now = new Date(), custom?: { from?: string | null; to?: string | null }) {
  let start: Date;
  let previousStart: Date;

  switch (period) {
    case "today":
      start = startOfDay(now);
      previousStart = addDays(start, -1);
      break;
    case "week":
      start = startOfWeek(now);
      previousStart = addDays(start, -7);
      break;
    case "year": {
      start = startOfYear(now);
      const { y } = local(now);
      previousStart = midnight(y - 1, 0, 1);
      break;
    }
    case "custom": {
      const from = parseBusinessDay(custom?.from);
      const to = parseBusinessDay(custom?.to);

      if (from && to && to.getTime() >= from.getTime()) {
        const end = addDays(to, 1);
        const length = end.getTime() - from.getTime();

        return {
          current: { start: from, end },
          previous: { start: new Date(from.getTime() - length), end: from },
          granularity: granularityFor(length),
        };
      }

      // Invalid custom range: fall back to this month.
      return resolveRange("month", now);
    }
    case "month":
    default: {
      start = startOfMonth(now);
      previousStart = addMonths(start, -1);
      break;
    }
  }

  const elapsed = now.getTime() - start.getTime();
  const end = new Date(now.getTime() + 1);

  return {
    current: { start, end },
    previous: { start: previousStart, end: new Date(Math.min(previousStart.getTime() + elapsed + 1, start.getTime())) },
    granularity: (period === "year" ? "month" : "day") as Granularity,
  };
}

function granularityFor(length: number): Granularity {
  if (length > 120 * DAY_MS) return "month";
  if (length > 45 * DAY_MS) return "week";
  return "day";
}

/** Bucket key for an instant at a granularity (Baghdad calendar). */
export function bucketKey(date: Date, granularity: Granularity) {
  if (granularity === "year") {
    return String(local(date).y);
  }

  if (granularity === "month") {
    const { y, m } = local(date);

    return `${y}-${String(m + 1).padStart(2, "0")}`;
  }

  if (granularity === "week") {
    return businessDay(startOfWeek(date));
  }

  return businessDay(date);
}

/** Ordered bucket keys covering a range. */
export function bucketKeys(range: Range, granularity: Granularity) {
  const keys: string[] = [];
  let cursor =
    granularity === "year"
      ? startOfYear(range.start)
      : granularity === "month"
        ? startOfMonth(range.start)
        : granularity === "week"
          ? startOfWeek(range.start)
          : startOfDay(range.start);

  while (cursor.getTime() < range.end.getTime() && keys.length < 400) {
    keys.push(bucketKey(cursor, granularity));
    cursor =
      granularity === "year"
        ? addMonths(cursor, 12)
        : granularity === "month"
          ? addMonths(cursor, 1)
          : addDays(cursor, granularity === "week" ? 7 : 1);
  }

  return keys;
}

/** The window shown by the revenue / expenses / profit trend for a view. */
export function trendRange(view: Granularity, now = new Date()): Range {
  const end = new Date(now.getTime() + 1);

  switch (view) {
    case "week":
      return { start: addDays(startOfWeek(now), -7 * 11), end };
    case "month":
      return { start: addMonths(startOfMonth(now), -11), end };
    case "year":
      return { start: addMonths(startOfYear(now), -12 * 4), end };
    case "day":
    default:
      return { start: addDays(startOfDay(now), -29), end };
  }
}
