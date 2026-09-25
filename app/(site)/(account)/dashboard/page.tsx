import type { Metadata } from "next";
import Link from "next/link";
import {
  AppWindow,
  Bell,
  ChevronLeft,
  Headphones,
  Megaphone,
  MessageSquarePlus,
  PackageSearch,
  ReceiptText,
  RefreshCw,
  Sparkles,
  TrendingDown,
} from "lucide-react";

import { StatusBadge } from "@/app/ui/Badge";
import { LinkButton } from "@/app/ui/Button";
import { Card, CardHeader } from "@/app/ui/Card";
import { cn } from "@/app/ui/cn";
import { OrderStepper } from "@/app/ui/OrderStepper";
import { monthlyEquivalent } from "@/app/ui/PackageCard";
import { EmptyState } from "@/app/ui/States";
import { SubscriptionHero } from "@/app/ui/SubscriptionHero";
import { formatDate, formatDateTime, formatPrice } from "@/src/lib/i18n";
import { SUBSCRIPTION_STATE_LABELS } from "@/src/lib/subscription-state";
import { listCustomerActivity } from "@/src/server/activity";
import { requireCustomer } from "@/src/server/auth";
import { getActiveApps, getActivePackages } from "@/src/server/catalog";
import { getLiveAnnouncements } from "@/src/server/content";
import { getI18n } from "@/src/server/i18n";
import { countUnreadNotifications, ensureRenewalReminders } from "@/src/server/notifications";
import { getCustomerOverview } from "@/src/server/overview";
import { TICKET_STATUS_LABELS, listTicketsForUser } from "@/src/server/tickets";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "حسابي" };

