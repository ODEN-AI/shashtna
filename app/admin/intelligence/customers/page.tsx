import type { Metadata } from "next";
import Link from "next/link";
import { Crown, UserPlus, UsersRound, Wallet } from "lucide-react";

import { BarChart } from "@/app/components/admin/BarChart";
import { bucketLabel, money } from "@/app/components/admin/finance/FinanceUI";
import { KpiTile, SectionCard, SectionError } from "@/app/components/admin/dashboard/DashboardUI";
import { ChangeLine, IntelHeader, NotAvailable, StatList, fmt } from "@/app/components/admin/intelligence/IntelUI";
import { Forbidden } from "@/app/components/admin/Forbidden";
import { Badge } from "@/app/ui/Badge";
import { DataTable } from "@/app/ui/DataTable";
import { EmptyState } from "@/app/ui/States";
import type { CustomerTier } from "@/src/lib/customer-value";
import { INTEL_PAGES, canSection } from "@/src/lib/intelligence";
import { requireStaffPage } from "@/src/server/auth";
import { getCustomerValue } from "@/src/server/finance";
import { getI18n } from "@/src/server/i18n";
import { loadIntelligence, parseIntelSelection } from "@/src/server/intelligence";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "العملاء — الذكاء والتحليلات" };

const TIER_LABELS: Record<CustomerTier, { ar: string; en: string }> = {
  TOP: { ar: "الأعلى قيمة (أعلى 20%)", en: "Highest value (top 20%)" },
  MIDDLE: { ar: "متوسطة (الـ30% التالية)", en: "Middle (next 30%)" },
  BASE: { ar: "أساسية (الباقي)", en: "Base (the rest)" },
};

/**
 * Customer intelligence (customers permission): sign-ups, paying, returning
 * and first-time customers. Money per customer — and customer value (what
 * each customer actually paid, tiers, first-purchase cohorts) — is loaded
 * only for roles with "finance". No projected lifetime value; renewal and
 * churn rates wait until enough terms have ended (docs/bi/).
 */
