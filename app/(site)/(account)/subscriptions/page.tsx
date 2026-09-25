import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, ChevronLeft, RefreshCw, Tv } from "lucide-react";

import { Badge, StatusBadge } from "@/app/ui/Badge";
import { LinkButton } from "@/app/ui/Button";
import { cn } from "@/app/ui/cn";
import { PageHeader } from "@/app/ui/Page";
import { EmptyState, Notice } from "@/app/ui/States";
import { formatDate } from "@/src/lib/i18n";
import { ORDER_STATUS_LABELS } from "@/src/lib/order-status";
import { SUBSCRIPTION_STATE_LABELS } from "@/src/lib/subscription-state";
import { requireCustomer } from "@/src/server/auth";
import { getI18n } from "@/src/server/i18n";
import { getCustomerOverview } from "@/src/server/overview";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "اشتراكاتي" };

export default async function SubscriptionsPage() {
  const user = await requireCustomer("/subscriptions");
  const [{ t, lang }, { subscriptions, openOrders }] = await Promise.all([getI18n(), getCustomerOverview(user.id)]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("اشتراكاتي", "My subscriptions")}
        description={t("حالة كل اشتراك وتاريخ انتهائه، والتجديد بخطوتين.", "Each subscription's status and expiry date, and renewal in two steps.")}
        actions={<LinkButton href="/plans" variant="secondary">{t("اشتراك جديد", "New subscription")}</LinkButton>}
      />

      {openOrders.length ? (
        <Notice tone="info" title={t("عندك طلبات قيد المتابعة", "You have orders in progress")}>
          <ul className="mt-1 space-y-1">
            {openOrders.map((order) => (
              <li key={order.id}>
                <Link href={`/orders/${order.id}`} className="font-semibold text-ink underline-offset-4 hover:underline">
                  <span className="nums">{order.number}</span> — {order.serviceName} ({ORDER_STATUS_LABELS[order.status][lang]})
                </Link>
              </li>
            ))}
          </ul>
        </Notice>
      ) : null}

      {subscriptions.length === 0 ? (
        <EmptyState
          icon={<Tv size={22} aria-hidden />}
          title={t("ماكو اشتراكات بعد", "No subscriptions yet")}
          description={t("بعد ما يتفعّل طلبك، الاشتراك راح يظهر هنا مع بياناته وتاريخ انتهائه.", "Once your order is activated, the subscription appears here with its details and expiry date.")}
          action={<LinkButton href="/plans">{t("اختر باقة", "Choose a plan")}</LinkButton>}
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {subscriptions.map((subscription) => {
            const bar =
              subscription.state === "EXPIRED" || subscription.state === "SUSPENDED"
                ? "bg-danger"
                : subscription.state === "EXPIRING"
                  ? "bg-warning"
                  : "bg-glow";

            return (
              <li key={subscription.id} className="surface flex flex-col rounded-panel p-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Badge tone={subscription.serviceType === "VIP" ? "glow" : "brand"}>{subscription.serviceType}</Badge>
                    <h2 className="mt-3 truncate text-lg font-bold text-ink">{subscription.packageName}</h2>
                  </div>
                  <StatusBadge status={subscription.state} label={SUBSCRIPTION_STATE_LABELS[subscription.state][lang]} />
                </div>

                <div className="mt-5">
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="text-ink-3">{t("المتبقي", "Remaining")}</span>
                    <span className="nums font-bold text-ink">
                      {subscription.daysRemaining} {t("يوم", subscription.daysRemaining === 1 ? "day" : "days")}
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-3" role="presentation">
                    <div className={cn("h-full rounded-full", bar)} style={{ width: `${Math.round(subscription.remainingFraction * 100)}%` }} />
                  </div>
                  <p className="nums mt-3 flex items-center gap-1.5 text-xs text-ink-3">
                    <CalendarClock size={14} aria-hidden />
                    {formatDate(subscription.startDate, lang)} – {formatDate(subscription.expiryDate, lang)}
                  </p>
                </div>

                <div className="mt-6 flex flex-wrap gap-2">
                  <LinkButton
                    href={`/checkout?renew=${subscription.id}`}
                    variant={subscription.state === "ACTIVE" ? "secondary" : "primary"}
                    size="sm"
                  >
                    <RefreshCw size={15} aria-hidden />
                    {subscription.state === "EXPIRED" || subscription.state === "SUSPENDED"
                      ? t("إعادة التفعيل", "Reactivate")
                      : subscription.state === "EXPIRING"
                        ? t("جدّد الآن", "Renew now")
                        : t("تجديد", "Renew")}
                  </LinkButton>
                  <LinkButton href={`/subscriptions/${subscription.id}`} variant="ghost" size="sm">
                    {t("التفاصيل وبيانات الدخول", "Details & login")}
                    <ChevronLeft size={15} className="ltr:rotate-180" aria-hidden />
                  </LinkButton>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
