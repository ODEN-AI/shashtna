import type { Metadata } from "next";
import Link from "next/link";
import { Bell, CalendarClock, Clock3, Globe, Plus, Users } from "lucide-react";

import { LifecycleBadge, PromotionsHeader, contentLabels } from "@/app/components/admin/promotions/PromotionsUI";
import { EmptyLine, KpiTile, SectionCard, SectionError } from "@/app/components/admin/dashboard/DashboardUI";
import { Forbidden } from "@/app/components/admin/Forbidden";
import { LinkButton } from "@/app/ui/Button";
import { PLACEMENT_WEBSITE } from "@/src/lib/content-console";
import { formatDateTime } from "@/src/lib/i18n";
import { hasPermission } from "@/src/lib/roles";
import { requireStaffPage } from "@/src/server/auth";
import { getI18n } from "@/src/server/i18n";
import { getPromotionsOverview } from "@/src/server/promotions-console";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "العروض والمحتوى" };

/**
 * Promotions & content command centre: what the public site and Shashtna
 * Player show right now, what's scheduled or ending, and the in-app
 * notifications sent to customers. Sections load only for roles that hold
 * their permission (content / support).
 */
export default async function PromotionsPage() {
  const { user } = await requireStaffPage("/admin/promotions");

  if (!hasPermission(user.role, "content") && !hasPermission(user.role, "support")) return <Forbidden />;

  const { t, lang } = await getI18n();
  const data = await getPromotionsOverview(user.role);
  const labels = contentLabels(t);

  return (
    <div className="space-y-6" data-testid="promotions-overview">
      <PromotionsHeader
        active="overview"
        t={t}
        can={data.can}
        title={t("العروض والمحتوى", "Promotions & content")}
        description={t("ما يعرضه الموقع والتطبيق الآن، وما هو مجدول أو على وشك الانتهاء، والإشعارات المرسلة للعملاء.", "What the website and the app show right now, what's scheduled or ending, and notifications sent to customers.")}
        actions={
          data.can("content") ? (
            <>
              <LinkButton href="/admin/promotions/items/new?kind=OFFER" size="sm"><Plus size={15} aria-hidden /> {t("عرض جديد", "New offer")}</LinkButton>
              <LinkButton href="/admin/promotions/items/new?kind=NEWS" size="sm" variant="secondary"><Plus size={15} aria-hidden /> {t("خبر جديد", "New news item")}</LinkButton>
            </>
          ) : null
        }
      />

      {data.content === null ? null : !data.content.ok ? (
        <SectionError label={t("تعذر تحميل الإعلانات والعروض.", "Couldn't load ads and announcements.")} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="promo-kpis">
            <KpiTile hero label={t("يُعرض الآن", "Live now")} value={data.content.counts.live} hint={t(`${data.content.player} منها في التطبيق`, `${data.content.player} also in the app`)} href="/admin/promotions/content?view=live" testId="promo-kpi-live" />
            <KpiTile label={t("مجدول", "Scheduled")} value={data.content.counts.scheduled} href="/admin/promotions/content?view=scheduled" testId="promo-kpi-scheduled" />
            <KpiTile label={t(`ينتهي خلال ${data.endingSoonDays} أيام`, `Ending in ${data.endingSoonDays} days`)} value={data.content.counts.ending} href="/admin/promotions/content?view=ending" testId="promo-kpi-ending" />
            <KpiTile label={t("انتهت مدته وما زال مفعّلًا", "Ended but still published")} value={data.content.counts.ended} hint={t(`${data.content.counts.inactive} متوقف`, `${data.content.counts.inactive} inactive`)} href="/admin/promotions/content?view=ended" testId="promo-kpi-ended" />
          </div>
          <p className="text-xs text-ink-3" data-testid="promo-split">
            {t(`${data.content.counts.offers} إعلان/عرض · ${data.content.counts.announcements} خبر/تنبيه`, `${data.content.counts.offers} ads/offers · ${data.content.counts.announcements} news/announcements`)}
          </p>

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title={t("ما يُعرض الآن حسب المكان", "Live now by placement")} icon={<Globe size={14} aria-hidden />} testId="promo-by-placement">
              {data.content.byPlacement.length ? (
                <ul className="space-y-2">
                  {data.content.byPlacement.map(([placement, count]) => (
                    <li key={placement}>
                      <Link href={`/admin/promotions/content?view=live&placement=${placement}`} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-white/[0.02] px-3 py-2.5 text-sm hover:border-brand/40" data-testid="promo-placement-row" data-placement={placement}>
                        <span className="min-w-0">
                          <span className="block truncate font-semibold text-ink">{labels.placement[placement] ?? placement}</span>
                          <span className="block truncate text-xs text-ink-3" dir="ltr">{PLACEMENT_WEBSITE[placement] ?? t("التطبيق فقط (Shashtna Player)", "App only (Shashtna Player)")}</span>
                        </span>
                        <span className="nums shrink-0 text-lg font-bold text-ink">{count}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyLine>{t("لا يُعرض أي إعلان الآن. الأقسام الخاصة بها مخفية في الموقع.", "Nothing is live. Those sections are hidden on the website.")}</EmptyLine>
              )}
            </SectionCard>

            <SectionCard title={t("ما يُعرض الآن حسب الجمهور", "Live now by audience")} icon={<Users size={14} aria-hidden />} testId="promo-by-audience">
              {data.content.byAudience.length ? (
                <ul className="divide-y divide-line/60">
                  {data.content.byAudience.map(([audience, count]) => (
                    <li key={audience} className="flex items-center justify-between gap-3 py-2.5 text-sm" data-testid="promo-audience-row" data-audience={audience}>
                      <span className="text-ink">{labels.audience[audience] ?? audience}</span>
                      <span className="nums font-bold text-ink">{count}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyLine>{t("لا يوجد محتوى منشور الآن.", "Nothing is published right now.")}</EmptyLine>
              )}
              <p className="mt-3 text-xs leading-5 text-ink-3">{t("الجمهور يُطبَّق عند العرض حسب حالة الزائر (زائر، منتهي، نشط، ينتهي قريبًا، VIP).", "Audience is applied when shown, by the viewer's state (guest, expired, active, expiring, VIP).")}</p>
            </SectionCard>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title={t("ينتهي قريبًا", "Ending soon")} icon={<CalendarClock size={14} aria-hidden />} action={{ href: "/admin/promotions/content?view=ending", label: t("عرض", "View") }} testId="promo-ending">
              {data.content.ending.length ? (
                <ul className="space-y-2">
                  {data.content.ending.map((item) => (
                    <li key={item.id}>
                      <Link href={`/admin/promotions/items/${item.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-warning/30 bg-warning/5 px-3 py-2.5 text-sm hover:border-warning/60">
                        <span className="truncate font-semibold text-ink">{item.title}</span>
                        <span className="nums shrink-0 text-xs text-warning">{formatDateTime(item.endsAt, lang)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyLine>{t("لا شيء ينتهي خلال الأيام القادمة.", "Nothing ends in the coming days.")}</EmptyLine>
              )}
            </SectionCard>

            <SectionCard title={t("آخر تعديلات المحتوى", "Latest content changes")} icon={<Clock3 size={14} aria-hidden />} testId="promo-activity">
              {!data.activity?.ok ? (
                <SectionError label={t("تعذر تحميل السجل.", "Couldn't load the log.")} />
              ) : data.activity.data.length ? (
                <ul className="divide-y divide-line/60">
                  {data.activity.data.map((event) => (
                    <li key={event.id} className="py-2.5 text-sm">
                      {event.action === "ANNOUNCEMENT_DELETED" || !event.entityId ? (
                        <span className="text-ink">{event.summary}</span>
                      ) : (
                        <Link href={`/admin/promotions/items/${event.entityId}`} className="text-ink hover:text-brand-ink">{event.summary}</Link>
                      )}
                      <span className="nums block text-xs text-ink-3">{formatDateTime(event.createdAt, lang)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyLine>{t("لا توجد تعديلات مسجلة بعد.", "No recorded changes yet.")}</EmptyLine>
              )}
            </SectionCard>
          </div>
        </>
      )}

      {data.notifications === null ? null : (
        <SectionCard title={t("الإشعارات داخل الحساب", "In-account notifications")} icon={<Bell size={14} aria-hidden />} action={{ href: "/admin/promotions/notifications", label: t("السجل والإرسال", "Log & send") }} testId="promo-notifications">
          {!data.notifications.ok ? (
            <SectionError label={t("تعذر تحميل الإشعارات.", "Couldn't load notifications.")} />
          ) : (
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-white/[0.03] p-3"><dt className="text-xs text-ink-3">{t("آخر 7 أيام", "Last 7 days")}</dt><dd className="nums text-2xl font-bold text-ink" data-testid="promo-notif-week">{data.notifications.data.week}</dd></div>
                <div className="rounded-xl bg-white/[0.03] p-3"><dt className="text-xs text-ink-3">{t("غير مقروءة", "Unread")}</dt><dd className="nums text-2xl font-bold text-ink" data-testid="promo-notif-unread">{data.notifications.data.unread}</dd></div>
                {data.notifications.data.byType.length ? (
                  <div className="col-span-2 space-y-1.5" data-testid="promo-notif-types">
                    <dt className="text-xs text-ink-3">{t("حسب النوع (7 أيام)", "By type (7 days)")}</dt>
                    {data.notifications.data.byType.slice(0, 4).map((row) => (
                      <dd key={row.type} className="flex justify-between gap-2 text-xs text-ink-2"><span className="truncate" dir="ltr">{row.type}</span><span className="nums font-semibold">{row.count}</span></dd>
                    ))}
                  </div>
                ) : null}
              </dl>
              {data.notifications.data.recent.length ? (
                <ul className="divide-y divide-line/60">
                  {data.notifications.data.recent.map((item) => (
                    <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                      <span className="min-w-0 truncate text-ink">{item.title}</span>
                      <span className="nums text-xs text-ink-3">{item.type} · {formatDateTime(item.createdAt, lang)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyLine>{t("لم تُرسل إشعارات بعد.", "No notifications sent yet.")}</EmptyLine>
              )}
            </div>
          )}
        </SectionCard>
      )}

      {data.can("content") ? null : (
        <p className="text-xs text-ink-3" data-testid="promo-withheld">{t("إدارة الإعلانات والعروض والوسائط غير ضمن صلاحياتك.", "Managing ads, offers and media is outside your permissions.")}</p>
      )}
      {data.content?.ok ? <LifecycleLegend t={t} /> : null}
    </div>
  );
}

function LifecycleLegend({ t }: { t: (ar: string, en: string) => string }) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-ink-3">
      <LifecycleBadge lifecycle="LIVE" t={t} /> {t("منشور وضمن جدولته", "published and within schedule")}
      <LifecycleBadge lifecycle="SCHEDULED" t={t} /> {t("منشور ولم يبدأ", "published, not started")}
      <LifecycleBadge lifecycle="ENDED" t={t} /> {t("منشور لكن انتهت مدته", "published, schedule over")}
      <LifecycleBadge lifecycle="INACTIVE" t={t} /> {t("غير منشور", "not published")}
    </div>
  );
}
