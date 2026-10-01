import type { Metadata } from "next";
import { UserPlus, UsersRound, Wallet } from "lucide-react";

import { BarChart } from "@/app/components/admin/BarChart";
import { bucketLabel, money } from "@/app/components/admin/finance/FinanceUI";
import { KpiTile, SectionCard, SectionError } from "@/app/components/admin/dashboard/DashboardUI";
import { ChangeLine, IntelHeader, NotAvailable, StatList, fmt } from "@/app/components/admin/intelligence/IntelUI";
import { Forbidden } from "@/app/components/admin/Forbidden";
import { INTEL_PAGES, canSection } from "@/src/lib/intelligence";
import { requireStaffPage } from "@/src/server/auth";
import { getI18n } from "@/src/server/i18n";
import { loadIntelligence, parseIntelSelection } from "@/src/server/intelligence";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "العملاء — الذكاء والتحليلات" };

/**
 * Customer intelligence (customers permission): sign-ups, paying, returning
 * and first-time customers. Money per customer is loaded only for roles
 * with "finance". No lifetime value, churn, retention or cohorts.
 */
export default async function IntelligenceCustomers({ searchParams }: { searchParams: Promise<{ period?: string; from?: string; to?: string }> }) {
  const params = await searchParams;
  const { user } = await requireStaffPage("/admin/intelligence/customers");

  if (!INTEL_PAGES.customers(user.role)) return <Forbidden />;

  const { t, lang } = await getI18n();
  const selection = parseIntelSelection(params);
  const data = await loadIntelligence(user.role, selection, canSection(user.role, "finance") ? ["customers", "finance"] : ["customers"]);
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

      <NotAvailable
        lang={lang}
        items={[
          t("قيمة العميل مدى الحياة (CLV) غير محسوبة: تحتاج توقعًا لا تدعمه البيانات.", "Customer lifetime value (CLV) isn't calculated: it needs a projection the data can't support."),
          t("نسبة الفقد والاحتفاظ والمجموعات غير محسوبة: لا توجد بيانات دورة حياة موثوقة (التجديد يحدّث نفس الاشتراك).", "Churn, retention and cohorts aren't calculated: there is no reliable lifecycle data (a renewal updates the same subscription)."),
          t("مصدر العميل (إعلان، إحالة…) غير مسجل.", "Customer acquisition source (ad, referral…) is not recorded."),
        ]}
      />
    </div>
  );
}
