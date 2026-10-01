import type { Metadata } from "next";
import { BellRing, Megaphone } from "lucide-react";

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
export const metadata: Metadata = { title: "العروض والمحتوى — الذكاء والتحليلات" };

/**
 * Promotions & content intelligence (content permission): lifecycle
 * states (the shared console rules) and in-app notification counts. No
 * ROI, CTR, conversion or ROAS — impressions, clicks and attribution are
 * not recorded.
 */
export default async function IntelligencePromotions({ searchParams }: { searchParams: Promise<{ period?: string; from?: string; to?: string }> }) {
  const params = await searchParams;
  const { user } = await requireStaffPage("/admin/intelligence/promotions");

  if (!INTEL_PAGES.promotions(user.role)) return <Forbidden />;

  const { t, lang } = await getI18n();
  const selection = parseIntelSelection(params);
  const data = await loadIntelligence(user.role, selection, ["promotions"]);
  const promos = data.promotions;

  return (
    <div className="space-y-6" data-testid="intel-promotions">
      <IntelHeader active="promotions" role={user.role} t={t} lang={lang} selection={selection} range={data.ranges} title={t("العروض والمحتوى", "Promotions & content")} description={t("حالة المحتوى الآن والإشعارات المرسلة بالفترة.", "Content state right now and notifications sent in the period.")} />

      {!promos?.ok ? (
        <SectionError label={t("تعذر تحميل بيانات المحتوى — غير متاحة الآن، وليست صفرًا.", "Content data couldn't be loaded — unavailable right now, not zero.")} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiTile href="/admin/promotions/content?view=live" testId="intel-promo-live" label={t("منشور الآن", "Live now")} value={fmt(promos.data.pack.live)} hint={t(`${promos.data.pack.endingSoon} ينتهي خلال ${promos.data.pack.endingSoonDays} أيام`, `${promos.data.pack.endingSoon} ending within ${promos.data.pack.endingSoonDays} days`)} />
            <KpiTile href="/admin/promotions/content?view=scheduled" testId="intel-promo-scheduled" label={t("مجدول", "Scheduled")} value={fmt(promos.data.pack.scheduled)} />
            <KpiTile href="/admin/promotions" testId="intel-promo-sent" label={t("إشعارات مرسلة", "Notifications sent")} value={fmt(promos.data.pack.notificationsSent.current)} chip={<ChangeLine value={promos.data.pack.notificationsSent} lang={lang} />} />
            <KpiTile href="/admin/promotions" testId="intel-promo-read" label={t("إشعارات مقروءة", "Notifications read")} value={fmt(promos.data.pack.notificationsRead)} hint={t("من المرسلة بهذه الفترة", "of those sent in this period")} />
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <SectionCard title={t("حالة المحتوى", "Content state")} icon={<Megaphone size={14} aria-hidden />} action={{ href: "/admin/promotions", label: t("العروض", "Promotions") }} testId="intel-promo-states">
              <StatList
                rows={[
                  { label: t("منشور", "Live"), value: promos.data.pack.live },
                  { label: t("مجدول", "Scheduled"), value: promos.data.pack.scheduled },
                  { label: t("منتهي", "Ended"), value: promos.data.pack.ended },
                  { label: t("متوقف", "Inactive"), value: promos.data.pack.inactive },
                  { label: t("منشور بدون صورة أو فيديو", "Live without an image or video"), value: promos.data.missingMedia },
                ]}
              />
            </SectionCard>
            <SectionCard title={t("الإشعارات حسب النوع", "Notifications by type")} icon={<BellRing size={14} aria-hidden />} testId="intel-promo-types">
              <DataTable
                caption={t("الإشعارات حسب النوع", "Notifications by type")}
                rows={promos.data.byType}
                rowKey={(row) => row.type}
                empty={<EmptyState title={t("لم تُرسل إشعارات بهذه الفترة", "No notifications sent in this period")} />}
                columns={[
                  { key: "type", header: t("النوع", "Type"), cell: (row) => <span className="font-mono text-xs text-ink">{row.type}</span> },
                  { key: "sent", header: t("مرسلة", "Sent"), cell: (row) => <span className="nums">{row.sent}</span> },
                  { key: "read", header: t("مقروءة", "Read"), cell: (row) => <span className="nums">{row.read}</span> },
                ]}
              />
              <p className="mt-3 text-xs text-ink-3">{t("«مقروءة» تعني أن العميل فتح الإشعار داخل حسابه — ليست نقرة على رابط.", "“Read” means the customer opened it in their account — not a link click.")}</p>
            </SectionCard>
          </div>
        </>
      )}

      <NotAvailable
        lang={lang}
        items={[
          t("العائد على الإعلان (ROI/ROAS) والنقرات (CTR) والتحويل غير متاحة: لا تُسجَّل مشاهدات أو نقرات أو نسبة الطلب للعرض.", "Ad ROI/ROAS, click-through (CTR) and conversion are unavailable: impressions, clicks and order attribution are not recorded."),
        ]}
      />
    </div>
  );
}
