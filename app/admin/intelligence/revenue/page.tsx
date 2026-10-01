import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Boxes, LineChart } from "lucide-react";

import { bucketLabel, money } from "@/app/components/admin/finance/FinanceUI";
import { TrendChart } from "@/app/components/admin/finance/TrendChart";
import { KpiTile, SectionCard, SectionError } from "@/app/components/admin/dashboard/DashboardUI";
import { ChangeLine, IntelHeader, NotAvailable, StatList, fmt } from "@/app/components/admin/intelligence/IntelUI";
import { Forbidden } from "@/app/components/admin/Forbidden";
import { DataTable } from "@/app/ui/DataTable";
import { EmptyState } from "@/app/ui/States";
import { INTEL_PAGES, compare } from "@/src/lib/intelligence";
import { requireStaffPage } from "@/src/server/auth";
import { getI18n } from "@/src/server/i18n";
import { loadIntelligence, parseIntelSelection } from "@/src/server/intelligence";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "الإيرادات — الذكاء والتحليلات" };

/**
 * Revenue intelligence: the Finance engine's snapshot for the selected
 * period (no second calculation). Requires the "finance" permission, which
 * is checked before anything is loaded.
 */
export default async function IntelligenceRevenue({ searchParams }: { searchParams: Promise<{ period?: string; from?: string; to?: string }> }) {
  const params = await searchParams;
  const { user } = await requireStaffPage("/admin/intelligence/revenue");

  if (!INTEL_PAGES.revenue(user.role)) return <Forbidden />;

  const { t, lang } = await getI18n();
  const selection = parseIntelSelection(params);
  const data = await loadIntelligence(user.role, selection, ["finance"]);
  const finance = data.finance;
  const currency = t("د.ع", "IQD");

  return (
    <div className="space-y-6" data-testid="intel-revenue">
      <IntelHeader active="revenue" role={user.role} t={t} lang={lang} selection={selection} range={data.ranges} title={t("الإيرادات", "Revenue")} description={t("من محرك المالية نفسه: لقطة سعر الطلب وقت البيع هي المرجع، والإيراد يُحسب عند الدفع.", "From the Finance engine itself: the order's price snapshot at the time of sale is authoritative, and revenue is recognised when paid.")} />

      {!finance?.ok ? (
        <SectionError label={t("تعذر تحميل البيانات المالية — غير متاحة الآن، وليست صفرًا.", "Financial data couldn't be loaded — unavailable right now, not zero.")} />
      ) : (
        (() => {
          const { snapshot, pack } = finance.data;

          return (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <KpiTile hero href="/admin/finance" testId="intel-revenue-total" label={t("الإيرادات", "Revenue")} value={money(pack.revenue.current, lang)} chip={<ChangeLine value={pack.revenue} lang={lang} money />} />
                <KpiTile href="/admin/finance" testId="intel-revenue-sales" label={t("المبيعات المكتملة", "Completed sales")} value={fmt(pack.completedSales.current)} chip={<ChangeLine value={pack.completedSales} lang={lang} />} />
                <KpiTile
                  href="/admin/finance"
                  testId="intel-revenue-aov"
                  label={t("متوسط قيمة البيع", "Average sale value")}
                  value={pack.averageOrderValue.current === null ? <span className="text-base text-ink-3">{t("لا توجد مبيعات", "No sales")}</span> : money(pack.averageOrderValue.current, lang)}
                  chip={pack.averageOrderValue.current !== null && pack.averageOrderValue.previous !== null ? <ChangeLine value={compare(pack.averageOrderValue.current, pack.averageOrderValue.previous)} lang={lang} money /> : undefined}
                />
                <KpiTile
                  href="/admin/finance/expenses"
                  testId="intel-revenue-profit"
                  label={t("صافي الربح", "Net profit")}
                  value={pack.netProfit.status === "ok" && pack.netProfit.current !== null ? money(pack.netProfit.current, lang) : <span className="text-base text-ink-3" data-testid="intel-profit-incomplete">{t("غير قابل للحساب", "Can't be calculated")}</span>}
                  hint={pack.netProfit.status === "ok" ? (pack.expenses ? t(`المصاريف ${money(pack.expenses.current, lang)}`, `Expenses ${money(pack.expenses.current, lang)}`) : undefined) : t("لم تُسجَّل مصاريف", "No expenses recorded")}
                />
              </div>

              <SectionCard title={t("الإيرادات والمصاريف — آخر 30 يوم", "Revenue and expenses — last 30 days")} icon={<LineChart size={14} aria-hidden />} action={{ href: "/admin/finance", label: t("المالية", "Finance") }} testId="intel-revenue-trend">
                <TrendChart
                  data={snapshot.trend.points.map((point) => ({ ...point, label: bucketLabel(point.key, snapshot.trend.view, lang) }))}
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
              </SectionCard>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
                <SectionCard title={t("الإيرادات حسب المنتج", "Revenue by product")} icon={<Boxes size={14} aria-hidden />} testId="intel-revenue-products">
                  <DataTable
                    caption={t("الإيرادات حسب المنتج", "Revenue by product")}
                    rows={snapshot.products}
                    rowKey={(row) => row.product}
                    empty={<EmptyState title={t("لا توجد مبيعات بهذه الفترة", "No sales in this period")} description={t("صفر مبيعات مكتملة — وليست بيانات مفقودة.", "Zero completed sales — not missing data.")} />}
                    columns={[
                      { key: "name", header: t("المنتج", "Product"), cell: (row) => <span className="font-semibold text-ink" data-testid="intel-revenue-product" data-name={row.name}>{row.name}</span> },
                      { key: "units", header: t("المبيعات", "Sales"), cell: (row) => <span className="nums">{row.units}</span> },
                      { key: "revenue", header: t("الإيرادات", "Revenue"), cell: (row) => <span className="nums">{money(row.revenue, lang)}</span> },
                      { key: "share", header: t("الحصة", "Share"), hideOnMobile: true, cell: (row) => <span className="nums">{row.share.toFixed(1)}%</span> },
                    ]}
                  />
                </SectionCard>
                <SectionCard title={t("الطلبات والعملاء", "Orders and customers")} testId="intel-revenue-facts">
                  <StatList
                    rows={[
                      { label: t("عملاء دفعوا", "Paying customers"), value: snapshot.customers.payingCustomers },
                      { label: t("إيراد لكل عميل دافع", "Revenue per paying customer"), value: snapshot.customers.revenuePerCustomer === null ? "—" : money(snapshot.customers.revenuePerCustomer, lang) },
                      { label: t("التجديدات", "Renewals"), value: snapshot.customers.renewals },
                      { label: t("إثباتات دفع بانتظار المراجعة", "Payment proofs awaiting review"), value: snapshot.proofs.awaitingReview },
                    ]}
                  />
                  <Link href="/admin/finance" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-ink hover:text-ink">
                    {t("التفاصيل الكاملة في المالية", "Full detail in Finance")} <ArrowLeft size={14} className="ltr:rotate-180" aria-hidden />
                  </Link>
                </SectionCard>
              </div>
            </>
          );
        })()
      )}

      <NotAvailable
        lang={lang}
        items={[
          t("الإيراد حسب القناة (موقع أو تطبيق) غير متاح: القناة غير مسجلة على الطلبات.", "Revenue by channel (website vs app) is unavailable: the channel is not recorded on orders."),
          t("لا توجد توقعات مستقبلية: التحليلات تعرض ما حدث فقط.", "No forecasts: Intelligence shows what happened, only."),
        ]}
      />
    </div>
  );
}
