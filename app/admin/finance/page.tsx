import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeDollarSign,
  BarChart3,
  Crown,
  Info,
  Receipt,
  ShoppingBag,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";

import { AnalystPanel } from "@/app/components/admin/finance/AnalystPanel";
import {
  DeltaChip,
  GlassTile,
  PeriodControl,
  Sparkline,
  TileLabel,
  Unavailable,
  comparisonLabel,
  money,
  percent,
  periodLabel,
} from "@/app/components/admin/finance/FinanceUI";
import { TrendChart } from "@/app/components/admin/finance/TrendChart";
import { Forbidden } from "@/app/components/admin/Forbidden";
import { cn } from "@/app/ui/cn";
import { localeOf, translator, type Lang } from "@/src/lib/i18n";
import { requireStaffPage } from "@/src/server/auth";
import { getFinanceSnapshot, parseSelection, type FinanceSnapshot, type Insight } from "@/src/server/finance";
import { getI18n } from "@/src/server/i18n";
import { latestReport } from "@/src/server/analyst";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "المالية والأداء" };

function bucketLabel(key: string, view: string, lang: Lang) {
  const locale = localeOf(lang);

  if (view === "year") return key;
  if (view === "month") {
    const [y, m] = key.split("-").map(Number);
    return new Intl.DateTimeFormat(locale, { month: "short", year: "2-digit", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 1)));
  }
  const [y, m, d] = key.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d)));
}

function insightCopy(insight: Insight, lang: Lang, period: string) {
  const t = translator(lang);
  const parts = insight.body.split("|");

  switch (insight.title) {
    case "REVENUE_UP":
      return { title: t("الإيرادات", "Revenue"), body: t(`ارتفعت الإيرادات ${parts[0]}% ${period}.`, `Revenue rose ${parts[0]}% ${period}.`) };
    case "REVENUE_DOWN":
      return { title: t("الإيرادات", "Revenue"), body: t(`انخفضت الإيرادات ${parts[0]}% ${period}.`, `Revenue fell ${parts[0]}% ${period}.`) };
    case "TOP_PRODUCT":
      return { title: t("المنتج", "Product"), body: t(`«${parts[0]}» حقق ${parts[1]}% من إيرادات الفترة.`, `“${parts[0]}” generated ${parts[1]}% of revenue in this period.`) };
    case "RENEWALS_UP":
      return { title: t("التجديدات", "Renewals"), body: t(`التجديدات ${parts[0]} مقابل ${parts[1]} بالفترة السابقة.`, `${parts[0]} renewals vs ${parts[1]} in the previous period.`) };
    case "RENEWALS_DOWN":
      return { title: t("التجديدات", "Renewals"), body: t(`التجديدات ${parts[0]} فقط مقابل ${parts[1]} بالفترة السابقة.`, `Only ${parts[0]} renewals vs ${parts[1]} in the previous period.`) };
    case "PROOFS_UP":
      return {
        title: t("انتباه", "Attention"),
        body: t(`${parts[0]} إثبات دفع بانتظار المراجعة؛ رُفع ${parts[1]} بهذه الفترة مقابل ${parts[2]} قبلها.`, `${parts[0]} payment proofs await review; ${parts[1]} uploaded this period vs ${parts[2]} before.`),
      };
    default:
      return { title: insight.title, body: insight.body };
  }
}