export default async function IntelligenceCustomers({ searchParams }: { searchParams: Promise<{ period?: string; from?: string; to?: string }> }) {
  const params = await searchParams;
  const { user } = await requireStaffPage("/admin/intelligence/customers");

  if (!INTEL_PAGES.customers(user.role)) return <Forbidden />;

  const { t, lang } = await getI18n();
  const selection = parseIntelSelection(params);
  const withMoney = canSection(user.role, "finance");
  const [data, value] = await Promise.all([
    loadIntelligence(user.role, selection, withMoney ? ["customers", "finance"] : ["customers"]),
    // What each customer actually paid: finance only, never computed for other roles.
    withMoney
      ? getCustomerValue().then(
          (result) => ({ ok: true as const, data: result }),
          (error) => {
            console.error("CUSTOMER_VALUE_ERROR:", error instanceof Error ? error.message : error);
            return { ok: false as const };
          },
        )
      : null,
  ]);
  const customers = data.customers;
  const finance = data.finance;

  return (
    <div className="space-y-6" data-testid="intel-customers">
      <IntelHeader active="customers" role={user.role} t={t} lang={lang} selection={selection} range={data.ranges} title={t("العملاء", "Customers")} description={t("تسجيلات، عملاء دفعوا، عائدون ولأول مرة — من الحسابات والمبيعات المكتملة.", "Sign-ups, paying, returning and first-time customers — from accounts and completed sales.")} />

      {!customers?.ok ? (
        <SectionError label={t("تعذر تحميل بيانات العملاء — غير متاحة الآن، وليست صفرًا.", "Customer data couldn't be loaded — unavailable right now, not zero.")} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiTile href="/admin/customers" testId="intel-customers-new" label={t("عملاء جدد", "New customers")} value={fmt(customers.data.pack.new.current)} chip={<ChangeLine value={customers.data.pack.new} lang={lang} />} />
            <KpiTile href="/admin/customers" testId="intel-customers-paying" label={t("عملاء دفعوا", "Paying customers")} value={fmt(customers.data.pack.paying.current)} chip={<ChangeLine value={customers.data.pack.paying} lang={lang} />} />
            <KpiTile href="/admin/customers" testId="intel-customers-returning" label={t("عائدون", "Returning")} value={fmt(customers.data.pack.returning)} hint={t("دفعوا قبل هذه الفترة أيضًا", "also paid before this period")} />
            <KpiTile href="/admin/customers" testId="intel-customers-first" label={t("لأول مرة", "First-time")} value={fmt(customers.data.pack.firstTime)} hint={t(`من أصل ${customers.data.pack.total} عميل`, `of ${customers.data.pack.total} customers`)} />
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <SectionCard title={t("التسجيلات الجديدة", "New sign-ups")} icon={<UserPlus size={14} aria-hidden />} testId="intel-customers-signups">
              <BarChart
                label={t("التسجيلات حسب الفترة", "Sign-ups per period")}
                formatValue={(value) => fmt(value)}
                tickEvery={Math.max(1, Math.ceil(customers.data.signups.points.length / 8))}
                data={customers.data.signups.points.map((point) => ({ key: point.key, label: bucketLabel(point.key, customers.data.signups.granularity, lang), value: point.value }))}
              />
            </SectionCard>
            <SectionCard title={t("كيف تُحسب", "How these are counted")} icon={<UsersRound size={14} aria-hidden />}>
              <ul className="list-disc space-y-1.5 ps-5 text-xs leading-6 text-ink-3">
                <li>{t("عميل جديد: حساب غير موظف أُنشئ خلال الفترة (بتوقيت بغداد).", "New customer: a non-staff account created in the period (Baghdad time).")}</li>
                <li>{t("عميل دفع: له عملية بيع مكتملة خلال الفترة حسب قواعد محرك المالية.", "Paying customer: has a completed sale in the period, by the Finance engine's rules.")}</li>
                <li>{t("عائد: دفع خلال الفترة وكان قد دفع قبلها.", "Returning: paid in the period and had paid before it.")}</li>
              </ul>
            </SectionCard>
          </div>
        </>
      )}

      {finance === null ? null : !finance.ok ? (
        <SectionError label={t("تعذر تحميل القيم المالية للعملاء.", "Couldn't load customer money figures.")} />
      ) : (
        <SectionCard title={t("القيمة المالية (للمالية فقط)", "Money (finance only)")} icon={<Wallet size={14} aria-hidden />} testId="intel-customers-money">
          <StatList
            rows={[
              { label: t("إيراد لكل عميل دافع بالفترة", "Revenue per paying customer in the period"), value: finance.data.snapshot.customers.revenuePerCustomer === null ? "—" : money(finance.data.snapshot.customers.revenuePerCustomer, lang) },
              { label: t("متوسط ما دفعه العميل منذ البداية", "Average paid per customer, all time"), value: finance.data.snapshot.customers.averageCustomerValue === null ? "—" : money(finance.data.snapshot.customers.averageCustomerValue, lang), hint: t("ما دُفع فعلًا، ليس قيمة متوقعة", "what was actually paid, not a projected value") },
            ]}
          />
        </SectionCard>
      )}

      {value === null ? null : !value.ok ? (
        <SectionError label={t("تعذر تحميل قيمة العملاء — غير متاحة الآن، وليست صفرًا.", "Customer value couldn't be loaded — unavailable right now, not zero.")} />
      ) : (
        <SectionCard title={t("قيمة العملاء (للمالية فقط)", "Customer value (finance only)")} icon={<Crown size={14} aria-hidden />} testId="intel-customers-value">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiTile href="/admin/customers" testId="intel-value-paying" label={t("عملاء دفعوا", "Paying customers")} value={<span className="nums">{fmt(value.data.summary.payingCustomers)}</span>} hint={t(`${value.data.summary.activeNow} عندهم اشتراك شغّال`, `${value.data.summary.activeNow} with a running subscription`)} />
            <KpiTile href="/admin/customers" testId="intel-value-average" label={t("متوسط ما دفعه العميل", "Average paid per customer")} value={value.data.summary.averagePaid === null ? "—" : <span className="nums">{money(value.data.summary.averagePaid, lang)}</span>} hint={value.data.summary.medianPaid === null ? undefined : t(`الوسيط ${money(value.data.summary.medianPaid, "ar")}`, `median ${money(value.data.summary.medianPaid, "en")}`)} />
            <KpiTile href="/admin/customers" testId="intel-value-top" label={t("حصة أعلى 20% من الإيراد", "Revenue share of the top 20%")} value={<span className="nums">{value.data.tiers.TOP.revenueSharePct}%</span>} hint={t(`${value.data.tiers.TOP.customers} عميل`, `${value.data.tiers.TOP.customers} customer${value.data.tiers.TOP.customers === 1 ? "" : "s"}`)} />
            <KpiTile href="/admin/customers" testId="intel-value-repeat" label={t("اشتروا أكثر من مرة", "Bought more than once")} value={<span className="nums">{fmt(value.data.summary.repeatBuyers)}</span>} hint={t("تجديد أو شراء ثاني", "a renewal or a second purchase")} />
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <div>
              <h3 className="mb-3 text-sm font-semibold text-ink-2">{t("فئات العملاء حسب ما دفعوا", "Customer tiers by amount paid")}</h3>
              <DataTable
                caption={t("فئات العملاء", "Customer tiers")}
                rows={(["TOP", "MIDDLE", "BASE"] as const).map((tier) => ({ tier, ...value.data.tiers[tier] }))}
                rowKey={(row) => row.tier}
                columns={[
                  { key: "tier", header: t("الفئة", "Tier"), cell: (row) => <span className="font-semibold text-ink">{TIER_LABELS[row.tier][lang]}</span> },
                  { key: "customers", header: t("العملاء", "Customers"), cell: (row) => <span className="nums">{row.customers}</span> },
                  { key: "revenue", header: t("دفعوا", "Paid"), cell: (row) => <span className="nums">{money(row.revenue, lang)}</span> },
                  { key: "share", header: t("الحصة", "Share"), cell: (row) => <span className="nums">{row.revenueSharePct}%</span> },
                  { key: "min", header: t("من", "From"), hideOnMobile: true, cell: (row) => (row.minPaid === null ? "—" : <span className="nums">{money(row.minPaid, lang)}</span>) },
                ]}
              />
            </div>
            <div>
              <h3 className="mb-3 text-sm font-semibold text-ink-2">{t("حسب شهر أول شراء", "By month of first purchase")}</h3>
              <DataTable
                caption={t("مجموعات العملاء حسب شهر أول شراء", "Customer groups by month of first purchase")}
                rows={value.data.cohorts}
                rowKey={(row) => row.month}
                empty={<EmptyState title={t("ماكو مبيعات بعد", "No sales yet")} />}
                columns={[
                  { key: "month", header: t("الشهر", "Month"), cell: (row) => <span className="nums font-semibold text-ink" dir="ltr">{row.month}</span> },
                  { key: "customers", header: t("العملاء", "Customers"), cell: (row) => <span className="nums">{row.customers}</span> },
                  { key: "revenue", header: t("دفعوا لحد الآن", "Paid so far"), cell: (row) => <span className="nums">{money(row.revenue, lang)}</span> },
                  { key: "active", header: t("شغّالين الآن", "Running now"), cell: (row) => <span className="nums">{row.activeNow}</span> },
                  { key: "repeat", header: t("اشتروا مرة ثانية", "Bought again"), hideOnMobile: true, cell: (row) => <span className="nums">{row.repeatBuyers}</span> },
                ]}
              />
            </div>
          </div>

          <div className="mt-6">
            <h3 className="mb-3 text-sm font-semibold text-ink-2">{t("أعلى العملاء قيمة", "Highest-value customers")}</h3>
            <DataTable
              caption={t("أعلى العملاء قيمة", "Highest-value customers")}
              rows={value.data.top}
              rowKey={(row) => String(row.userId)}
              empty={<EmptyState title={t("ماكو مبيعات بعد", "No sales yet")} />}
              columns={[
                {
                  key: "name",
                  header: t("العميل", "Customer"),
                  cell: (row) => (
                    <Link href={`/admin/customers/${row.userId}`} className="font-semibold text-ink hover:text-brand-ink" data-testid="intel-value-row">
                      {row.name}
                    </Link>
                  ),
                },
                { key: "paid", header: t("دفع", "Paid"), cell: (row) => <span className="nums">{money(row.totalPaid, lang)}</span> },
                { key: "purchases", header: t("المشتريات", "Purchases"), cell: (row) => <span className="nums">{row.purchases}</span> },
                { key: "since", header: t("أول شراء", "First purchase"), hideOnMobile: true, cell: (row) => <span className="nums" dir="ltr">{row.firstPurchase}</span> },
                { key: "active", header: t("الحالة", "Status"), cell: (row) => (row.activeNow ? <Badge tone="success">{t("شغّال", "Running")}</Badge> : <Badge>{t("منتهي", "Ended")}</Badge>) },
              ]}
            />
          </div>

          <p className="mt-4 text-xs leading-6 text-ink-3">
            {t(
              "كل الأرقام هي اللي دُفعت فعلًا، مو توقعات. الفئات نسبية: أعلى 20% من العملاء حسب ما دفعوا، بعدها 30%، والباقي. حسابات الموظفين ومكافآت النقاط مو محسوبة. «شغّال» يعني عنده اشتراك ما انتهى.",
              "Every figure is what was actually paid, not a forecast. Tiers are relative: the top 20% of customers by amount paid, the next 30%, then the rest. Staff accounts and points rewards are left out. “Running” means a subscription that hasn't ended.",
            )}
          </p>
        </SectionCard>
      )}

      <NotAvailable
        lang={lang}
        items={[
          t("قيمة العميل المتوقعة مستقبلًا (CLV) غير محسوبة: تحتاج توقعًا لا تدعمه البيانات. نعرض ما دُفع فعلًا.", "Projected customer lifetime value (CLV) isn't calculated: it needs a forecast the data can't support. What was actually paid is shown."),
          t("نسبة التجديد والفقد غير محسوبة بعد: ما انتهت اشتراكات كافية. تجي بعد ما تنتهي أول الاشتراكات.", "Renewal and churn rates aren't calculated yet: too few subscriptions have ended. They come once the first terms end."),
          t("مصدر العميل (إعلان، إحالة…) غير مسجل.", "Customer acquisition source (ad, referral…) is not recorded."),
        ]}
      />
    </div>
  );
}
