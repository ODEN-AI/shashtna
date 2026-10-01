import { BarChart3, Boxes, Clock3, Coins, Info, LayoutGrid, Megaphone, Sparkles, UsersRound, Workflow, RefreshCcw } from "lucide-react";
import type { ReactNode } from "react";

import { DeltaChip, EXTENDED_PERIODS, PeriodControl } from "@/app/components/admin/finance/FinanceUI";
import { LinkTabs } from "@/app/ui/Tabs";
import { cn } from "@/app/ui/cn";
import type { PeriodKey } from "@/src/lib/business-time";
import { translator, type Lang, type Translate } from "@/src/lib/i18n";
import { INTEL_PAGES, type Comparison, type Duration } from "@/src/lib/intelligence";

/**
 * Intelligence building blocks on the console's existing primitives
 * (Finance glass tiles, period control, Dashboard section cards).
 */

export type IntelPage = keyof typeof INTEL_PAGES;

export const INTEL_PATHS: Record<IntelPage, string> = {
  overview: "/admin/intelligence",
  revenue: "/admin/intelligence/revenue",
  customers: "/admin/intelligence/customers",
  subscriptions: "/admin/intelligence/subscriptions",
  products: "/admin/intelligence/products",
  operations: "/admin/intelligence/operations",
  promotions: "/admin/intelligence/promotions",
  analyst: "/admin/intelligence/analyst",
};

export const fmt = (value: number) => new Intl.NumberFormat("en-US").format(Math.round(value));

/** Hours as "x h" / "x min" (one decimal from the pack). */
export function hoursText(hours: number | null, lang: Lang) {
  const t = translator(lang);
  if (hours === null) return "—";
  if (hours < 1) return t(`${Math.round(hours * 60)} دقيقة`, `${Math.round(hours * 60)} min`);
  return t(`${hours.toFixed(1)} ساعة`, `${hours.toFixed(1)} h`);
}

export function periodQuery(selection: { period: PeriodKey; from?: string | null; to?: string | null }) {
  return new URLSearchParams({ period: selection.period, ...(selection.period === "custom" && selection.from && selection.to ? { from: selection.from, to: selection.to } : {}) }).toString();
}

export function IntelHeader({
  active,
  role,
  t,
  lang,
  title,
  description,
  selection,
  range,
  showPeriod = true,
}: {
  active: IntelPage;
  role: string;
  t: Translate;
  lang: Lang;
  title: ReactNode;
  description?: ReactNode;
  selection: { period: PeriodKey; from?: string | null; to?: string | null };
  range: { from: string; to: string; previousFrom: string; previousTo: string };
  showPeriod?: boolean;
}) {
  const query = periodQuery(selection);
  const icons: Record<IntelPage, ReactNode> = {
    overview: <LayoutGrid size={14} aria-hidden />,
    revenue: <Coins size={14} aria-hidden />,
    customers: <UsersRound size={14} aria-hidden />,
    subscriptions: <RefreshCcw size={14} aria-hidden />,
    products: <Boxes size={14} aria-hidden />,
    operations: <Workflow size={14} aria-hidden />,
    promotions: <Megaphone size={14} aria-hidden />,
    analyst: <Sparkles size={14} aria-hidden />,
  };
  const names: Record<IntelPage, string> = {
    overview: t("نظرة عامة", "Overview"),
    revenue: t("الإيرادات", "Revenue"),
    customers: t("العملاء", "Customers"),
    subscriptions: t("الاشتراكات", "Subscriptions"),
    products: t("المنتجات", "Products"),
    operations: t("العمليات", "Operations"),
    promotions: t("العروض والمحتوى", "Promotions"),
    analyst: t("المحلل", "Analyst"),
  };
  const tabs = (Object.keys(INTEL_PATHS) as IntelPage[])
    .filter((key) => INTEL_PAGES[key](role))
    .map((key) => ({ key, href: `${INTEL_PATHS[key]}?${query}`, label: <>{icons[key]} {names[key]}</> }));

  return (
    <header className="space-y-4">
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-brand-ink">
          <BarChart3 size={14} aria-hidden /> {t("الذكاء والتحليلات", "Intelligence")}
        </p>
        <h1 className="mt-2 text-h2 font-bold text-ink">{title}</h1>
        {description ? <p className="mt-1 max-w-3xl text-sm text-ink-3">{description}</p> : null}
      </div>
      <LinkTabs label={t("أقسام التحليلات", "Intelligence sections")} active={active} tabs={tabs} />
      {showPeriod ? (
        <div className="space-y-2">
          <PeriodControl basePath={INTEL_PATHS[active]} period={selection.period} from={range.from} to={range.to} lang={lang} periods={EXTENDED_PERIODS} />
          <p className="nums text-xs text-ink-3" data-testid="intel-range" data-from={range.from} data-to={range.to}>
            <bdi dir="ltr">{range.from} → {range.to}</bdi> · {t("مقارنة بـ", "compared with")} <bdi dir="ltr">{range.previousFrom} → {range.previousTo}</bdi> · {t("بتوقيت بغداد", "Baghdad time")}
          </p>
        </div>
      ) : null}
    </header>
  );
}

