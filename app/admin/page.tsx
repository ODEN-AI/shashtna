import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Briefcase,
  KeyRound,
  MessagesSquare,
  PackageCheck,
  RefreshCw,
  Settings2,
  ShoppingBag,
} from "lucide-react";

import { StatusBadge } from "@/app/ui/Badge";
import { LinkButton } from "@/app/ui/Button";
import { Card, CardHeader } from "@/app/ui/Card";
import { cn } from "@/app/ui/cn";
import { PageHeader } from "@/app/ui/Page";
import { formatDate, formatDateTime, formatPrice } from "@/src/lib/i18n";
import { ORDER_STATUS_LABELS } from "@/src/lib/order-status";
import { hasPermission } from "@/src/lib/roles";
import { daysRemaining, deriveSubscriptionState } from "@/src/lib/subscription-state";
import { getAllSupportTickets } from "@/src/lib/support-store";
import { customersById, listOrdersAdmin } from "@/src/server/admin-data";
import { getQueueCounts, listRenewalsDue } from "@/src/server/admin-queues";
import { requireStaffPage } from "@/src/server/auth";
import { getActiveIncidents } from "@/src/server/content";
import { getI18n } from "@/src/server/i18n";
import { getSettings } from "@/src/server/settings";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "صندوق المهام" };

