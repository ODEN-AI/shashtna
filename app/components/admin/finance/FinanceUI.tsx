import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, CalendarRange, Minus } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/app/ui/cn";
import type { Granularity, PeriodKey } from "@/src/lib/business-time";
import { formatPrice, localeOf, translator, type Lang } from "@/src/lib/i18n";

/**
 * Shashtna Business Intelligence — shared visual pieces. Premium fintech on
 * the Shashtna Liquid Glass system: one deep brand "balance" card, glass
 * tiles for everything else, large numbers, text always in ink tokens.
 */

export function money(value: number, lang: Lang) {
  return formatPrice(Math.round(value), lang);
}

export function percent(value: number | null | undefined, digits = 1) {
  return value === null || value === undefined || !Number.isFinite(value) ? null : `${value.toFixed(digits)}%`;
}

/** Change vs the previous period. Shows "—" when there is no base to compare. */
export function DeltaChip({
  change,
  lang,
  invert,
  className,
  onBrand,
}: {
  change: number | null;
  lang: Lang;
  /** For costs: a rise is not "good". */
  invert?: boolean;
  className?: string;
  onBrand?: boolean;
}) {
  const t = translator(lang);

  if (change === null || !Number.isFinite(change)) {
    return (
      <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold", onBrand ? "bg-white/10 text-white/80" : "bg-surface-3 text-ink-3", className)}>
        <Minus size={12} aria-hidden />
        {t("لا توجد فترة سابقة للمقارنة", "No previous data")}
      </span>
    );
  }

  const up = change > 0.05;
  const down = change < -0.05;
  const good = invert ? down : up;
  const bad = invert ? up : down;
  const Icon = up ? ArrowUpRight : down ? ArrowDownRight : Minus;

  return (
    <span
      className={cn(
        "nums inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold",
        onBrand
          ? "bg-white/15 text-white"
          : good
            ? "bg-success/12 text-success"
            : bad
              ? "bg-danger/12 text-danger"
              : "bg-surface-3 text-ink-2",
        className,
      )}
      dir="ltr"
    >
      <Icon size={13} aria-hidden />
      {`${change > 0 ? "+" : ""}${change.toFixed(1)}%`}
    </span>
  );
}

const PERIODS: { key: PeriodKey; ar: string; en: string }[] = [
  { key: "today", ar: "اليوم", en: "Today" },
  { key: "week", ar: "هذا الأسبوع", en: "This week" },
  { key: "month", ar: "هذا الشهر", en: "This month" },
  { key: "year", ar: "هذه السنة", en: "This year" },
];

export function periodLabel(period: PeriodKey, lang: Lang) {
  const t = translator(lang);
  const found = PERIODS.find((item) => item.key === period);

  return found ? t(found.ar, found.en) : t("فترة مخصصة", "Custom range");
}

export function comparisonLabel(period: PeriodKey, lang: Lang) {
  const t = translator(lang);

  switch (period) {
    case "today":
      return t("مقارنة بنفس الوقت أمس", "vs the same time yesterday");
    case "week":
      return t("مقارنة بنفس النقطة من الأسبوع الماضي", "vs the same point last week");
    case "year":
      return t("مقارنة بنفس النقطة من السنة الماضية", "vs the same point last year");
    case "custom":
      return t("مقارنة بفترة سابقة بنفس الطول", "vs the previous period of the same length");
    case "month":
    default:
      return t("مقارنة بنفس النقطة من الشهر الماضي", "vs the same point last month");
  }
}

