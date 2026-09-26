import type { Metadata } from "next";
import { Smartphone } from "lucide-react";

import { cancelPushCampaignAction, sendPushCampaignAction } from "@/app/admin/actions";
import { Forbidden } from "@/app/components/admin/Forbidden";
import { PushCampaignForm } from "@/app/components/admin/PushCampaignForm";
import { ActionForm } from "@/app/ui/ActionForm";
import { Badge, type Tone } from "@/app/ui/Badge";
import { Card, CardHeader, Stat } from "@/app/ui/Card";
import { PageHeader } from "@/app/ui/Page";
import { EmptyState } from "@/app/ui/States";
import { SubmitButton } from "@/app/ui/SubmitButton";
import { DESTINATION_LABELS, parseDestination } from "@/src/lib/destinations";
import { formatDateTime } from "@/src/lib/i18n";
import {
  CAMPAIGN_AUDIENCE_LABELS,
  CAMPAIGN_STATUS_LABELS,
  CAMPAIGN_TYPE_LABELS,
  type CampaignAudience,
  type CampaignStatus,
  type CampaignType,
} from "@/src/lib/push";
import { hasPermission } from "@/src/lib/roles";
import { db } from "@/src/prisma/db";
import { customersById } from "@/src/server/admin-data";
import { requireStaffPage } from "@/src/server/auth";
import { getActivePackages } from "@/src/server/catalog";
import { announcementLifecycle } from "@/src/server/content";
import { getI18n } from "@/src/server/i18n";
import { listCampaigns, previewAudience } from "@/src/server/push-campaigns";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "إشعارات الهواتف" };

const STATUS_TONE: Record<CampaignStatus, Tone> = {
  DRAFT: "neutral",
  SCHEDULED: "info",
  SENDING: "warning",
  SENT: "success",
  FAILED: "danger",
  CANCELLED: "neutral",
};

