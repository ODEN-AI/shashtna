import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, CheckCheck, HeartPulse, Moon, PlayCircle, Receipt, Settings } from "lucide-react";

import { runNowAction } from "@/app/admin/today/actions";
import { WhatsAppButton } from "@/app/admin/today/WhatsAppButton";
import { EmptyLine, SectionCard } from "@/app/components/admin/dashboard/DashboardUI";
import { Forbidden } from "@/app/components/admin/Forbidden";
import { ActionForm } from "@/app/ui/ActionForm";
import { Badge, serviceTone } from "@/app/ui/Badge";
import { LinkButton } from "@/app/ui/Button";
import { Stat } from "@/app/ui/Card";
import { PageHeader } from "@/app/ui/Page";
import { Notice } from "@/app/ui/States";
import { SubmitButton } from "@/app/ui/SubmitButton";
import type { Reminder } from "@/src/lib/automation";
import { formatDate, formatDateTime } from "@/src/lib/i18n";
import { formatOrderNumber } from "@/src/lib/order-status";
import { isFullAccess } from "@/src/lib/system";
import { requireStaffPage } from "@/src/server/auth";
import { dailyList } from "@/src/server/automation";
import { getI18n } from "@/src/server/i18n";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "اليوم" };

const REMINDER_LABELS: Record<Reminder, { ar: string; en: string; tone: "warning" | "danger" | "info" }> = {
  "before-expiry": { ar: "ينتهي بعد 5 أيام", en: "Ends in 5 days", tone: "warning" },
  "expiry-day": { ar: "ينتهي اليوم", en: "Ends today", tone: "danger" },
  "win-back": { ar: "خلص من 3 أيام", en: "Ended 3 days ago", tone: "info" },
};

/**
 * Admin → Today: the owner's daily list, built from live data on every view —
 * customers to message (5 days before expiry, the day itself, 3 days after),
 * orders that are stuck, and health checks. WhatsApp links are prefilled and
 * sent by the owner; each is recorded once in the outbox.
 */