/** Absolute and percentage change; "no comparison" when the previous period is zero. */
export function ChangeLine({ value, lang, invert, money }: { value: Comparison; lang: Lang; invert?: boolean; money?: boolean }) {
  const t = translator(lang);
  const unit = money ? ` ${t("د.ع", "IQD")}` : "";
  const sign = value.abs > 0 ? "+" : value.abs < 0 ? "−" : "";

  return (
    <span className="flex flex-wrap items-center gap-2" data-testid="intel-change" data-pct={value.pct === null ? "none" : String(value.pct)}>
      {value.pct === null ? (
        <span className="rounded-full bg-surface-3 px-2.5 py-1 text-xs font-semibold text-ink-3" data-testid="intel-no-comparison">
          {t("لا تتوفر مقارنة", "No comparison available")}
        </span>
      ) : (
        <DeltaChip change={value.pct} lang={lang} invert={invert} />
      )}
      <span className="nums" dir="ltr">
        {sign}
        {fmt(Math.abs(value.abs))}
        {unit}
      </span>
      <span>
        {t("السابقة:", "previous:")} <span className="nums">{fmt(value.previous)}{unit}</span>
      </span>
    </span>
  );
}

/** A plain label / value list. */
export function StatList({ rows, testId }: { rows: { label: ReactNode; value: ReactNode; testId?: string; hint?: ReactNode }[]; testId?: string }) {
  return (
    <dl className="divide-y divide-line/60" data-testid={testId}>
      {rows.map((row, index) => (
        <div key={index} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-2.5 text-sm" data-testid={row.testId}>
          <dt className="min-w-0 text-ink-2">
            {row.label}
            {row.hint ? <span className="block text-xs text-ink-3">{row.hint}</span> : null}
          </dt>
          <dd className="nums font-bold text-ink">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Median / average / sample / excluded for a processing time, with what it measures. */
export function DurationBlock({ value, lang, measures, testId, unit }: { value: Duration; lang: Lang; measures: ReactNode; testId: string; unit: { ar: string; en: string } }) {
  const t = translator(lang);

  return (
    <div className="space-y-2" data-testid={testId} data-count={value.count} data-excluded={value.excluded}>
      <p className="flex items-start gap-2 text-xs text-ink-3">
        <Clock3 size={13} className="mt-0.5 shrink-0" aria-hidden />
        <span>{measures}</span>
      </p>
      {value.count ? (
        <StatList
          rows={[
            { label: t("الوسيط", "Median"), value: hoursText(value.medianHours, lang), testId: `${testId}-median` },
            { label: t("المتوسط", "Average"), value: hoursText(value.averageHours, lang) },
            { label: t("حجم العينة", "Sample size"), value: `${value.count} ${t(unit.ar, unit.en)}` },
            ...(value.excluded ? [{ label: t("مستثنى", "Excluded"), value: value.excluded, hint: t("بدون الأحداث المطلوبة", "missing the required events"), testId: `${testId}-excluded` }] : []),
          ]}
        />
      ) : (
        <p className="rounded-xl bg-white/[0.03] px-3 py-3 text-sm text-ink-3" data-testid={`${testId}-empty`}>
          {t("لا توجد عينة بهذه الفترة.", "No sample in this period.")}
          {value.excluded ? ` ${t(`(${value.excluded} مستثنى لعدم وجود الأحداث المطلوبة)`, `(${value.excluded} excluded for missing events)`)}` : ""}
        </p>
      )}
    </div>
  );
}

/** Metrics that are deliberately not shown, with the reason. */
export function NotAvailable({ items, lang, className }: { items: string[]; lang: Lang; className?: string }) {
  const t = translator(lang);
  if (!items.length) return null;

  return (
    <section className={cn("rounded-2xl border border-dashed border-line p-4", className)} data-testid="intel-unavailable">
      <h2 className="flex items-center gap-2 text-sm font-bold text-ink-2">
        <Info size={14} aria-hidden /> {t("غير متاح", "Not available")}
      </h2>
      <ul className="mt-2 list-disc space-y-1 ps-5 text-xs leading-6 text-ink-3">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

/** Horizontal bars for a short list (identity by label text; one series). */
export function Bars({ rows, lang, testId, empty }: { rows: { label: string; value: number; secondary?: ReactNode }[]; lang: Lang; testId?: string; empty: ReactNode }) {
  const t = translator(lang);
  const max = Math.max(1, ...rows.map((row) => row.value));

  if (!rows.length) return <p className="rounded-xl bg-white/[0.03] px-3 py-4 text-center text-sm text-ink-3">{empty}</p>;

  return (
    <ul className="space-y-3" data-testid={testId} aria-label={t("قائمة مرتبة", "Ranked list")}>
      {rows.map((row, index) => (
        <li key={`${index}:${row.label}`} className="space-y-1" data-testid="intel-bar" data-label={row.label} data-value={row.value}>
          <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
            <span className="min-w-0 break-words text-ink">{row.label}</span>
            <span className="nums font-bold text-ink">
              {fmt(row.value)}
              {row.secondary ? <span className="ms-2 text-xs font-normal text-ink-3">{row.secondary}</span> : null}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
            <div className="h-full rounded-full bg-brand" style={{ width: `${Math.max(2, (row.value / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Display names of the Intelligence sections (report scope). */
export function sectionLabels(t: (ar: string, en: string) => string): Record<string, string> {
  return {
    finance: t("المالية", "Finance"),
    sales: t("حجم المبيعات", "Sales volume"),
    orders: t("الطلبات", "Orders"),
    customers: t("العملاء", "Customers"),
    subscriptions: t("الاشتراكات", "Subscriptions"),
    support: t("الدعم", "Support"),
    promotions: t("العروض والمحتوى", "Promotions"),
  };
}