export default async function AdminNotificationsPage({ searchParams }: { searchParams: Promise<{ phone?: string; tab?: string }> }) {
  const { phone, tab } = await searchParams;
  const { user, allowed } = await requireStaffPage("/admin/notifications", "notifications");

  if (!allowed) {
    return <Forbidden />;
  }

  const { t, lang } = await getI18n();
  const canBroadcast = hasPermission(user.role, "broadcast");
  const label = (value: { ar: string; en: string } | undefined, fallback: string) => (value ? (lang === "ar" ? value.ar : value.en) : fallback);

  const [campaigns, recent, announcementRows, packages, deviceStats] = await Promise.all([
    listCampaigns(60),
    db.orm.public.Notification.orderBy((item) => item.id.desc()).limit(25).all(),
    db.orm.public.Announcement.orderBy((item) => item.id.desc()).limit(50).all(),
    getActivePackages(),
    db.orm.public.PushDevice.where({ isActive: true }).aggregate((aggregate) => ({ count: aggregate.count() })),
  ]);

  const reach = canBroadcast
    ? await Promise.all(
        (["ALL", "ACTIVE_SUBSCRIBERS", "EXPIRING", "PENDING_ORDERS", "AWAITING_PAYMENT"] as CampaignAudience[]).map(async (audience) => ({
          audience,
          ...(await previewAudience(audience, "MESSAGE")),
        })),
      )
    : [];
  const offerReach = canBroadcast ? await previewAudience("ALL", "OFFER") : null;

  const customers = await customersById([
    ...recent.map((item) => item.userId),
    ...campaigns.map((item) => item.targetUserId).filter((id): id is number => Boolean(id)),
  ]);

  const filtered = campaigns.filter((item) => {
    if (tab === "scheduled") return item.status === "SCHEDULED";
    if (tab === "failed") return item.status === "FAILED" || (item.status === "SENT" && item.failedCount > 0);
    if (tab === "drafts") return item.status === "DRAFT";
    return true;
  });

  const tabs = [
    { key: "", ar: "الكل", en: "All" },
    { key: "scheduled", ar: "المجدولة", en: "Scheduled" },
    { key: "drafts", ar: "المسودات", en: "Drafts" },
    { key: "failed", ar: "فشل الإرسال", en: "Failed" },
  ];

  const liveAnnouncements = announcementRows
    .filter((item) => announcementLifecycle(item) !== "ENDED" && item.target !== "WEBSITE" && item.target !== "PLAYER")
    .map((item) => ({ value: String(item.id), label: `#${item.id} · ${item.title}` }));

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("إشعارات الهواتف", "Mobile notifications")}
        description={t(
          "إشعارات تنرسل لهواتف العملاء (تطبيق شاشتنا) وتظهر بمركز الإشعارات بالتطبيق وبصفحة الإشعارات بالموقع. الإشعارات التلقائية (تحديث الطلب، التفعيل، ردود الدعم، قرب الانتهاء) تنرسل للهاتف تلقائيًا أيضًا.",
          "Notifications pushed to customers' phones (the Shashtna app). They also appear in the app's notification centre and on the website's notifications page. Automatic notifications (order updates, activation, support replies, expiry reminders) are pushed too.",
        )}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label={t("أجهزة مسجلة للإشعارات", "Phones registered for push")} value={deviceStats.count} />
        <Stat label={t("إشعارات مجدولة", "Scheduled")} value={campaigns.filter((item) => item.status === "SCHEDULED").length} />
        <Stat label={t("مرسلة (آخر 60)", "Sent (last 60)")} value={campaigns.filter((item) => item.status === "SENT").length} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_440px]">
        <div className="space-y-6">
          <Card className="p-6">
            <CardHeader title={t("سجل الإشعارات", "History")} />
            <nav className="mt-4 flex flex-wrap gap-2 text-sm" aria-label={t("تصفية", "Filter")}>
              {tabs.map((item) => (
                <a
                  key={item.key}
                  href={item.key ? `/admin/notifications?tab=${item.key}` : "/admin/notifications"}
                  className={`rounded-full border px-3 py-1.5 font-semibold ${
                    (tab ?? "") === item.key ? "border-brand bg-brand/15 text-ink" : "border-line text-ink-2"
                  }`}
                >
                  {lang === "ar" ? item.ar : item.en}
                </a>
              ))}
            </nav>

            {filtered.length ? (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="text-xs text-ink-3">
                    <tr className="border-b border-line">
                      <th className="py-2 text-start font-semibold">{t("العنوان", "Title")}</th>
                      <th className="py-2 text-start font-semibold">{t("النوع", "Type")}</th>
                      <th className="py-2 text-start font-semibold">{t("الفئة", "Audience")}</th>
                      <th className="py-2 text-start font-semibold">{t("الحالة", "Status")}</th>
                      <th className="py-2 text-start font-semibold">{t("التوقيت", "Timing")}</th>
                      <th className="py-2 text-start font-semibold">{t("الوصول", "Delivery")}</th>
                      <th className="py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {filtered.map((item) => {
                      const status = item.status as CampaignStatus;
                      const destination = parseDestination(item.link);

                      return (
                        <tr key={item.id} className="align-top">
                          <td className="py-3 pe-3">
                            <p className="font-bold text-ink">{item.title}</p>
                            <p className="mt-0.5 line-clamp-2 text-xs text-ink-3">{item.body}</p>
                            {destination ? (
                              <p className="mt-1 text-xs text-brand-ink">→ {label(DESTINATION_LABELS[destination.kind], destination.kind)}</p>
                            ) : null}
                          </td>
                          <td className="py-3 pe-3 text-ink-2">{label(CAMPAIGN_TYPE_LABELS[item.type as CampaignType], item.type)}</td>
                          <td className="py-3 pe-3 text-ink-2">
                            {label(CAMPAIGN_AUDIENCE_LABELS[item.audience as CampaignAudience], item.audience)}
                            {item.targetUserId ? (
                              <span className="block text-xs text-ink-3">{customers.get(item.targetUserId)?.name ?? `#${item.targetUserId}`}</span>
                            ) : null}
                          </td>
                          <td className="py-3 pe-3">
                            <Badge tone={STATUS_TONE[status] ?? "neutral"}>{label(CAMPAIGN_STATUS_LABELS[status], item.status)}</Badge>
                            {item.lastError ? (
                              <span className="mt-1 block text-xs text-danger" dir="ltr">
                                {item.lastError}
                              </span>
                            ) : null}
                          </td>
                          <td className="nums py-3 pe-3 text-xs text-ink-3">
                            <span className="block">
                              {t("أُنشئ", "Created")}: {formatDateTime(item.createdAt, lang)}
                            </span>
                            {item.scheduledAt ? (
                              <span className="block">
                                {t("مجدول", "Scheduled")}: {formatDateTime(item.scheduledAt, lang)}
                              </span>
                            ) : null}
                            {item.sentAt ? (
                              <span className="block">
                                {t("أُرسل", "Sent")}: {formatDateTime(item.sentAt, lang)}
                              </span>
                            ) : null}
                          </td>
                          <td className="nums py-3 pe-3 text-xs text-ink-2">
                            {item.status === "SENT" || item.status === "FAILED" ? (
                              <>
                                <span className="block">
                                  {t("حسابات", "Accounts")}: {item.recipientCount}
                                </span>
                                <span className="block">
                                  {t("أجهزة", "Phones")}: {item.acceptedCount}/{item.deviceCount}
                                </span>
                                {item.failedCount ? (
                                  <span className="block text-danger">
                                    {t("فشل", "Failed")}: {item.failedCount}
                                  </span>
                                ) : null}
                              </>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="py-3">
                            {item.status === "DRAFT" || item.status === "SCHEDULED" ? (
                              <div className="flex flex-col gap-2">
                                <ActionForm action={sendPushCampaignAction}>
                                  <input type="hidden" name="id" value={item.id} />
                                  <SubmitButton size="sm" pendingLabel="…">
                                    {t("إرسال الآن", "Send now")}
                                  </SubmitButton>
                                </ActionForm>
                                <ActionForm action={cancelPushCampaignAction}>
                                  <input type="hidden" name="id" value={item.id} />
                                  <SubmitButton size="sm" variant="secondary" pendingLabel="…">
                                    {t("إلغاء", "Cancel")}
                                  </SubmitButton>
                                </ActionForm>
                              </div>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState compact className="mt-4" title={t("ماكو إشعارات بهذا القسم", "Nothing here yet")} />
            )}
          </Card>

          <Card className="p-6">
            <CardHeader title={t("آخر الإشعارات بحسابات العملاء", "Latest in-app notifications")} />
            {recent.length ? (
              <ul className="mt-4 divide-y divide-line">
                {recent.map((item) => (
                  <li key={item.id} className="py-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-bold text-ink">{item.title}</span>
                      <span className="nums text-xs text-ink-3">{formatDateTime(item.createdAt, lang)}</span>
                    </div>
                    <p className="mt-1 text-ink-2">{item.body}</p>
                    <p className="mt-1 text-xs text-ink-3">
                      {customers.get(item.userId)?.name ?? `#${item.userId}`} · {label(CAMPAIGN_TYPE_LABELS[item.type as CampaignType], item.type)} ·{" "}
                      {item.readAt ? t("مقروء", "Read") : t("غير مقروء", "Unread")}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState compact className="mt-4" title={t("ماكو إشعارات بعد", "No notifications yet")} />
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="h-fit p-6">
            <CardHeader title={t("إشعار جديد", "New notification")} />
            <PushCampaignForm
              canBroadcast={canBroadcast}
              canUploadImage={hasPermission(user.role, "content")}
              defaultPhone={phone}
              announcements={liveAnnouncements}
              plans={packages.map((pkg) => ({ value: pkg.slug, label: `${pkg.name} · ${pkg.durationLabel}` }))}
            />
          </Card>

          {reach.length ? (
            <Card className="h-fit p-6">
              <CardHeader title={t("الوصول المتوقع الآن", "Current reach")} />
              <ul className="mt-4 space-y-2 text-sm">
                {reach.map((item) => (
                  <li key={item.audience} className="flex items-center justify-between gap-3">
                    <span className="text-ink-2">{label(CAMPAIGN_AUDIENCE_LABELS[item.audience], item.audience)}</span>
                    <span className="nums flex items-center gap-1 text-ink">
                      {item.recipients} <span className="text-ink-3">·</span> <Smartphone size={13} aria-hidden /> {item.devices}
                    </span>
                  </li>
                ))}
                {offerReach ? (
                  <li className="flex items-center justify-between gap-3 border-t border-line pt-2">
                    <span className="text-ink-2">{t("العروض (موافقين على العروض)", "Offers (opted in)")}</span>
                    <span className="nums flex items-center gap-1 text-ink">
                      {offerReach.recipients} <span className="text-ink-3">·</span> <Smartphone size={13} aria-hidden /> {offerReach.devices}
                    </span>
                  </li>
                ) : null}
              </ul>
              <p className="mt-3 text-xs leading-5 text-ink-3">
                {t(
                  "حسابات · أجهزة مسجلة. الإشعار ينحفظ بمركز الإشعارات حتى للحسابات بدون جهاز.",
                  "Accounts · registered phones. The notification is saved in the notification centre even for accounts without a phone.",
                )}
              </p>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
