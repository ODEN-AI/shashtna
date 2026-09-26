import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Bell, Phone } from "lucide-react";

import { Forbidden } from "@/app/components/admin/Forbidden";
import { Badge, StatusBadge } from "@/app/ui/Badge";
import { WhatsAppIcon } from "@/app/ui/BrandIcons";
import { LinkButton } from "@/app/ui/Button";
import { Card, CardHeader } from "@/app/ui/Card";
import { formatDate, formatDateTime, formatPrice } from "@/src/lib/i18n";
import { ORDER_STATUS_LABELS } from "@/src/lib/order-status";
import { ROLE_LABELS, hasPermission } from "@/src/lib/roles";
import { SUBSCRIPTION_STATE_LABELS } from "@/src/lib/subscription-state";
import { db } from "@/src/prisma/db";
import { requireStaffPage } from "@/src/server/auth";
import { getI18n } from "@/src/server/i18n";
import { listOrdersForUser } from "@/src/server/orders";
import { whatsappLink } from "@/src/server/settings";
import { listReceiptsForUser, listSubscriptionsForUser } from "@/src/server/subscriptions";
import { TICKET_STATUS_LABELS, listTicketsForUser } from "@/src/server/tickets";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "ملف العميل" };

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user: staff, allowed } = await requireStaffPage(`/admin/customers/${id}`, "customers");

  if (!allowed) {
    return <Forbidden />;
  }

  const customerId = Number(id);
  const customer = Number.isInteger(customerId) ? await db.orm.public.User.first({ id: customerId }) : null;

  if (!customer) {
    notFound();
  }

  const [{ t, lang }, subscriptions, orders, receipts, tickets, activity, phones] = await Promise.all([
    getI18n(),
    listSubscriptionsForUser(customer.id),
    listOrdersForUser(customer.id),
    listReceiptsForUser(customer.id),
    listTicketsForUser(customer.id).catch(() => []),
    db.orm.public.ActivityEvent.where({ userId: customer.id }).orderBy((event) => event.createdAt.desc()).limit(20).all(),
    db.orm.public.PushDevice.where({ userId: customer.id }).orderBy((device) => device.lastSeenAt.desc()).limit(10).all(),
  ]);

  const paid = receipts.reduce((sum, receipt) => sum + receipt.price, 0);
  const wa = whatsappLink(customer.phone.replace(/^0/, "964"), `مرحبًا ${customer.name}، معك فريق شاشتنا.`);

  return (
    <div className="space-y-6">
      <LinkButton href="/admin/customers" variant="ghost" size="sm" className="-ms-3">
        <ArrowRight size={16} className="ltr:rotate-180" aria-hidden />
        {t("العملاء", "Customers")}
      </LinkButton>

      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-ink">{customer.name}</h1>
              <Badge tone={customer.role === "CUSTOMER" ? "neutral" : "brand"}>{ROLE_LABELS[customer.role]?.[lang] ?? customer.role}</Badge>
            </div>
            <p className="nums mt-1 text-sm text-ink-2" dir="ltr">{customer.phone}</p>
            {customer.email ? <p className="text-sm text-ink-3">{customer.email}</p> : null}
            <p className="mt-2 text-xs text-ink-3">
              {t("انضم ", "Joined ")}
              <span className="nums">{formatDate(String(customer.createdAt), lang)}</span>
              {customer.preferredContact ? ` · ${t("يفضّل: ", "Prefers: ")}${customer.preferredContact}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <LinkButton href={`tel:${customer.phone.replace(/[^\d+]/g, "")}`} external variant="secondary" size="sm">
              <Phone size={15} aria-hidden />
              {t("اتصال", "Call")}
            </LinkButton>
            {wa ? (
              <LinkButton href={wa} external variant="secondary" size="sm">
                <WhatsAppIcon size={15} />
                WhatsApp
              </LinkButton>
            ) : null}
            {hasPermission(staff.role, "support") ? (
              <LinkButton href={`/admin/notifications?phone=${encodeURIComponent(customer.phone)}`} variant="secondary" size="sm">
                <Bell size={15} aria-hidden />
                {t("إرسال إشعار", "Send notification")}
              </LinkButton>
            ) : null}
          </div>
        </div>
        <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-line pt-5 sm:grid-cols-4">
          {[
            { label: t("الاشتراكات", "Subscriptions"), value: subscriptions.length },
            { label: t("الطلبات", "Orders"), value: orders.length },
            { label: t("التذاكر", "Tickets"), value: tickets.length },
            { label: t("مجموع المدفوع (إيصالات)", "Paid (receipts)"), value: formatPrice(paid, lang) },
          ].map((item) => (
            <div key={item.label}>
              <dt className="text-xs text-ink-3">{item.label}</dt>
              <dd className="nums mt-1 text-lg font-bold text-ink">{item.value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="p-6">
          <CardHeader
            title={t("الاشتراكات", "Subscriptions")}
            action={<LinkButton href="/admin/subscriptions" variant="ghost" size="sm">{t("إدارة", "Manage")}</LinkButton>}
          />
          {subscriptions.length ? (
            <ul className="mt-4 divide-y divide-line">
              {subscriptions.map((subscription) => (
                <li key={subscription.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate font-bold text-ink">{subscription.packageName}</span>
                    <span className="nums block text-xs text-ink-3">
                      #{subscription.id} · {formatDate(subscription.startDate, lang)} – {formatDate(subscription.expiryDate, lang)}
                    </span>
                    <span className="nums block text-xs text-ink-3" dir="ltr">
                      {subscription.username ?? subscription.deviceId ?? ""}
                    </span>
                  </span>
                  <StatusBadge status={subscription.state} label={SUBSCRIPTION_STATE_LABELS[subscription.state][lang]} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-ink-3">{t("ماكو اشتراكات.", "No subscriptions.")}</p>
          )}
        </Card>

        <Card className="p-6">
          <CardHeader title={t("الطلبات", "Orders")} />
          {orders.length ? (
            <ul className="mt-4 divide-y divide-line">
              {orders.slice(0, 10).map((order) => (
                <li key={order.id}>
                  <Link href={`/admin/orders/${order.id}`} className="flex items-center justify-between gap-3 py-3 text-sm">
                    <span className="min-w-0">
                      <span className="nums block font-bold text-ink">{order.number}</span>
                      <span className="block truncate text-xs text-ink-3">
                        {order.serviceName} · {formatPrice(order.price, lang)}
                      </span>
                    </span>
                    <StatusBadge status={order.status} label={ORDER_STATUS_LABELS[order.status][lang]} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-ink-3">{t("ماكو طلبات.", "No orders.")}</p>
          )}
        </Card>

        <Card className="p-6">
          <CardHeader title={t("تذاكر الدعم", "Support tickets")} />
          {tickets.length ? (
            <ul className="mt-4 divide-y divide-line">
              {tickets.slice(0, 10).map((ticket) => (
                <li key={ticket.id}>
                  <Link href={`/admin/support/${encodeURIComponent(ticket.id)}`} className="flex items-center justify-between gap-3 py-3 text-sm">
                    <span className="truncate font-semibold text-ink">{ticket.subject}</span>
                    <StatusBadge status={ticket.status} label={TICKET_STATUS_LABELS[ticket.status]?.[lang] ?? ticket.status} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-ink-3">{t("ماكو تذاكر.", "No tickets.")}</p>
          )}
        </Card>

        <Card className="p-6">
          <CardHeader
            title={t("هواتف التطبيق", "App phones")}
            description={t("الأجهزة المسجلة لاستلام إشعارات الهاتف لهذا الحساب.", "Devices registered to receive push notifications for this account.")}
          />
          {phones.length ? (
            <ul className="mt-4 divide-y divide-line text-sm">
              {phones.map((phone) => (
                <li key={phone.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <span className="font-semibold text-ink">
                    {phone.deviceName ?? phone.platform} <span className="text-xs font-normal text-ink-3">· {phone.platform} · {phone.appVersion ?? "—"}</span>
                  </span>
                  <span className="flex items-center gap-2 text-xs">
                    <Badge tone={phone.isActive ? "success" : "neutral"}>{phone.isActive ? t("فعّال", "Active") : t("متوقف", "Inactive")}</Badge>
                    <span className="nums text-ink-3">{formatDateTime(phone.lastSeenAt, lang)}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-ink-3">{t("ما سجّل هذا العميل أي هاتف بعد.", "No phone registered yet.")}</p>
          )}
        </Card>

        <Card className="p-6">
          <CardHeader title={t("النشاط", "Activity")} />
          {activity.length ? (
            <ol className="mt-4 space-y-3">
              {activity.map((event) => (
                <li key={event.id} className="flex items-start gap-3 text-sm">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-hidden />
                  <span className="flex-1 text-ink-2">{event.summary}</span>
                  <span className="nums shrink-0 text-xs text-ink-3">{formatDateTime(event.createdAt, lang)}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-4 text-sm text-ink-3">{t("ماكو نشاط مسجل.", "No recorded activity.")}</p>
          )}
        </Card>
      </div>
    </div>
  );
}
