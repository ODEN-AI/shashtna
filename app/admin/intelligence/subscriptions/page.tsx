import type { Metadata } from "next";
import { CalendarClock, Layers } from "lucide-react";

import { KpiTile, SectionCard, SectionError } from "@/app/components/admin/dashboard/DashboardUI";
import { ChangeLine, IntelHeader, NotAvailable, StatList, fmt } from "@/app/components/admin/intelligence/IntelUI";
import { Forbidden } from "@/app/components/admin/Forbidden";
import { DataTable } from "@/app/ui/DataTable";
import { EmptyState } from "@/app/ui/States";
import { INTEL_PAGES } from "@/src/lib/intelligence";
import { requireStaffPage } from "@/src/server/auth";
import { getI18n } from "@/src/server/i18n";
import { loadIntelligence, parseIntelSelection } from "@/src/server/intelligence";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "الاشتراكات — الذكاء والتحليلات" };

/**
 * Subscription intelligence (subscriptions permission). States use the
 * shared deriveSubscriptionState rules and the renewal window is the same
 * renewalWindow() the renewals queue uses. Renewal rate is not shown: a
 * renewal overwrites the subscription's expiry, so who was "due" in a past
 * period can't be reconstructed.
 */
export default async function IntelligenceSubscriptions({ searchParams }: { searchParams: Promise<{ period?: string; from?: string; to?: string }> }) {
  const params = await searchParams;
  const { user } = await requireStaffPage("/admin/intelligence/subscriptions");

  if (!INTEL_PAGES.subscriptions(user.role)) return <Forbidden />;

  const { t, lang } = await getI18n();
  const selection = parseIntelSelection(params);
  const data = await loadIntelligence(user.role, selection, ["subscriptions"]);
  const subs = data.subscriptions;

  return (
    <div className="space-y-6" data-testid="intel-subscriptions">
      <IntelHeader active="subscriptions" role={user.role} t={t} lang={lang} selection={selection} range={data.ranges} title={t("الاشتراكات", "Subscriptions")} description={t("الحالات الآن (نفس قواعد النظام)، نافذة التجديد، والتجديدات المكتملة بالفترة.", "States right now (the system's own rules), the renewal window, and renewals completed in the period.")} />

      {!subs?.ok ? (
        <SectionError label={t("تعذر تحميل بيانات الاشتراكات — غير متاحة الآن، وليست صفرًا.", "Subscription data couldn't be loaded — unavailable right now, not zero.")} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiTile href="/admin/subscriptions" testId="intel-subs-active" label={t("فعالة الآن", "Active now")} value={fmt(subs.data.pack.active)} hint={t(`منها ${subs.data.pack.expiring} تنتهي خلال ${subs.data.pack.expiringWindowDays} أيام`, `${subs.data.pack.expiring} ending within ${subs.data.pack.expiringWindowDays} days`)} />
            <KpiTile href="/admin/renewals" testId="intel-subs-due" label={t("ضمن نافذة التجديد", "In the renewal window")} value={fmt(subs.data.pack.dueForRenewal)} hint={t("انتهت خلال 30 يوم أو تنتهي خلال 14 يوم", "expired in the last 30 days or ending in the next 14")} />
            <KpiTile href="/admin/subscriptions" testId="intel-subs-renewals" label={t("التجديدات المكتملة", "Renewals completed")} value={fmt(subs.data.pack.renewals.current)} chip={<ChangeLine value={subs.data.pack.renewals} lang={lang} />} />
            <KpiTile href="/admin/subscriptions" testId="intel-subs-expired" label={t("منتهية", "Expired")} value={fmt(subs.data.pack.expired)} hint={t(`موقوفة: ${subs.data.pack.suspended}`, `Suspended: ${subs.data.pack.suspended}`)} />
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <SectionCard title={t("حسب الباقة", "By package")} icon={<Layers size={14} aria-hidden />} testId="intel-subs-packages">
              <DataTable
                caption={t("الاشتراكات حسب الباقة", "Subscriptions by package")}
                rows={subs.data.packages}
                rowKey={(row) => row.name}
                empty={<EmptyState title={t("لا توجد اشتراكات", "No subscriptions")} description={t("لا يوجد أي اشتراك مسجل.", "No subscription is recorded.")} />}
                columns={[
                  { key: "name", header: t("الباقة", "Package"), cell: (row) => <span className="font-semibold text-ink" data-testid="intel-subs-package" data-name={row.name} data-active={row.active}>{row.name}</span> },
                  { key: "active", header: t("فعالة", "Active"), cell: (row) => <span className="nums">{row.active}</span> },
                  { key: "expiring", header: t("تنتهي قريبًا", "Ending soon"), cell: (row) => <span className="nums">{row.expiring}</span> },
                  { key: "expired", header: t("منتهية", "Expired"), hideOnMobile: true, cell: (row) => <span className="nums">{row.expired}</span> },
                ]}
              />
            </SectionCard>
            <SectionCard title={t("كيف تُحسب", "How these are counted")} icon={<CalendarClock size={14} aria-hidden />}>
              <StatList
                rows={[
                  { label: t("فعال", "Active"), value: t("لم ينتهِ وغير موقوف", "not expired, not suspended") },
                  { label: t("ينتهي قريبًا", "Ending soon"), value: t(`خلال ${subs.data.pack.expiringWindowDays} أيام`, `within ${subs.data.pack.expiringWindowDays} days`) },
                  { label: t("التجديد", "Renewal"), value: t("طلب تجديد مكتمل بالفترة", "a completed renewal order in the period") },
                ]}
              />
            </SectionCard>
          </div>
        </>
      )}

      <NotAvailable
        lang={lang}
        items={[
          t("نسبة التجديد غير متاحة: التجديد يحدّث تاريخ انتهاء نفس الاشتراك، فلا يُعرف من كان مستحقًا بفترة سابقة.", "Renewal rate is unavailable: a renewal updates the same subscription's expiry, so who was due in a past period isn't known."),
          t("عدد الاتصالات الحية غير متاح: النظام غير مرتبط بلوحة IPTV.", "Live connection counts are unavailable: the system isn't connected to the IPTV panel."),
        ]}
      />
    </div>
  );
}