export default async function DashboardPage() {
  const user = await requireCustomer("/dashboard");
  const overview = await getCustomerOverview(user.id);

  await ensureRenewalReminders(user.id, overview.subscriptions, user.renewalReminders).catch(() => undefined);

  const [{ t, lang }, activity, tickets, unread, apps, packages, notices] = await Promise.all([
    getI18n(),
    listCustomerActivity(user.id, 6).catch(() => []),
    listTicketsForUser(user.id).catch(() => []),
    countUnreadNotifications(user.id).catch(() => 0),
    getActiveApps().catch(() => []),
    getActivePackages().catch(() => []),
    getLiveAnnouncements("WEBSITE", "DASHBOARD").catch(() => []),
  ]);

  const { state, primary, openOrders, subscriptions } = overview;
  const openTickets = tickets.filter((ticket) => ticket.status !== "CLOSED");
  const trackedOrder = openOrders[0];
  const recommendedApps = apps.slice(0, 2);

  // Suggest a same-type plan only when it is genuinely cheaper per month.
  const currentPackage = primary ? packages.find((pkg) => pkg.id === primary.packageId) : undefined;
  const suggestion = currentPackage
    ? packages
        .filter((pkg) => pkg.serviceType === currentPackage.serviceType && pkg.id !== currentPackage.id)
        .map((pkg) => ({
          pkg,
          saving:
            (monthlyEquivalent(currentPackage.price, currentPackage.durationMonths) ?? 0) -
            (monthlyEquivalent(pkg.price, pkg.durationMonths) ?? 0),
        }))
        .filter((item) => item.saving > 0)
        .sort((a, b) => b.saving - a.saving)[0]
    : undefined;

  const quickActions = [
    primary
      ? { href: `/checkout?renew=${primary.id}`, label: t("تجديد", "Renew"), icon: <RefreshCw size={19} aria-hidden /> }
      : { href: "/plans", label: t("اختر باقة", "Choose a plan"), icon: <Sparkles size={19} aria-hidden /> },
    { href: "/account/devices", label: t("التطبيقات", "Apps"), icon: <AppWindow size={19} aria-hidden /> },
    { href: "/support/new", label: t("تذكرة دعم", "Get help"), icon: <MessageSquarePlus size={19} aria-hidden /> },
    { href: "/orders?tab=receipts", label: t("الإيصالات", "Receipts"), icon: <ReceiptText size={19} aria-hidden /> },
  ];

  return (
    <div className="space-y-6">
      <SubscriptionHero state={state} subscription={primary} openOrder={trackedOrder} name={user.name} lang={lang} />

      {notices.length ? (
        <div className="space-y-3">
          {notices.map((notice) => (
            <div key={notice.id} className="surface flex flex-wrap items-center gap-3 rounded-card p-4">
              <Megaphone size={18} className="shrink-0 text-glow" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-ink">{notice.title}</p>
                {notice.description ? <p className="mt-0.5 text-sm text-ink-2">{notice.description}</p> : null}
              </div>
              {notice.ctaUrl && notice.ctaLabel ? (
                <LinkButton href={notice.ctaUrl} external={/^https?:/.test(notice.ctaUrl)} variant="secondary" size="sm">
                  {notice.ctaLabel}
                </LinkButton>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      <nav aria-label={t("إجراءات سريعة", "Quick actions")}>
        <ul className="grid grid-cols-4 gap-2 sm:gap-3">
          {quickActions.map((action) => (
            <li key={action.href}>
              <Link
                href={action.href}
                className="surface flex h-full flex-col items-center gap-2 rounded-card px-2 py-4 text-center text-xs font-semibold text-ink-2 transition hover:border-brand/50 hover:text-ink sm:text-sm"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/15 text-brand-ink">{action.icon}</span>
                {action.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {trackedOrder && state !== "PENDING" ? (
        <Card className="p-6">
          <CardHeader
            icon={<PackageSearch size={19} aria-hidden />}
            title={t(`طلب قيد المتابعة ${trackedOrder.number}`, `Order in progress ${trackedOrder.number}`)}
            description={trackedOrder.serviceName}
            action={
              <LinkButton href={`/orders/${trackedOrder.id}`} variant="secondary" size="sm">
                {t("التفاصيل", "Details")}
              </LinkButton>
            }
          />
          <div className="mt-6">
            <OrderStepper status={trackedOrder.status} lang={lang} />
          </div>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="p-6">
          <CardHeader
            title={t("اشتراكاتي", "My subscriptions")}
            action={
              subscriptions.length ? (
                <Link href="/subscriptions" className="text-sm font-semibold text-brand-ink hover:text-ink">
                  {t("الكل", "All")}
                </Link>
              ) : null
            }
          />
          {subscriptions.length ? (
            <ul className="mt-4 divide-y divide-line">
              {subscriptions.slice(0, 3).map((subscription) => (
                <li key={subscription.id}>
                  <Link href={`/subscriptions/${subscription.id}`} className="flex items-center justify-between gap-3 py-3.5">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-ink">{subscription.packageName}</span>
                      <span className="nums mt-0.5 block text-xs text-ink-3">
                        {t("ينتهي ", "Expires ")}
                        {formatDate(subscription.expiryDate, lang)}
                      </span>
                    </span>
                    <StatusBadge status={subscription.state} label={SUBSCRIPTION_STATE_LABELS[subscription.state][lang]} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState compact className="mt-4" title={t("ماكو اشتراكات بعد", "No subscriptions yet")} action={<LinkButton href="/plans" size="sm">{t("اختر باقة", "Choose a plan")}</LinkButton>} />
          )}
        </Card>

        <Card className="p-6">
          <CardHeader
            title={t("تذاكر الدعم المفتوحة", "Open support tickets")}
            action={
              <Link href="/support" className="text-sm font-semibold text-brand-ink hover:text-ink">
                {t("الكل", "All")}
              </Link>
            }
          />
          {openTickets.length ? (
            <ul className="mt-4 divide-y divide-line">
              {openTickets.slice(0, 3).map((ticket) => (
                <li key={ticket.id}>
                  <Link href={`/support/${encodeURIComponent(ticket.id)}`} className="flex items-center justify-between gap-3 py-3.5">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-ink">{ticket.subject}</span>
                      <span className="mt-0.5 block text-xs text-ink-3">
                        {ticket.lastSender === "ADMIN" ? t("وصل رد من الدعم", "Support replied") : t("بانتظار رد الدعم", "Waiting for support")}
                      </span>
                    </span>
                    <StatusBadge status={ticket.status} label={TICKET_STATUS_LABELS[ticket.status]?.[lang] ?? ticket.status} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-dashed border-line-strong p-4">
              <p className="flex items-center gap-2 text-sm text-ink-3">
                <Headphones size={17} aria-hidden />
                {t("ماكو تذاكر مفتوحة.", "No open tickets.")}
              </p>
              <LinkButton href="/support/new" variant="secondary" size="sm">
                {t("تذكرة جديدة", "New ticket")}
              </LinkButton>
            </div>
          )}
        </Card>

        <Card className="p-6">
          <CardHeader
            title={t("آخر النشاطات", "Recent activity")}
            action={
              <Link href="/notifications" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-ink hover:text-ink">
                <Bell size={15} aria-hidden />
                {unread ? <span className="nums">{unread}</span> : null}
                {t("الإشعارات", "Notifications")}
              </Link>
            }
          />
          {activity.length ? (
            <ol className="mt-4 space-y-3">
              {activity.map((event) => (
                <li key={event.id} className="flex items-start gap-3 text-sm">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-glow" aria-hidden />
                  <span className="flex-1 text-ink-2">{event.summary}</span>
                  <span className="nums shrink-0 text-xs text-ink-3">{formatDateTime(event.createdAt, lang)}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-4 text-sm text-ink-3">{t("أول ما تسوي طلب أو تذكرة، راح يظهر هنا.", "Your orders and tickets will show up here.")}</p>
          )}
        </Card>

        <Card className="p-6">
          <CardHeader
            title={t("شاهد على أجهزتك", "Watch on your devices")}
            action={
              <Link href="/account/devices" className="text-sm font-semibold text-brand-ink hover:text-ink">
                {t("الكل", "All")}
              </Link>
            }
          />
          {recommendedApps.length ? (
            <ul className="mt-4 space-y-2">
              {recommendedApps.map((app) => (
                <li key={app.id}>
                  <Link
                    href={`/apps#app-${app.slug}`}
                    className={cn("flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface-2 px-4 py-3 transition hover:border-brand/50", app.isPlayer && "border-glow/30")}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-ink">{app.name}</span>
                      <span className="block text-xs text-ink-3">{app.platform}</span>
                    </span>
                    <ChevronLeft size={16} className="shrink-0 text-ink-3 ltr:rotate-180" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-ink-3">{t("قائمة التطبيقات قيد التحديث.", "The apps list is being updated.")}</p>
          )}
        </Card>
      </div>

      {suggestion && primary ? (
        <Card className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between" raised>
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-success/10 text-success">
              <TrendingDown size={19} aria-hidden />
            </span>
            <div>
              <p className="font-bold text-ink">
                {t(`وفّر مع «${suggestion.pkg.name}»`, `Save with “${suggestion.pkg.name}”`)}
              </p>
              <p className="mt-1 text-sm text-ink-2">
                {t("تكلفة شهرية أقل بحوالي ", "About ")}
                <span className="nums font-semibold text-ink">{formatPrice(suggestion.saving, lang)}</span>
                {t(" مقارنة بباقتك الحالية.", " less per month than your current plan.")}
              </p>
            </div>
          </div>
          <LinkButton href={`/checkout?renew=${primary.id}&plan=${encodeURIComponent(suggestion.pkg.slug)}`} variant="secondary">
            {t("جدّد بهاي الباقة", "Renew with this plan")}
          </LinkButton>
        </Card>
      ) : null}

    </div>
  );
}