export default async function AdminInboxPage() {
  const { user } = await requireStaffPage("/admin");
  const can = (permission: Parameters<typeof hasPermission>[1]) => hasPermission(user.role, permission);
  const { t, lang } = await getI18n();

  const [counts, unpaid, ready, renewals, tickets, incidents, settings] = await Promise.all([
    getQueueCounts().catch(() => null),
    can("orders") ? listOrdersAdmin({ statuses: ["SUBMITTED", "AWAITING_PAYMENT", "PENDING"] }) : Promise.resolve([]),
    can("orders") ? listOrdersAdmin({ statuses: ["PAID", "FULFILLING"] }) : Promise.resolve([]),
    can("subscriptions") ? listRenewalsDue() : Promise.resolve([]),
    can("support") ? getAllSupportTickets().catch(() => []) : Promise.resolve([]),
    getActiveIncidents().catch(() => []),
    can("settings") ? getSettings() : Promise.resolve(null),
  ]);

  const waitingTickets = tickets.filter((ticket) => ticket.status !== "CLOSED" && ticket.lastSender === "CUSTOMER");
  const expiringSoon = renewals.filter((item) => deriveSubscriptionState(item) === "EXPIRING");
  const renewalCustomers = await customersById(expiringSoon.map((item) => item.userId));

  const tiles = [
    can("orders") && { href: "/admin/orders?status=unpaid", label: t("طلبات جديدة", "New orders"), value: counts?.orders, icon: <ShoppingBag size={19} aria-hidden />, hint: t("بانتظار التواصل أو الدفع", "Awaiting contact or payment") },
    can("orders") && { href: "/admin/activations", label: t("جاهزة للتفعيل", "Ready to activate"), value: counts?.activations, icon: <PackageCheck size={19} aria-hidden />, hint: t("مدفوعة أو قيد التفعيل", "Paid or activating") },
    can("subscriptions") && { href: "/admin/renewals", label: t("تجديدات مستحقة", "Renewals due"), value: counts?.renewals, icon: <RefreshCw size={19} aria-hidden />, hint: t("14 يوم القادمة / 30 يوم الماضية", "Next 14 / last 30 days") },
    can("support") && { href: "/admin/support?filter=waiting", label: t("تذاكر بانتظار رد", "Tickets awaiting reply"), value: counts?.tickets, icon: <MessagesSquare size={19} aria-hidden />, hint: t("آخر رسالة من العميل", "Last message from customer") },
    can("customers") && { href: "/admin/password-resets", label: t("طلبات إعادة تعيين", "Password resets"), value: counts?.resets, icon: <KeyRound size={19} aria-hidden />, hint: t("تحتاج تحقق وإصدار رمز", "Need verification and a code") },
    can("orders") && { href: "/admin/leads", label: t("طلبات مشاريع جديدة", "New project leads"), value: counts?.leads, icon: <Briefcase size={19} aria-hidden />, hint: t("شاشتنا للحلول الرقمية", "Shashtna Digital") },
  ].filter(Boolean) as { href: string; label: string; value: number | undefined; icon: React.ReactNode; hint: string }[];

  const configAlerts = settings
    ? [
        !settings["contact.whatsapp"] && t("رقم واتساب غير مضاف — زر واتساب مخفي بالموقع.", "No WhatsApp number — WhatsApp buttons are hidden on the site."),
        !settings.savedKeys.includes("legal.terms") && t("الشروط والأحكام بعدها مسودة.", "Terms of service are still a draft."),
        !settings.savedKeys.includes("legal.privacy") && t("سياسة الخصوصية بعدها مسودة.", "The privacy policy is still a draft."),
        !settings["payment.methods"] && t("طرق الدفع غير محددة بصفحة الدفع.", "Payment methods aren't listed on the payment page."),
      ].filter(Boolean)
    : [];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={t("العمليات", "Operations")}
        title={t(`هلا ${user.name.split(" ")[0]} — شنو يحتاج انتباه اليوم؟`, `Hi ${user.name.split(" ")[0]} — what needs attention today?`)}
        description={formatDate(new Date(), lang)}
      />

      {incidents.length ? (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-warning/30 bg-warning/10 p-4 text-sm">
          <AlertTriangle size={18} className="text-warning" aria-hidden />
          <span className="font-semibold text-ink">
            {t(`${incidents.length} مشكلة معلنة على صفحة حالة الخدمة`, `${incidents.length} incident(s) published on the status page`)}
          </span>
          {can("content") ? (
            <Link href="/admin/status" className="ms-auto font-semibold text-warning underline-offset-4 hover:underline">
              {t("إدارة", "Manage")}
            </Link>
          ) : null}
        </div>
      ) : null}

      {tiles.length ? (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {tiles.map((tile) => (
            <li key={tile.href}>
              <Link href={tile.href} className="surface group flex h-full items-start justify-between gap-4 rounded-card p-5 transition hover:border-brand/50">
                <div>
                  <p className="text-sm font-semibold text-ink-2">{tile.label}</p>
                  <p className={cn("nums mt-2 text-3xl font-bold", tile.value ? "text-ink" : "text-ink-3")}>{tile.value ?? "—"}</p>
                  <p className="mt-1 text-xs text-ink-3">{tile.hint}</p>
                </div>
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand/15 text-brand-ink transition group-hover:text-glow">{tile.icon}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        {can("orders") ? (
          <Card className="p-6">
            <CardHeader
              title={t("طلبات بانتظار التواصل أو الدفع", "Orders awaiting contact or payment")}
              action={<LinkButton href="/admin/orders?status=unpaid" variant="ghost" size="sm">{t("الكل", "All")}</LinkButton>}
            />
            {unpaid.length ? (
              <ul className="mt-4 divide-y divide-line">
                {unpaid.slice(0, 6).map((order) => (
                  <li key={order.id}>
                    <Link href={`/admin/orders/${order.id}`} className="flex items-center justify-between gap-3 py-3">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold text-ink">
                          <span className="nums">{order.number}</span> · {order.customer?.name ?? "—"}
                        </span>
                        <span className="block truncate text-xs text-ink-3">
                          {order.serviceName} · <span className="nums">{formatPrice(order.price, lang)}</span> · <span className="nums">{formatDateTime(order.createdAt, lang)}</span>
                        </span>
                      </span>
                      <StatusBadge status={order.status} label={ORDER_STATUS_LABELS[order.status][lang]} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-ink-3">{t("ماكو طلبات جديدة. 🎉", "No new orders. 🎉")}</p>
            )}
          </Card>
        ) : null}

        {can("orders") ? (
          <Card className="p-6">
            <CardHeader
              title={t("جاهزة للتفعيل", "Ready to activate")}
              action={<LinkButton href="/admin/activations" variant="ghost" size="sm">{t("الكل", "All")}</LinkButton>}
            />
            {ready.length ? (
              <ul className="mt-4 divide-y divide-line">
                {ready.slice(0, 6).map((order) => (
                  <li key={order.id} className="flex items-center justify-between gap-3 py-3">
                    <Link href={`/admin/orders/${order.id}`} className="min-w-0">
                      <span className="block truncate text-sm font-bold text-ink">
                        <span className="nums">{order.number}</span> · {order.customer?.name ?? "—"}
                      </span>
                      <span className="block truncate text-xs text-ink-3">{order.serviceName}</span>
                    </Link>
                    {order.requestType === "DEVICE_PURCHASE" ? (
                      <LinkButton href={`/admin/orders/${order.id}`} size="sm" variant="secondary">
                        {t("إكمال", "Complete")}
                      </LinkButton>
                    ) : (
                      <LinkButton href={`/admin/subscription-requests/${order.id}/add`} size="sm">
                        {t("تفعيل", "Activate")}
                      </LinkButton>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-ink-3">{t("ماكو طلبات مدفوعة بانتظار التفعيل.", "No paid orders waiting for activation.")}</p>
            )}
          </Card>
        ) : null}

        {can("support") ? (
          <Card className="p-6">
            <CardHeader
              title={t("تذاكر بانتظار رد الفريق", "Tickets waiting on the team")}
              action={<LinkButton href="/admin/support?filter=waiting" variant="ghost" size="sm">{t("الكل", "All")}</LinkButton>}
            />
            {waitingTickets.length ? (
              <ul className="mt-4 divide-y divide-line">
                {waitingTickets.slice(0, 6).map((ticket) => (
                  <li key={ticket.id}>
                    <Link href={`/admin/support/${encodeURIComponent(ticket.id)}`} className="flex items-center justify-between gap-3 py-3">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold text-ink">{ticket.subject}</span>
                        <span className="block truncate text-xs text-ink-3">
                          {ticket.userName} · <span className="nums">{formatDateTime(ticket.updatedAt, lang)}</span>
                        </span>
                      </span>
                      <StatusBadge status={ticket.status} label={ticket.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-ink-3">{t("كل التذاكر تم الرد عليها.", "Every ticket has a reply.")}</p>
            )}
          </Card>
        ) : null}

        {can("subscriptions") ? (
          <Card className="p-6">
            <CardHeader
              title={t("اشتراكات تنتهي خلال 7 أيام", "Subscriptions ending within 7 days")}
              action={<LinkButton href="/admin/renewals" variant="ghost" size="sm">{t("الكل", "All")}</LinkButton>}
            />
            {expiringSoon.length ? (
              <ul className="mt-4 divide-y divide-line">
                {expiringSoon.slice(0, 6).map((subscription) => (
                  <li key={subscription.id} className="flex items-center justify-between gap-3 py-3">
                    <Link href={`/admin/customers/${subscription.userId}`} className="min-w-0">
                      <span className="block truncate text-sm font-bold text-ink">{renewalCustomers.get(subscription.userId)?.name ?? "—"}</span>
                      <span className="block truncate text-xs text-ink-3">{subscription.packageName}</span>
                    </Link>
                    <span className="nums text-sm font-bold text-warning">
                      {daysRemaining(subscription.expiryDate)} {t("يوم", "d")}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-ink-3">{t("ماكو اشتراكات تنتهي هذا الأسبوع.", "Nothing ends this week.")}</p>
            )}
          </Card>
        ) : null}
      </div>

      {configAlerts.length ? (
        <Card className="p-6">
          <CardHeader
            icon={<Settings2 size={19} aria-hidden />}
            title={t("إعدادات ناقصة", "Setup to finish")}
            action={<LinkButton href="/admin/settings" variant="ghost" size="sm">{t("الإعدادات", "Settings")}<ArrowLeft size={15} className="ltr:rotate-180" aria-hidden /></LinkButton>}
          />
          <ul className="mt-4 space-y-2 text-sm text-ink-2">
            {configAlerts.map((alert) => (
              <li key={alert as string} className="flex items-start gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-warning" aria-hidden />
                {alert}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
