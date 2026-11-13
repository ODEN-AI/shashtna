import type { Metadata } from "next";
import { Boxes, CircleDollarSign, Package } from "lucide-react";

import { money } from "@/app/components/admin/finance/FinanceUI";
import { KpiTile, SectionCard, SectionError } from "@/app/components/admin/dashboard/DashboardUI";
import { Bars, ChangeLine, IntelHeader, NotAvailable, StatList, fmt } from "@/app/components/admin/intelligence/IntelUI";
import { Forbidden } from "@/app/components/admin/Forbidden";
import { DataTable } from "@/app/ui/DataTable";
import { EmptyState } from "@/app/ui/States";
import { INTEL_PAGES, canSection, compare } from "@/src/lib/intelligence";
import { formatDuration } from "@/src/lib/subscription-duration";
import { requireStaffPage } from "@/src/server/auth";
import { getPackagePerformance } from "@/src/server/finance";
import { getI18n } from "@/src/server/i18n";
import { loadCatalogueCounts, loadIntelligence, parseIntelSelection } from "@/src/server/intelligence";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "المنتجات — الذكاء والتحليلات" };

/**
 * Product intelligence (insights or catalogue permission). Units sold come
 * from the Finance engine's recognition rules WITHOUT amounts. Revenue,
 * share and average sale value are a separate section, loaded only for
 * roles with "finance". Measurable quantities only — no product scores.
 */