export default async function FinancePage({ searchParams }: { searchParams: Promise<{ period?: string; from?: string; to?: string; view?: string }> }) {
  const { allowed } = await requireStaffPage("/admin/finance", "finance");

  if (!allowed) {
    return <Forbidden />;
  }

  const [{ t, lang }, params] = await Promise.all([getI18n(), searchParams]);
  const selection = parseSelection(params);
  const [snapshot, report] = await Promise.all([getFinanceSnapshot(selection), latestReport().catch(() => null)]);
  const currency = t("د.ع", "IQD");
  const compare = comparisonLabel(selection.period, lang);

  return (
    <div className="space-y-6" data-testid="finance-dashboard">
      {/* Header */}
      <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-brand-ink">
            <Sparkles size={14} aria-hidden /> Shashtna Business Intelligence
          </p>
          <h1 className="mt-2 text-h1 font-bold text-ink">{t("المالية والأداء", "Finance & performance")}</h1>
          <p className="nums mt-1 text-sm text-ink-3">
            {periodLabel(selection.period, lang)} · {snapshot.range.current.from} → {snapshot.range.current.to} · {t("بتوقيت بغداد", "Baghdad time")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/finance/expenses" className="inline-flex h-10 items-center gap-2 rounded-xl border border-line-strong bg-surface-2 px-4 text-sm font-semibold text-ink-2 hover:text-ink">
            <Receipt size={16} aria-hidden /> {t("المصاريف", "Expenses")}
          </Link>
          <Link href="/admin/finance/reports" className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-bold text-white shadow-brand hover:bg-brand-strong">
            <Sparkles size={16} aria-hidden /> {t("تقارير المحلل", "Analyst reports")}
          </Link>
        </div>
      </header>

      <PeriodControl basePath="/admin/finance" period={selection.period} view={selection.view} from={snapshot.range.current.from} to={snapshot.range.current.to} lang={lang} />

      {/* Balance card + P&L */}
      <div className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
        <section
          data-testid="revenue-hero"
          className="bg-brand-band relative isolate overflow-hidden rounded-[2rem] border border-white/10 p-6 shadow-float sm:p-8"
        >
          <div aria-hidden className="absolute -end-24 -top-24 -z-10 h-72 w-72 rounded-full bg-[radial-gradient(closest-side,rgb(203_233_253/0.28),transparent)]" />
          <div aria-hidden className="absolute -bottom-32 -start-10 -z-10 h-72 w-72 rounded-full border border-white/10" />
          <div className="flex items-start justify-between gap-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/75">{t("إجمالي الإيرادات", "Total revenue")}</p>
            <span className="glass-soft rounded-full px-3 py-1 text-xs font-semibold text-white">{periodLabel(selection.period, lang)}</span>
          </div>
          <p className="mt-5 flex items-baseline gap-3 text-white" data-testid="revenue-amount">
            <span className="text-sm font-semibold text-white/70">{currency}</span>
            <span className="nums text-5xl font-bold tracking-tight sm:text-6xl" dir="ltr">
              {new Intl.NumberFormat("en-US").format(snapshot.revenue.amount)}
            </span>
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-white/80">
            <DeltaChip change={snapshot.revenue.change} lang={lang} onBrand />
            <span>{compare}</span>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="glass-soft rounded-2xl p-3">
              <p className="text-[11px] font-semibold text-white/70">{t("مبيعات مكتملة", "Completed sales")}</p>
              <p className="nums mt-1 text-xl font-bold text-white">{snapshot.revenue.sales}</p>
            </div>
            <div className="glass-soft rounded-2xl p-3">
              <p className="text-[11px] font-semibold text-white/70">{t("الفترة السابقة", "Previous period")}</p>
              <p className="nums mt-1 text-xl font-bold text-white">{money(snapshot.revenue.previous, lang)}</p>
            </div>
            <div className="glass-soft col-span-2 rounded-2xl p-3 sm:col-span-1">
              <p className="text-[11px] font-semibold text-white/70">{t("متوسط قيمة الطلب", "Average order value")}</p>
              <p className="nums mt-1 text-xl font-bold text-white">{snapshot.orders.averageOrderValue === null ? "—" : money(snapshot.orders.averageOrderValue, lang)}</p>
            </div>
          </div>
          <Sparkline values={snapshot.trend.points.map((point) => point.revenue)} className="mt-6" />
          <details className="mt-4 text-xs text-white/70">
            <summary className="inline-flex cursor-pointer items-center gap-1.5 font-semibold text-white/80"><Info size={13} aria-hidden />{t("كيف تُحسب الإيرادات؟", "How is revenue counted?")}</summary>
            <p className="mt-2 leading-6">
              {t(
                "الإيرادات = الأموال المستلمة فعلًا: كل طلب وصل لحالة «تم الدفع» أو «قيد التفعيل» أو «مكتمل» بتاريخ تأكيد الدفع، بمبلغ الإيصال الصادر (أو سعر الطلب إذا ماكو إيصال) مضافًا له سعر الجهاز. الطلبات الملغاة والمرفوضة غير محسوبة.",
                "Revenue = money actually received: every order that reached Paid, In fulfilment or Completed, on the date payment was confirmed, at the issued receipt amount (or the order price without a receipt) plus any device price. Cancelled and rejected orders never count.",
              )}
            </p>
          </details>
        </section>

        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-1">
          <GlassTile testId="expenses-tile">
            <TileLabel icon={<Wallet size={14} aria-hidden />}>{t("المصاريف", "Expenses")}</TileLabel>
            {snapshot.expenses.recorded ? (
              <>
                <p className="nums mt-3 text-3xl font-bold text-ink">{money(snapshot.expenses.amount, lang)}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-3">
                  <DeltaChip change={snapshot.expenses.change} lang={lang} invert />
                  {t("قبلها", "before")}: <span className="nums">{money(snapshot.expenses.previous, lang)}</span>
                </div>
              </>
            ) : (
              <>
                <p className="mt-3 text-xl font-bold text-ink-2">{t("لم تُسجَّل مصاريف بعد", "No expenses recorded yet")}</p>
                <Link href="/admin/finance/expenses" className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-brand-ink hover:text-ink">
                  {t("سجّل المصاريف", "Record expenses")} <ArrowLeft size={14} className="ltr:rotate-180" aria-hidden />
                </Link>
              </>
            )}
          </GlassTile>
          <GlassTile testId="profit-tile" className="[background:linear-gradient(160deg,rgb(156_107_230/0.16),transparent_60%),var(--color-surface)]">
            <TileLabel icon={<BadgeDollarSign size={14} aria-hidden />}>{t("صافي الربح", "Net profit")}</TileLabel>
            {snapshot.profit.status === "ok" ? (
              <>
                <p className={cn("nums mt-3 text-3xl font-bold", snapshot.profit.amount < 0 ? "text-danger" : "text-ink")} data-testid="profit-amount">
                  {money(snapshot.profit.amount, lang)}
                </p>
                <p className="mt-2 text-xs text-ink-3">{t("الإيرادات − المصاريف المسجلة", "Revenue − recorded expenses")}</p>
              </>
            ) : (
              <>
                <p className="mt-3 text-xl font-bold text-ink-2" data-testid="profit-incomplete">{t("البيانات غير مكتملة", "Data incomplete")}</p>
                <Unavailable>{t("ما نحسب ربح بدون مصاريف مسجلة — الإيرادات ليست ربحًا. سجّل المصاريف حتى يظهر صافي الربح.", "Profit isn't calculated without recorded expenses — revenue is not profit. Record expenses to see net profit.")}</Unavailable>
              </>
            )}
          </GlassTile>
        </div>
      </div>

      {/* Calendar periods */}
      <section aria-label={t("الإيرادات حسب الفترة", "Revenue by period")} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {snapshot.quick.map((item) => (
          <Link key={item.key} href={`/admin/finance?period=${item.key}&view=${selection.view}`} className="group">
            <GlassTile className={cn("h-full transition group-hover:border-brand/40", selection.period === item.key && "ring-1 ring-glow/40")}>
              <p className="text-xs font-semibold text-ink-3">{periodLabel(item.key, lang)}</p>
              <p className="nums mt-2 text-2xl font-bold text-ink">{money(item.revenue, lang)}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-3">
                <DeltaChip change={item.change} lang={lang} />
                <span className="nums">{t(`${item.sales} مبيعة`, `${item.sales} sales`)}</span>
              </div>
            </GlassTile>
          </Link>
        ))}
      </section>

      {/* Insights + analyst */}
      <div className="grid gap-5 xl:grid-cols-[1fr_1.1fr]">
        <section aria-label={t("ملاحظات من البيانات", "Data insights")} className="space-y-3" data-testid="insight-cards">
          <TileLabel icon={<Sparkles size={14} aria-hidden />}>{t("ملاحظات مستخرجة من البيانات", "Findings from the data")}</TileLabel>
          {snapshot.insights.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {snapshot.insights.map((insight) => {
                const copy = insightCopy(insight, lang, compare);
                const Icon = insight.tone === "up" ? TrendingUp : insight.tone === "down" ? TrendingDown : insight.tone === "attention" ? AlertTriangle : Crown;

                return (
                  <GlassTile key={insight.key} className="p-4 sm:p-5">
                    <p className={cn("flex items-center gap-2 text-xs font-bold", insight.tone === "attention" ? "text-warning" : insight.tone === "down" ? "text-danger" : insight.tone === "up" ? "text-success" : "text-brand-ink")}>
                      <Icon size={15} aria-hidden /> {copy.title}
                    </p>
                    <p className="nums mt-2 text-sm leading-6 text-ink">{copy.body}</p>
                  </GlassTile>
                );
              })}
            </div>
          ) : (
            <GlassTile className="p-4 sm:p-5">
              <p className="text-sm leading-6 text-ink-3">{t("ماكو تغيّر لافت تدعمه البيانات بهذه الفترة.", "No notable change in this period is supported by the data.")}</p>
            </GlassTile>
          )}
        </section>
        <AnalystPanel lang={lang} report={report} period={selection.period} from={snapshot.range.current.from} to={snapshot.range.current.to} />
      </div>

      {/* Trend */}
      <GlassTile className="p-5 sm:p-7">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <TileLabel icon={<BarChart3 size={14} aria-hidden />}>{t("الإيرادات والمصاريف وصافي الربح", "Revenue, expenses and net profit")}</TileLabel>
            <p className="mt-1 text-sm text-ink-2">{t("كيف تتحرك أموال شاشتنا مع الوقت؟", "How is Shashtna's money moving over time?")}</p>
          </div>
          <nav aria-label={t("تجميع الرسم", "Chart grouping")} className="flex gap-1 rounded-xl bg-surface-2 p-1">
            {(
              [
                ["day", t("يومي", "Daily")],
                ["week", t("أسبوعي", "Weekly")],
                ["month", t("شهري", "Monthly")],
                ["year", t("سنوي", "Yearly")],
              ] as const
            ).map(([value, label]) => (
              <Link
                key={value}
                href={`/admin/finance?${new URLSearchParams({ period: selection.period, view: value, ...(selection.period === "custom" ? { from: snapshot.range.current.from, to: snapshot.range.current.to } : {}) }).toString()}`}
                aria-current={selection.view === value ? "page" : undefined}
                className={cn("rounded-lg px-3 py-1.5 text-xs font-bold transition", selection.view === value ? "bg-brand text-white" : "text-ink-3 hover:text-ink")}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
        <TrendChart
          data={snapshot.trend.points.map((point) => ({ ...point, label: bucketLabel(point.key, selection.view, lang) }))}
          showProfit={snapshot.expenses.recorded}
          format={{ currency, locale: lang }}
          labels={{
            revenue: t("الإيرادات", "Revenue"),
            expenses: t("المصاريف", "Expenses"),
            profit: t("صافي الربح", "Net profit"),
            sales: t("المبيعات", "Sales"),
            table: t("عرض كجدول", "Table view"),
            period: t("الفترة", "Period"),
            empty: t("ماكو إيرادات أو مصاريف مسجلة بهذه النافذة.", "No revenue or expenses recorded in this window."),
            title: t("الإيرادات والمصاريف وصافي الربح", "Revenue, expenses and net profit"),
          }}
        />
      </GlassTile>

      <ProductSection snapshot={snapshot} lang={lang} />
      <OperationsSection snapshot={snapshot} lang={lang} />
      <DataAvailability snapshot={snapshot} lang={lang} />
    </div>
  );
}

function ProductSection({ snapshot, lang }: { snapshot: FinanceSnapshot; lang: Lang }) {
  const t = translator(lang);
  const leader = snapshot.mostSold;
  const prev = new Map(snapshot.productsPrevious.map((row) => [row.product, row]));

  return (
    <section aria-labelledby="products-heading" className="grid gap-5 xl:grid-cols-[0.9fr_1.6fr]" data-testid="product-performance">
      <div className="bg-brand-band relative overflow-hidden rounded-[2rem] border border-white/10 p-6 shadow-float sm:p-7" data-testid="most-sold">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-white/75"><Crown size={14} aria-hidden />{t("الأكثر مبيعًا", "Most sold")}</p>
        {leader ? (
          <>
            <p className="mt-5 text-2xl font-bold leading-snug text-white">{leader.name}</p>
            <p className="nums mt-3 text-4xl font-bold text-white">{leader.units}<span className="ms-2 text-sm font-semibold text-white/70">{t("عملية شراء", "purchases")}</span></p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="glass-soft rounded-2xl p-3"><p className="text-[11px] text-white/70">{t("الإيرادات", "Revenue")}</p><p className="nums mt-1 font-bold text-white">{money(leader.revenue, lang)}</p></div>
              <div className="glass-soft rounded-2xl p-3"><p className="text-[11px] text-white/70">{t("من الإيرادات", "Of revenue")}</p><p className="nums mt-1 font-bold text-white">{percent(leader.share)}</p></div>
            </div>
          </>
        ) : (
          <p className="mt-5 text-lg font-bold text-white/85">{t("بيانات المبيعات غير كافية لتحديد الأكثر مبيعًا بهذه الفترة.", "Not enough sales data to name a most-sold product in this period.")}</p>
        )}
      </div>

      <GlassTile className="p-5 sm:p-7">
        <TileLabel icon={<ShoppingBag size={14} aria-hidden />}><span id="products-heading">{t("أداء المنتجات", "Product performance")}</span></TileLabel>
        <p className="mt-1 text-sm text-ink-2">{t("كم باع كل منتج، وكم جاب فلوس؟", "How many units did each product sell, and how much money did it bring in?")}</p>
        {snapshot.products.length ? (
          <ul className="mt-5 space-y-4">
            {snapshot.products.map((row, index) => {
              const before = prev.get(row.product);

              return (
                <li key={row.product} data-testid="product-row">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <p className="flex items-center gap-2 font-bold text-ink">
                      <span className="nums flex h-6 w-6 items-center justify-center rounded-lg bg-surface-3 text-[11px] text-ink-2">{index + 1}</span>
                      {row.name}
                      <span className="rounded-full border border-line px-2 py-0.5 text-[10px] font-semibold text-ink-3">{row.kind === "device" ? t("جهاز", "Device") : row.serviceType}</span>
                    </p>
                    <p className="nums text-sm font-bold text-ink">{money(row.revenue, lang)}</p>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-3" aria-hidden>
                    <div className="h-full rounded-full bg-viz-revenue" style={{ width: `${Math.max(2, row.share)}%` }} />
                  </div>
                  <p className="nums mt-1.5 flex flex-wrap gap-x-4 text-xs text-ink-3">
                    <span>{t(`${row.units} مبيعة`, `${row.units} sold`)}</span>
                    <span>{t(`${percent(row.share)} من الإيرادات`, `${percent(row.share)} of revenue`)}</span>
                    <span>{t("متوسط", "Avg")} {money(row.averageOrderValue, lang)}</span>
                    <span>{before ? t(`السابقة: ${before.units} مبيعة`, `Previous: ${before.units} sold`) : t("ماكو مبيعات بالفترة السابقة", "No sales in the previous period")}</span>
                  </p>
                </li>
              );
            })}
          </ul>
        ) : (
          <Unavailable>{t("ماكو مبيعات مكتملة بهذه الفترة.", "No completed sales in this period.")}</Unavailable>
        )}
      </GlassTile>
    </section>
  );
}

function OperationsSection({ snapshot, lang }: { snapshot: FinanceSnapshot; lang: Lang }) {
  const t = translator(lang);
  const o = snapshot.orders;
  const c = snapshot.customers;
  const tile = (label: string, value: string | number, previous?: string | number, testId?: string) => (
    <div className="rounded-2xl border border-line bg-surface-2/60 p-4" data-testid={testId}>
      <p className="text-xs font-semibold text-ink-3">{label}</p>
      <p className="nums mt-1.5 text-2xl font-bold text-ink">{value}</p>
      {previous !== undefined ? <p className="nums mt-1 text-[11px] text-ink-3">{t("السابقة", "Previous")}: {previous}</p> : null}
    </div>
  );

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <GlassTile testId="orders-section">
        <TileLabel icon={<ShoppingBag size={14} aria-hidden />}>{t("الطلبات والتحويل", "Orders & conversion")}</TileLabel>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {tile(t("طلبات جديدة", "Orders created"), o.created, o.previous.created)}
          {tile(t("مدفوعة / مكتملة", "Paid / completed"), o.completed, o.previous.completed)}
          {tile(t("بانتظار الدفع", "Awaiting payment"), o.pending, o.previous.pending)}
          {tile(t("قيد التفعيل", "In fulfilment"), o.inProgress, o.previous.inProgress)}
          {tile(t("ملغاة", "Cancelled"), o.cancelled, o.previous.cancelled)}
          {tile(t("مرفوضة", "Rejected"), o.rejected, o.previous.rejected)}
          {tile(t("نسبة التحويل", "Conversion rate"), percent(o.conversion) ?? "—", percent(o.previous.conversion) ?? "—", "conversion")}
          {tile(t("متوسط قيمة الطلب", "Average order value"), o.averageOrderValue === null ? "—" : money(o.averageOrderValue, lang), o.previousAverageOrderValue === null ? "—" : money(o.previousAverageOrderValue, lang))}
          {tile(t("إثباتات بانتظار المراجعة", "Proofs awaiting review"), snapshot.proofs.awaitingReview)}
        </div>
        <p className="mt-3 text-[11px] leading-5 text-ink-3">{t("نسبة التحويل = من الطلبات المنشأة بالفترة، كم وحدة تم دفعها لحد الآن.", "Conversion = of the orders created in the period, the share paid so far.")}</p>
      </GlassTile>
      <GlassTile testId="customers-section">
        <TileLabel icon={<Users size={14} aria-hidden />}>{t("العملاء والاشتراكات", "Customers & subscriptions")}</TileLabel>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {tile(t("عملاء جدد", "New customers"), c.newCustomers, c.previous.newCustomers)}
          {tile(t("عملاء دفعوا", "Paying customers"), c.payingCustomers, c.previous.payingCustomers)}
          {tile(t("عملاء عائدون", "Returning customers"), c.returningCustomers, c.previous.returningCustomers)}
          {tile(t("تجديدات", "Renewals"), c.renewals, c.previous.renewals)}
          {tile(t("مشتركون نشطون (الآن)", "Active subscribers (now)"), c.activeSubscribers)}
          {tile(t("تنتهي قريبًا (الآن)", "Expiring soon (now)"), c.expiringSubscriptions)}
          {tile(t("إيراد لكل عميل", "Revenue per customer"), c.revenuePerCustomer === null ? "—" : money(c.revenuePerCustomer, lang))}
          {tile(t("متوسط قيمة العميل (كل الوقت)", "Avg customer value (all time)"), c.averageCustomerValue === null ? "—" : money(c.averageCustomerValue, lang))}
          {tile(t("معدل الشراء لكل عميل", "Purchases per customer"), c.purchaseFrequency === null ? "—" : c.purchaseFrequency.toFixed(2))}
        </div>
        <p className="mt-3 text-[11px] leading-5 text-ink-3">{t("أرقام مجمّعة فقط — بدون بيانات شخصية.", "Aggregates only — no personal data.")}</p>
      </GlassTile>
    </div>
  );
}

function DataAvailability({ snapshot, lang }: { snapshot: FinanceSnapshot; lang: Lang }) {
  const t = translator(lang);
  const copy: Record<string, string> = {
    TRAFFIC: t("زيارات الموقع وتحليل الاكتساب: غير متوفرة — لا توجد أداة تحليلات زيارات مربوطة.", "Website traffic and acquisition: unavailable — no traffic analytics is connected."),
    APP_USAGE: t("استخدام التطبيقات (Shashtna Player وتطبيق الهاتف): غير متوفر — لا يُجمع حاليًا.", "App usage (Shashtna Player and the mobile app): unavailable — not collected."),
    SALES_CHANNEL: t("مصدر الطلب (موقع أو تطبيق): غير متوفر — الطلبات لا تسجّل القناة.", "Order channel (website vs app): unavailable — orders don't record their channel."),
    EXPENSES: t("المصاريف: لم تُسجَّل بعد، لذلك صافي الربح غير مكتمل.", "Expenses: none recorded yet, so net profit is incomplete."),
  };

  return (
    <section aria-label={t("توفر البيانات", "Data availability")} className="rounded-[1.6rem] border border-dashed border-line-strong p-5" data-testid="data-gaps">
      <TileLabel icon={<Info size={14} aria-hidden />}>{t("ما لا يمكن حسابه بعد", "What can't be measured yet")}</TileLabel>
      <ul className="mt-3 grid gap-2 text-sm text-ink-2 sm:grid-cols-2">
        {snapshot.dataGaps.map((gap) => (
          <li key={gap} className="flex items-start gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-ink-3" aria-hidden />{copy[gap]}</li>
        ))}
      </ul>
    </section>
  );
}
