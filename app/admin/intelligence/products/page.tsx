import type { Metadata } from "next";
import { Boxes, Package } from "lucide-react";

import { money } from "@/app/components/admin/finance/FinanceUI";
import { KpiTile, SectionCard, SectionError } from "@/app/components/admin/dashboard/DashboardUI";
import { Bars, ChangeLine, IntelHeader, NotAvailable, StatList, fmt } from "@/app/components/admin/intelligence/IntelUI";
import { Forbidden } from "@/app/components/admin/Forbidden";
import { DataTable } from "@/app/ui/DataTable";
import { EmptyState } from "@/app/ui/States";
import { INTEL_PAGES, canSection, compare } from "@/src/lib/intelligence";
import { requireStaffPage } from "@/src/server/auth";
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
  const [data, catalogue] = await Promise.all([loadIntelligence(user.role, selection, withMoney ? ["sales", "finance"] : ["sales"]), loadCatalogueCounts(user.role)]);
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