/** Segmented period control + custom range (plain GET form, works without JS). */
export function PeriodControl({
  basePath,
  period,
  view,
  from,
  to,
  lang,
  keep = {},
}: {
  basePath: string;
  period: PeriodKey;
  view?: Granularity;
  from: string;
  to: string;
  lang: Lang;
  /** Other query params to carry across period changes (e.g. a category filter). */
  keep?: Record<string, string>;
}) {
  const t = translator(lang);
  const query = (extra: Record<string, string>) => `${basePath}?${new URLSearchParams({ ...keep, ...(view ? { view } : {}), ...extra }).toString()}`;

  return (
    <div className="flex flex-wrap items-center gap-3" data-testid="period-control">
      <nav aria-label={t("فترة التقرير", "Reporting period")} className="glass-soft flex flex-wrap gap-1 rounded-2xl p-1">
        {PERIODS.map((item) => (
          <Link
            key={item.key}
            href={query({ period: item.key })}
            aria-current={period === item.key ? "page" : undefined}
            className={cn(
              "inline-flex h-9 items-center rounded-xl px-3.5 text-sm font-semibold transition",
              period === item.key ? "bg-white text-navy shadow-glow" : "text-ink-2 hover:bg-white/8 hover:text-ink",
            )}
          >
            {t(item.ar, item.en)}
          </Link>
        ))}
      </nav>
      <form action={basePath} className={cn("glass-soft flex flex-wrap items-center gap-2 rounded-2xl p-1 ps-3", period === "custom" && "ring-1 ring-glow/50")}>
        <CalendarRange size={16} className="text-brand-ink" aria-hidden />
        <input type="hidden" name="period" value="custom" />
        {view ? <input type="hidden" name="view" value={view} /> : null}
        {Object.entries(keep).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        <label className="sr-only" htmlFor="finance-from">{t("من", "From")}</label>
        <input id="finance-from" type="date" name="from" defaultValue={from} required className="nums h-9 rounded-lg border border-line bg-surface-2 px-2 text-sm text-ink" />
        <span className="text-ink-3">—</span>
        <label className="sr-only" htmlFor="finance-to">{t("إلى", "To")}</label>
        <input id="finance-to" type="date" name="to" defaultValue={to} required className="nums h-9 rounded-lg border border-line bg-surface-2 px-2 text-sm text-ink" />
        <button type="submit" className="h-9 rounded-xl bg-brand px-3.5 text-sm font-bold text-white transition hover:bg-brand-strong">
          {t("عرض", "Apply")}
        </button>
      </form>
    </div>
  );
}

/** Single-series sparkline (decorative summary; the full chart + table is below). */
export function Sparkline({ values, className }: { values: number[]; className?: string }) {
  if (values.length < 2 || values.every((value) => value === 0)) {
    return null;
  }

  const max = Math.max(...values, 1);
  const width = 240;
  const height = 64;
  const step = width / (values.length - 1);
  const points = values.map((value, index) => `${(index * step).toFixed(1)},${(height - 4 - (value / max) * (height - 10)).toFixed(1)}`);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={cn("h-16 w-full", className)} aria-hidden preserveAspectRatio="none">
      <defs>
        <linearGradient id="spark-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="rgb(203 233 253 / 0.35)" />
          <stop offset="100%" stopColor="rgb(203 233 253 / 0)" />
        </linearGradient>
      </defs>
      <polygon points={`0,${height} ${points.join(" ")} ${width},${height}`} fill="url(#spark-fill)" />
      <polyline points={points.join(" ")} fill="none" stroke="rgb(255 255 255 / 0.9)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function GlassTile({ children, className, testId }: { children: ReactNode; className?: string; testId?: string }) {
  return (
    <div data-testid={testId} className={cn("relative overflow-hidden rounded-[1.75rem] border border-white/8 bg-[linear-gradient(180deg,rgb(203_233_253/0.07),rgb(203_233_253/0.015)_45%),rgb(6_21_61/0.72)] p-5 shadow-card backdrop-blur-xl [border-top-color:rgb(203_233_253/0.18)] sm:p-6", className)}>
      {children}
    </div>
  );
}

export function TileLabel({ children, icon }: { children: ReactNode; icon?: ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-ink-3">
      {icon ? <span className="text-brand-ink">{icon}</span> : null}
      {children}
    </p>
  );
}

/** A metric the system can't compute (missing data) — shown, never estimated. */
export function Unavailable({ children }: { children: ReactNode }) {
  return <p className="mt-2 rounded-xl border border-dashed border-line-strong px-3 py-2 text-xs leading-5 text-ink-3">{children}</p>;
}

const EXPENSE_LABELS: Record<string, { ar: string; en: string }> = {
  HOSTING: { ar: "استضافة", en: "Hosting" },
  SERVERS: { ar: "سيرفرات", en: "Servers" },
  DOMAINS: { ar: "دومينات", en: "Domains" },
  SOFTWARE: { ar: "اشتراكات برامج", en: "Software subscriptions" },
  ADVERTISING: { ar: "إعلانات", en: "Advertising" },
  MARKETING: { ar: "تسويق", en: "Marketing" },
  OPERATIONS: { ar: "مصاريف تشغيلية", en: "Operational" },
  OTHER: { ar: "أخرى", en: "Other" },
};

export function expenseCategoryLabel(category: string, lang: Lang) {
  const label = EXPENSE_LABELS[category];

  return label ? translator(lang)(label.ar, label.en) : category;
}

/** Short axis label for a trend bucket key ("2026-09-05", "2026-09", "2026"). */
export function bucketLabel(key: string, view: string, lang: Lang) {
  const locale = localeOf(lang);

  if (view === "year") return key;
  if (view === "month") {
    const [y, m] = key.split("-").map(Number);
    return new Intl.DateTimeFormat(locale, { month: "short", year: "2-digit", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 1)));
  }
  const [y, m, d] = key.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d)));
}