export default async function TodayPage() {
  const { user, allowed } = await requireStaffPage("/admin/today", "orders");

  if (!allowed) {
    return <Forbidden />;
  }

  const isOwner = isFullAccess(user.role);
  const [{ t, lang }, list] = await Promise.all([getI18n(), dailyList()]);
  const { orders, health } = list;
  const unsent = list.subscriptions.filter((row) => !row.sent).length;
  const orderGroups = [
    { rows: orders.proofsToReview, heading: t("إيصال ينتظر المراجعة", "Proof awaiting review"), tone: "warning" as const },
    { rows: orders.notActivated, heading: t("مدفوع وما تفعّل", "Paid, not activated"), tone: "danger" as const },
    { rows: orders.waitingPayment, heading: t("بانتظار الدفع", "Awaiting payment"), tone: "neutral" as const },
  ].filter((group) => group.rows.length);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("اليوم", "Today")}
        description={t("مَن تراسل اليوم، وشنو الطلبات العالقة، وصحة النظام. كلشي محسوب هسه من البيانات.", "Who to message today, which orders are stuck, and system health — computed live.")}
        actions={
          isOwner ? (
            <div className="flex flex-wrap gap-2">
              <ActionForm action={runNowAction}>
                <SubmitButton size="sm" variant="secondary" pendingLabel={t("جاري التشغيل…", "Running…")} disabled={health.ranToday}>
                  <PlayCircle size={15} aria-hidden />
                  {health.ranToday ? t("تم التشغيل اليوم", "Ran today") : t("شغّل هسه", "Run now")}
                </SubmitButton>
              </ActionForm>
              <LinkButton href="/admin/settings#automation" variant="ghost" size="sm">
                <Settings size={15} aria-hidden />
                {t("إعدادات الأتمتة", "Automation settings")}
              </LinkButton>
            </div>
          ) : null
        }
      />

      {!list.settings.enabled ? (
        <Notice tone="info" title={t("الأتمتة متوقفة", "Automation is off")}>
          {t("القائمة تشتغل عادي، بس ما يوصلك إشعار الصبح لحد ما تشغّلها من الإعدادات.", "The list works as usual; the morning notification starts once you turn it on in Settings.")}
        </Notice>
      ) : list.settings.dryRun ? (
        <Notice tone="warning" title={t("تشغيل تجريبي", "Dry run")}>
          {t("الرسائل تنسجّل بس ما تنحسب «أُرسلت»، وما يوصل إشعار.", "Messages are logged but not marked sent, and no notification goes out.")}
        </Notice>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" data-testid="today-stats">
        <Stat label={t("رسائل اليوم", "Messages today")} value={list.subscriptions.length} hint={t(`${unsent} ما انرسلت بعد`, `${unsent} not sent yet`)} />
        <Stat label={t("بانتظار الدفع +24 ساعة", "Unpaid 24h+")} value={orders.waitingPayment.length} tone={orders.waitingPayment.length ? "warning" : "default"} />
        <Stat label={t("إيصالات للمراجعة", "Proofs to review")} value={orders.proofsToReview.length} tone={orders.proofsToReview.length ? "warning" : "default"} />
        <Stat label={t("مدفوع وما تفعّل +12 ساعة", "Paid, not active 12h+")} value={orders.notActivated.length} tone={orders.notActivated.length ? "danger" : "default"} />
      </div>

      <SectionCard title={t("اشتراكات تحتاج رسالة", "Subscriptions to message")} icon={<CalendarClock size={14} aria-hidden />} testId="today-subscriptions">
        {list.quietHours ? (
          <p className="mb-3 flex items-center gap-2 text-sm text-warning" data-testid="today-quiet">
            <Moon size={15} aria-hidden />
            {t(`وقت راحة (${list.settings.quietHours}) — الأفضل تأجل الرسائل للصبح.`, `Quiet hours (${list.settings.quietHours}) — better to wait until morning.`)}
          </p>
        ) : null}
        {list.subscriptions.length ? (
          <ul className="divide-y divide-line">
            {list.subscriptions.map((row) => {
              const label = REMINDER_LABELS[row.reminder];

              return (
                <li key={`${row.reminder}:${row.subscriptionId}`} className="flex flex-wrap items-center justify-between gap-3 py-3" data-testid="today-subscription">
                  <div className="min-w-0 space-y-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
                      <Link href={`/admin/customers/${row.userId}`} className="hover:underline">
                        {row.customerName}
                      </Link>
                      <Badge tone={serviceTone(row.serviceType)}>{row.serviceType}</Badge>
                      <Badge tone={label.tone}>{lang === "ar" ? label.ar : label.en}</Badge>
                    </p>
                    <p className="text-xs leading-6 text-ink-3">
                      {row.packageName} · <span className="nums">{formatDate(row.endDate, lang)}</span>
                      {row.points > 0 ? <> · {t(`${row.points} نقطة`, `${row.points} points`)}</> : null}
                      {row.discountLabel ? <> · {row.discountLabel}</> : null}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {row.sent ? (
                      <Badge tone={row.sent.status === "SENT" ? "success" : "neutral"}>
                        <CheckCheck size={13} aria-hidden />
                        {row.sent.status === "SENT" ? t("أُرسلت", "Sent") : t("تجريبي", "Dry run")} · <span className="nums">{formatDateTime(row.sent.at, lang)}</span>
                      </Badge>
                    ) : null}
                    {isOwner && row.link ? (
                      <WhatsAppButton href={row.link} subscriptionId={row.subscriptionId} template={row.reminder} sent={Boolean(row.sent)} />
                    ) : isOwner ? (
                      <Badge tone="neutral">{t("ماكو رقم عراقي", "No Iraqi number")}</Badge>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyLine>{t("ماكو أحد تحتاج تراسله اليوم.", "No one to message today.")}</EmptyLine>
        )}
      </SectionCard>

      <SectionCard title={t("طلبات عالقة", "Stuck orders")} icon={<Receipt size={14} aria-hidden />} testId="today-orders">
        {orderGroups.length ? (
          <div className="space-y-4">
            {orderGroups.map((group) => (
              <div key={group.heading}>
                <p className="mb-2 text-xs font-semibold text-ink-3">{group.heading}</p>
                <ul className="flex flex-wrap gap-2">
                  {group.rows.map((order) => (
                    <li key={order.id}>
                      <Link href={`/admin/orders/${order.id}`}>
                        <Badge tone={group.tone}>
                          <span className="nums">{formatOrderNumber(order.id)}</span> · {order.serviceName}
                        </Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <EmptyLine>{t("ماكو طلبات عالقة.", "No stuck orders.")}</EmptyLine>
        )}
      </SectionCard>

      <SectionCard title={t("صحة النظام", "Health")} icon={<HeartPulse size={14} aria-hidden />} testId="today-health">
        <ul className="space-y-2 text-sm">
          <li className="flex flex-wrap justify-between gap-2">
            <span>{t("طلبات مكتملة بدون كلفة", "Completed orders with no cost")}</span>
            <Badge tone={health.unknownCost ? "warning" : "success"}>{health.unknownCost === null ? t("ماكو شراء رصيد بعد", "No credit purchase yet") : health.unknownCost}</Badge>
          </li>
          <li className="flex flex-wrap justify-between gap-2">
            <span>{t("أرصدة نقاط ما تطابق السجل", "Points balances off the ledger")}</span>
            <Badge tone={health.mismatches ? "danger" : "success"}>{health.mismatches ?? "—"}</Badge>
          </li>
          <li className="flex flex-wrap justify-between gap-2">
            <span>{t("طلبات ما أخذت نقاطها", "Orders missing their points")}</span>
            <Badge tone={health.missingAwards ? "warning" : "success"}>{health.missingAwards ?? "—"}</Badge>
          </li>
          <li className="flex flex-wrap justify-between gap-2">
            <span>{t("آخر تشغيل صباحي", "Last morning run")}</span>
            {health.lastRun ? (
              <Badge tone={health.lastRun.status === "SUCCEEDED" ? "success" : health.lastRun.status === "FAILED" ? "danger" : "neutral"}>
                {health.lastRun.status === "SUCCEEDED" ? t("نجح", "Succeeded") : health.lastRun.status === "FAILED" ? t("فشل", "Failed") : health.lastRun.status} · <span className="nums">{formatDateTime(health.lastRun.startedAt, lang)}</span>
              </Badge>
            ) : (
              <Badge tone="neutral">{t("ما اشتغل بعد", "Never ran")}</Badge>
            )}
          </li>
        </ul>
      </SectionCard>
    </div>
  );
}