export default async function IntelligenceProducts({ searchParams }: { searchParams: Promise<{ period?: string; from?: string; to?: string }> }) {
  const params = await searchParams;
  const { user } = await requireStaffPage("/admin/intelligence/products");

  if (!INTEL_PAGES.products(user.role)) return <Forbidden />;

  const { t, lang } = await getI18n();
  const selection = parseIntelSelection(params);
  const withMoney = canSection(user.role, "finance");
  const [data, catalogue, performance] = await Promise.all([
    loadIntelligence(user.role, selection, withMoney ? ["sales", "finance"] : ["sales"]),
    loadCatalogueCounts(user.role),
    // Profit per package and length: finance only, never computed for other roles.
    withMoney
      ? getPackagePerformance(selection).then(
          (value) => ({ ok: true as const, data: value }),
          (error) => {
            console.error("PACKAGE_PERFORMANCE_ERROR:", error instanceof Error ? error.message : error);
            return { ok: false as const };
          },
        )
      : null,
  ]);
  const sales = data.sales;
  const finance = data.finance;
  const previous = new Map(sales?.ok ? sales.data.volume.productsPrevious.map((row) => [row.product, row.units]) : []);
  const rows = sales?.ok ? sales.data.volume.products.map((row) => ({ ...row, change: compare(row.units, previous.get(row.product) ?? 0) })) : [];

  return (
    <div className="space-y-6" data-testid="intel-products" data-money={withMoney ? "1" : "0"}>
      <IntelHeader active="products" role={user.role} t={t} lang={lang} selection={selection} range={data.ranges} title={t("المنتجات", "Products")} description={t("كم بيع من كل باقة وجهاز بالفترة، من المبيعات المكتملة.", "How many of each package and device sold in the period, from completed sales.")} />

      {!sales?.ok ? (
        <SectionError label={t("تعذر تحميل حجم المبيعات — غير متاح الآن، وليس صفرًا.", "Sales volume couldn't be loaded — unavailable right now, not zero.")} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <KpiTile href="/admin/catalogue" testId="intel-products-sales" label={t("المبيعات المكتملة", "Completed sales")} value={fmt(sales.data.pack.completedSales.current)} chip={<ChangeLine value={sales.data.pack.completedSales} lang={lang} />} />
            <KpiTile href="/admin/catalogue" testId="intel-products-most" label={t("الأكثر مبيعًا", "Most sold")} value={sales.data.pack.mostSold ? <span className="text-xl">{sales.data.pack.mostSold.name}</span> : <span className="text-base text-ink-3">{t("لا يوجد متصدر واضح", "No clear leader")}</span>} hint={sales.data.pack.mostSold ? t(`${sales.data.pack.mostSold.units} عملية شراء`, `${sales.data.pack.mostSold.units} purchases`) : t("يحتاج عمليتين على الأقل وبدون تعادل", "needs at least 2 sales and no tie")} />
            <KpiTile href="/admin/catalogue" testId="intel-products-count" label={t("منتجات بيعت", "Products sold")} value={fmt(rows.length)} />
          </div>

          <SectionCard title={t("الوحدات المباعة حسب المنتج", "Units sold by product")} icon={<Boxes size={14} aria-hidden />} testId="intel-products-units">
            <Bars
              lang={lang}
              testId="intel-products-bars"
              empty={t("لا توجد مبيعات مكتملة بهذه الفترة.", "No completed sales in this period.")}
              rows={rows.slice(0, 10).map((row) => ({ label: row.name, value: row.units, secondary: t(`السابقة ${row.change.previous}`, `prev ${row.change.previous}`) }))}
            />
            {rows.length ? (
              <div className="mt-5">
                <DataTable
                  caption={t("الوحدات المباعة", "Units sold")}
                  rows={rows}
                  rowKey={(row) => row.product}
                  columns={[
                    { key: "name", header: t("المنتج", "Product"), cell: (row) => <span className="font-semibold text-ink" data-testid="intel-product-row" data-name={row.name} data-units={row.units}>{row.name}</span> },
                    { key: "kind", header: t("النوع", "Type"), hideOnMobile: true, cell: (row) => (row.kind === "device" ? t("جهاز", "Device") : t("باقة", "Package")) },
                    { key: "units", header: t("الوحدات", "Units"), cell: (row) => <span className="nums">{row.units}</span> },
                    { key: "change", header: t("مقارنة", "Change"), cell: (row) => <ChangeLine value={row.change} lang={lang} /> },
                  ]}
                />
              </div>
            ) : null}
          </SectionCard>
        </>
      )}

      {finance === null ? null : !finance.ok ? (
        <SectionError label={t("تعذر تحميل إيرادات المنتجات.", "Couldn't load product revenue.")} />
      ) : (
        <SectionCard title={t("الإيرادات حسب المنتج (للمالية فقط)", "Revenue by product (finance only)")} icon={<Package size={14} aria-hidden />} testId="intel-products-money">
          <DataTable
            caption={t("الإيرادات حسب المنتج", "Revenue by product")}
            rows={finance.data.snapshot.products}
            rowKey={(row) => row.product}
            empty={<EmptyState title={t("لا توجد مبيعات بهذه الفترة", "No sales in this period")} />}
            columns={[
              { key: "name", header: t("المنتج", "Product"), cell: (row) => <span className="font-semibold text-ink">{row.name}</span> },
              { key: "revenue", header: t("الإيرادات", "Revenue"), cell: (row) => <span className="nums">{money(row.revenue, lang)}</span> },
              { key: "share", header: t("الحصة", "Share"), cell: (row) => <span className="nums">{row.share.toFixed(1)}%</span> },
              { key: "aov", header: t("متوسط البيع", "Average sale"), hideOnMobile: true, cell: (row) => <span className="nums">{money(row.averageOrderValue, lang)}</span> },
            ]}
          />
        </SectionCard>
      )}

      {performance === null ? null : !performance.ok ? (
        <SectionError label={t("تعذر تحميل ربح الباقات — غير متاح الآن، وليس صفرًا.", "Package profit couldn't be loaded — unavailable right now, not zero.")} />
      ) : (
        <SectionCard title={t("الربح حسب الباقة والمدة (للمالية فقط)", "Profit by package and length (finance only)")} icon={<CircleDollarSign size={14} aria-hidden />} testId="intel-products-profit">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiTile
              href="/admin/finance"
              testId="intel-profit-total"
              label={t("الربح (بالتكاليف المعروفة)", "Profit (known costs)")}
              value={performance.data.total.knownCostUnits ? <span className="nums">{money(performance.data.total.profit, lang)}</span> : <span className="text-base text-ink-3">{t("غير معروف", "Unknown")}</span>}
              chip={performance.data.total.knownCostUnits ? <ChangeLine value={compare(performance.data.total.profit, performance.data.previousTotal.profit)} lang={lang} /> : undefined}
              hint={performance.data.total.knownCostUnits ? undefined : t("ماكو مبيعات معروفة تكلفتها بهذه الفترة", "no sales with a known cost in this period")}
            />
            <KpiTile
              href="/admin/finance"
              testId="intel-profit-margin"
              label={t("هامش الربح", "Margin")}
              value={performance.data.total.marginPct === null ? <span className="text-base text-ink-3">{t("غير معروف", "Unknown")}</span> : <span className="nums">{performance.data.total.marginPct}%</span>}
              hint={t("من المبيعات المعروفة تكلفتها", "of sales with a known cost")}
            />
            <KpiTile
              href="/admin/catalogue/packages"
              testId="intel-profit-leader"
              label={t("الأكثر ربحًا", "Most profitable")}
              value={
                performance.data.leader ? (
                  <span className="text-xl">
                    {performance.data.leader.name}
                    {performance.data.leader.durationMonths ? ` · ${formatDuration(performance.data.leader.durationMonths, lang)}` : ""}
                  </span>
                ) : (
                  <span className="text-base text-ink-3">{t("لا يوجد متصدر واضح", "No clear leader")}</span>
                )
              }
              hint={performance.data.leader ? money(performance.data.leader.profit, lang) : t("يحتاج عمليتين معروفة تكلفتها وبدون تعادل", "needs 2 known-cost sales and no tie")}
            />
            <KpiTile
              href="/admin/finance/credits"
              testId="intel-profit-unknown"
              label={t("مبيعات تكلفتها غير معروفة", "Sales with unknown cost")}
              value={<span className="nums">{fmt(performance.data.total.unknownCostUnits)}</span>}
              hint={performance.data.total.unknownCostUnits ? money(performance.data.total.unknownCostRevenue, lang) : t("كل المبيعات تكلفتها معروفة", "every sale has a known cost")}
            />
          </div>
          <div className="mt-5">
            <DataTable
              caption={t("الربح حسب الباقة والمدة", "Profit by package and length")}
              rows={performance.data.rows}
              rowKey={(row) => row.key}
              empty={<EmptyState title={t("لا توجد مبيعات باقات بهذه الفترة", "No package sales in this period")} />}
              columns={[
                { key: "name", header: t("الباقة", "Package"), cell: (row) => <span className="font-semibold text-ink" data-testid="intel-profit-row" data-units={row.units}>{row.name}</span> },
                { key: "length", header: t("المدة", "Length"), cell: (row) => (row.durationMonths ? formatDuration(row.durationMonths, lang) : <span className="text-ink-3">—</span>) },
                { key: "units", header: t("المبيعات", "Sales"), cell: (row) => <span className="nums">{row.units}</span> },
                { key: "revenue", header: t("الإيرادات", "Revenue"), cell: (row) => <span className="nums">{money(row.revenue, lang)}</span> },
                { key: "average", header: t("متوسط السعر", "Average price"), hideOnMobile: true, cell: (row) => <span className="nums">{money(row.averagePrice, lang)}</span> },
                { key: "cost", header: t("التكلفة", "Cost"), hideOnMobile: true, cell: (row) => (row.knownCostUnits ? <span className="nums">{money(row.creditCost + row.supplierShare, lang)}</span> : <span className="text-ink-3">{t("غير معروفة", "Unknown")}</span>) },
                {
                  key: "profit",
                  header: t("الربح", "Profit"),
                  cell: (row) =>
                    row.knownCostUnits ? (
                      <span className="nums">
                        {money(row.profit, lang)}
                        {row.marginPct !== null ? <span className="ms-1 text-xs text-ink-3">({row.marginPct}%)</span> : null}
                      </span>
                    ) : (
                      <span className="text-ink-3">{t("غير معروف", "Unknown")}</span>
                    ),
                },
                { key: "unknown", header: t("تكلفة غير معروفة", "Unknown cost"), hideOnMobile: true, cell: (row) => <span className="nums">{row.unknownCostUnits}</span> },
                { key: "discount", header: t("الخصم", "Discount"), hideOnMobile: true, cell: (row) => (row.discount ? <span className="nums">{money(row.discount, lang)} · {row.discountedUnits}</span> : <span className="text-ink-3">—</span>) },
              ]}
            />
          </div>
          <p className="mt-4 text-xs leading-6 text-ink-3">
            {t(
              "الربح = الإيراد − تكلفة الرصيد − حصة المورّد، للمبيعات المعروفة تكلفتها فقط. المبيعات بدون تكلفة تنعرض لحالها وما تنحسب صفر. الإيراد هو المدفوع فعلًا بعد الخصم. أجهزة VIP مو ضمن الباقات، ومكافآت النقاط مو مبيعات.",
              "Profit = revenue − credit cost − supplier share, on known-cost sales only. Sales without a cost are shown apart and never counted as zero. Revenue is what was paid, after discounts. VIP devices aren't packages, and points rewards aren't sales.",
            )}
          </p>
        </SectionCard>
      )}

      <SectionCard title={t("الكتالوج الآن", "Catalogue now")} icon={<Package size={14} aria-hidden />} action={{ href: "/admin/catalogue", label: t("الكتالوج", "Catalogue") }} testId="intel-products-catalogue">
        {!catalogue?.ok ? (
          <SectionError label={t("تعذر تحميل الكتالوج.", "Couldn't load the catalogue.")} />
        ) : (
          <StatList
            rows={[
              { label: t("باقات فعالة", "Active packages"), value: catalogue.data.packagesActive },
              { label: t("باقات مخفية", "Hidden packages"), value: catalogue.data.packagesInactive },
              { label: t("باقات بدون أجهزة متوافقة", "Packages without compatible devices"), value: catalogue.data.packagesWithoutDevices },
              { label: t("أجهزة فعالة", "Active devices"), value: `${catalogue.data.devicesActive} / ${catalogue.data.devicesTotal}` },
              { label: t("أجهزة غير مربوطة بباقة", "Devices not linked to a package"), value: catalogue.data.devicesUnlinked },
            ]}
          />
        )}
      </SectionCard>

      <NotAvailable
        lang={lang}
        items={[
          t("مشاهدات صفحات المنتجات ونسبة التحويل غير متاحة: الزيارات غير مُجمَّعة.", "Product page views and conversion are unavailable: visits are not collected."),
          t("لا يوجد «تقييم» للمنتجات: تُعرض الكميات المقاسة فقط.", "No product “score”: only measured quantities are shown."),
        ]}
      />
    </div>
  );
}
