import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Activity, ArrowRight, Bell, Cpu, EyeOff, FileCheck2, LifeBuoy, Phone, RefreshCw, ShoppingBag, Tv, UserRound, Workflow } from "lucide-react";
import type { ReactNode } from "react";

import { logRenewalContactAction } from "@/app/admin/actions";
import { RevealPassword } from "@/app/components/admin/CredentialReveal";
import { EmptyLine, SectionCard, SectionError } from "@/app/components/admin/dashboard/DashboardUI";
import { Forbidden } from "@/app/components/admin/Forbidden";
import { OpsActionForm } from "@/app/components/admin/operations/OpsActionForm";
import { Badge, StatusBadge } from "@/app/ui/Badge";
import { WhatsAppIcon } from "@/app/ui/BrandIcons";
import { LinkButton } from "@/app/ui/Button";
import { cn } from "@/app/ui/cn";
import { Input } from "@/app/ui/Field";
import { SubmitButton } from "@/app/ui/SubmitButton";
import { customerStatus } from "@/src/lib/customers";
import { formatDate, formatDateTime, formatPrice } from "@/src/lib/i18n";
import { ORDER_STATUS_LABELS, REQUEST_TYPE_LABELS, isOpen, isUnpaid } from "@/src/lib/order-status";
import { ROLE_LABELS } from "@/src/lib/roles";
import { SUBSCRIPTION_STATE_LABELS } from "@/src/lib/subscription-state";
import { requireStaffPage } from "@/src/server/auth";
import { getCustomer360, type Customer360 } from "@/src/server/customers";
import { getI18n } from "@/src/server/i18n";
import { whatsappLink } from "@/src/server/settings";
import { TICKET_STATUS_LABELS } from "@/src/server/tickets";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "ملف العميل" };

/**
 * Customer 360 — one staff view of a customer relationship. Composes the
 * existing systems; every section is loaded only with its permission, and
 * sections the role can't see are listed (never loaded). Passwords are never
 * part of this page: revealing one is the existing audited endpoint.
 */
export default async function Customer360Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user: staff, allowed } = await requireStaffPage(`/admin/customers/${id}`, "customers");

  if (!allowed) {
    return <Forbidden />;
  }

  const customerId = Number(id);
  const data = Number.isInteger(customerId) && customerId > 0 ? await getCustomer360(staff.role, customerId) : null;

  if (!data) {
    notFound();
  }

  const { t, lang } = await getI18n();
  const { customer, can } = data;
  const subs = data.subscriptions;
  const orders = data.orders;
  const overall = subs?.ok ? customerStatus(subs.data.map((sub) => sub.state)) : null;
  const wa = whatsappLink(customer.phone.replace(/^0/, "964"), `مرحبًا ${customer.name}، معك فريق شاشتنا.`);
  const withheld = [
    !can("subscriptions") && t("الاشتراكات والتجديدات والأجهزة المرتبطة", "Subscriptions, renewals and linked devices"),
    !can("orders") && t("الطلبات والمدفوعات", "Orders and payments"),
    !can("support") && t("تذاكر الدعم", "Support tickets"),
    !can("audit") && t("سجل النشاط الكامل (يظهر فقط ما يخص صلاحياتك)", "Full activity log (only events within your permissions are shown)"),
  ].filter(Boolean) as string[];

  return (
    <div className="relative isolate space-y-5" data-testid="customer-360">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-24 -z-10 h-[420px] bg-[radial-gradient(55%_60%_at_75%_0%,rgb(25_81_252/0.16),transparent_70%)]" />
      <LinkButton href="/admin/customers" variant="ghost" size="sm" className="-ms-3">
        <ArrowRight size={16} className="ltr:rotate-180" aria-hidden />
        {t("العملاء", "Customers")}
      </LinkButton>

      {/* Identity */}
      <header className="bg-finance-hero relative overflow-hidden rounded-[2rem] border border-white/12 p-5 sm:p-7" data-testid="c360-identity">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-white/70">
              <UserRound size={13} aria-hidden /> Customer 360 · <span className="nums">#{customer.id}</span>
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-white sm:text-3xl">{customer.name}</h1>
              {customer.staff ? <Badge tone="brand">{ROLE_LABELS[customer.role]?.[lang] ?? customer.role}</Badge> : null}
              {overall ? (
                <span data-testid="c360-status" data-status={overall}>
                  <StatusBadge status={overall} label={overall === "NONE" ? t("بدون اشتراك", "No subscription") : SUBSCRIPTION_STATE_LABELS[overall][lang]} />
                </span>
              ) : null}
            </div>
            <p className="nums mt-2 text-sm text-white/85" dir="ltr">{customer.phone}</p>
            {customer.email ? <p className="text-sm text-white/70">{customer.email}</p> : null}
            <p className="mt-2 text-xs text-white/65">
              {t("انضم ", "Joined ")}
              <span className="nums">{formatDate(customer.createdAt, lang)}</span>
              {customer.preferredContact ? ` · ${t("يفضّل التواصل عبر: ", "Prefers: ")}${customer.preferredContact}` : ""}
              {` · ${customer.renewalReminders ? t("تذكيرات التجديد مفعّلة", "Renewal reminders on") : t("تذكيرات التجديد متوقفة", "Renewal reminders off")}`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2" data-testid="c360-actions">
            <LinkButton href={`tel:${customer.phone.replace(/[^\d+]/g, "")}`} external variant="glass" size="sm">
              <Phone size={15} aria-hidden /> {t("اتصال", "Call")}
            </LinkButton>
            {wa ? (
              <LinkButton href={wa} external variant="glass" size="sm">
                <WhatsAppIcon size={15} /> WhatsApp
              </LinkButton>
            ) : null}
            {can("support") ? (
              <LinkButton href={`/admin/notifications?phone=${encodeURIComponent(customer.phone)}`} variant="glass" size="sm">
                <Bell size={15} aria-hidden /> {t("إرسال إشعار", "Send notification")}
              </LinkButton>
            ) : null}
          </div>
        </div>
      </header>

      <Summary data={data} />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="space-y-5 xl:col-span-8">
          {subs ? <Subscriptions data={data} /> : null}
          {data.renewals ? <Renewals data={data} /> : null}
          {orders ? <Orders data={data} /> : null}
          {subs || orders ? <Devices data={data} /> : null}
        </div>

        <div className="space-y-5 xl:col-span-4">
          {data.tickets ? (
            <SectionCard title={t("الدعم", "Support")} icon={<LifeBuoy size={14} aria-hidden />} action={{ href: `/admin/operations?queue=support&q=${encodeURIComponent(customer.name)}`, label: t("في العمليات", "In Operations") }} testId="c360-support">
              {!data.tickets.ok ? (
                <SectionError label={t("تعذر تحميل التذاكر.", "Couldn't load tickets.")} />
              ) : data.tickets.data.length ? (
                <ul className="divide-y divide-line/70">
                  {data.tickets.data.slice(0, 8).map((ticket) => (
                    <li key={ticket.id}>
                      <Link href={`/admin/support/${encodeURIComponent(ticket.id)}`} className="flex items-center justify-between gap-3 py-2.5" data-testid="c360-ticket">
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-ink">{ticket.subject}</span>
                          <span className="nums block text-xs text-ink-3">{formatDateTime(ticket.updatedAt, lang)}{ticket.waitingOnTeam ? ` · ${t("بانتظار ردنا", "needs our reply")}` : ""}</span>
                        </span>
                        <StatusBadge status={ticket.status} label={TICKET_STATUS_LABELS[ticket.status]?.[lang] ?? ticket.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyLine>{t("لا توجد تذاكر دعم.", "No support tickets.")}</EmptyLine>
              )}
            </SectionCard>
          ) : null}

          {data.activity ? (
            <SectionCard title={t("النشاط", "Activity")} icon={<Activity size={14} aria-hidden />} action={can("audit") ? { href: "/admin/audit", label: t("سجل التدقيق", "Audit log") } : undefined} testId="c360-activity">
              {!data.activity.ok ? (
                <SectionError label={t("تعذر تحميل النشاط.", "Couldn't load activity.")} />
              ) : data.activity.data.length ? (
                <ol className="relative space-y-3 ps-5 before:absolute before:inset-y-1 before:start-[5px] before:w-px before:bg-line">
                  {data.activity.data.map((event) => (
                    <li key={event.id} className="relative" data-testid="c360-activity-item" data-entity={event.entityType}>
                      <span className="absolute -start-5 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-canvas bg-brand-ink" aria-hidden />
                      <p className="text-sm leading-6 text-ink">{event.summary}</p>
                      <p className="nums text-xs text-ink-3">{formatDateTime(event.createdAt, lang)}</p>
                    </li>
                  ))}
                </ol>
              ) : (
                <EmptyLine>{t("لا يوجد نشاط مسجّل.", "No recorded activity.")}</EmptyLine>
              )}
            </SectionCard>
          ) : null}

          {withheld.length ? (
            <SectionCard title={t("غير ضمن صلاحياتك", "Outside your permissions")} icon={<EyeOff size={14} aria-hidden />} testId="c360-withheld">
              <ul className="space-y-1.5 text-sm text-ink-3">
                {withheld.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-ink-3" aria-hidden />
                    {item}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[11px] text-ink-3">{t("هذه البيانات لا تُحمَّل لدورك.", "This data isn't loaded for your role.")}</p>
            </SectionCard>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ summary

async function Summary({ data }: { data: Customer360 }) {
  const { t, lang } = await getI18n();
  const tiles: { key: string; label: string; value: ReactNode }[] = [];
  const failed = <span className="text-base text-danger">{t("تعذر التحميل", "Unavailable")}</span>;

  if (data.subscriptions) {
    const subs = data.subscriptions.ok ? data.subscriptions.data : null;
    tiles.push({ key: "active", label: t("اشتراكات فعّالة", "Active subscriptions"), value: subs ? subs.filter((sub) => sub.state === "ACTIVE" || sub.state === "EXPIRING").length : failed });
    tiles.push({ key: "total", label: t("كل الاشتراكات", "All subscriptions"), value: subs ? subs.length : failed });
  }
  if (data.renewals) tiles.push({ key: "renewals", label: t("تجديدات مستحقة", "Renewals due"), value: data.renewals.ok ? data.renewals.data.length : failed });
  if (data.orders) tiles.push({ key: "orders", label: t("طلبات مفتوحة", "Open orders"), value: data.orders.ok ? data.orders.data.filter((order) => isOpen(order.status)).length : failed });
  if (data.receipts) tiles.push({ key: "paid", label: t("المدفوع (إيصالات)", "Paid (receipts)"), value: data.receipts.ok ? formatPrice(data.receipts.data, lang) : failed });
  if (data.tickets) tiles.push({ key: "tickets", label: t("تذاكر مفتوحة", "Open tickets"), value: data.tickets.ok ? data.tickets.data.filter((ticket) => ticket.status !== "CLOSED").length : failed });

  if (!tiles.length) return null;

  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6" data-testid="c360-summary">
      {tiles.map((tile) => (
        <div key={tile.key} className="rounded-2xl border border-line/80 bg-surface/70 p-4" data-testid={`c360-metric-${tile.key}`}>
          <dt className="text-xs font-semibold text-ink-3">{tile.label}</dt>
          <dd className="nums mt-1.5 text-2xl font-extrabold text-ink">{tile.value}</dd>
        </div>
      ))}
    </dl>
  );
}

// ------------------------------------------------------------------ subscriptions

async function Subscriptions({ data }: { data: Customer360 }) {
  const { t, lang } = await getI18n();
  const subs = data.subscriptions!;
  const ordersBySub = new Map<number, { id: number; number: string }[]>();
  if (data.orders?.ok) for (const order of data.orders.data) if (order.subscriptionId) ordersBySub.set(order.subscriptionId, [...(ordersBySub.get(order.subscriptionId) ?? []), { id: order.id, number: order.number }]);

  return (
    <SectionCard title={t("الاشتراكات", "Subscriptions")} icon={<Tv size={14} aria-hidden />} action={{ href: "/admin/subscriptions", label: t("إدارة الاشتراكات", "Manage subscriptions") }} testId="c360-subscriptions">
      {!subs.ok ? (
        <SectionError label={t("تعذر تحميل الاشتراكات.", "Couldn't load subscriptions.")} />
      ) : subs.data.length ? (
        <ul className="space-y-3">
          {subs.data.map((sub) => (
            <li key={sub.id} className="rounded-2xl border border-line/70 bg-white/[0.02] p-4" data-testid="c360-subscription" data-state={sub.state}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold text-ink">{sub.packageName}</p>
                  <p className="nums text-xs text-ink-3">
                    #{sub.id} · {sub.serviceType} · {formatDate(sub.startDate, lang)} – {formatDate(sub.expiryDate, lang)}
                  </p>
                </div>
                <span className="flex items-center gap-2">
                  <StatusBadge status={sub.state} label={SUBSCRIPTION_STATE_LABELS[sub.state][lang]} />
                  {sub.state !== "SUSPENDED" ? (
                    <span className={cn("nums text-xs font-bold", sub.daysRemaining <= 0 ? "text-danger" : sub.state === "EXPIRING" ? "text-warning" : "text-ink-3")}>
                      {sub.daysRemaining <= 0 ? t("منتهي", "ended") : t(`${sub.daysRemaining} يوم متبقي`, `${sub.daysRemaining} d left`)}
                    </span>
                  ) : null}
                </span>
              </div>
              <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                {sub.username ? <Detail label="Username" value={<span className="nums" dir="ltr">{sub.username}</span>} /> : null}
                {sub.serviceType === "IPTV" || sub.hasPassword ? (
                  <Detail label={t("كلمة المرور", "Password")} value={<RevealPassword subscriptionId={sub.id} hasPassword={sub.hasPassword} />} />
                ) : null}
                {sub.deviceId ? <Detail label={t("معرّف الجهاز", "Device ID")} value={<span className="nums" dir="ltr">{sub.deviceId}</span>} /> : null}
                {sub.macAddress ? <Detail label="MAC" value={<span className="nums" dir="ltr">{sub.macAddress}</span>} /> : null}
                <Detail label={t("الاتصالات المسموحة", "Max connections")} value={<span className="nums">{sub.maxConnections}</span>} />
                {ordersBySub.get(sub.id)?.length ? (
                  <Detail
                    label={t("الطلبات المرتبطة", "Linked orders")}
                    value={
                      <span className="flex flex-wrap gap-2">
                        {ordersBySub.get(sub.id)!.map((order) => (
                          <Link key={order.id} href={`/admin/orders/${order.id}`} className="nums text-brand-ink hover:text-ink">{order.number}</Link>
                        ))}
                      </span>
                    }
                  />
                ) : null}
              </dl>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyLine>{t("لا توجد اشتراكات.", "No subscriptions.")}</EmptyLine>
      )}
    </SectionCard>
  );
}

function Detail({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line/50 pb-1.5">
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className="text-end font-semibold text-ink">{value}</dd>
    </div>
  );
}

// ------------------------------------------------------------------ renewals

async function Renewals({ data }: { data: Customer360 }) {
  const { t, lang } = await getI18n();
  const renewals = data.renewals!;

  return (
    <SectionCard title={t("التجديدات", "Renewals")} icon={<RefreshCw size={14} aria-hidden />} action={{ href: `/admin/operations?queue=renewals&q=${encodeURIComponent(data.customer.name)}`, label: t("في العمليات", "In Operations") }} testId="c360-renewals">
      <p className="mb-3 text-xs text-ink-3">{t("اشتراكات تنتهي خلال 14 يوم أو انتهت خلال آخر 30 يوم.", "Subscriptions ending in the next 14 days or that ended in the last 30.")}</p>
      {!renewals.ok ? (
        <SectionError label={t("تعذر تحميل التجديدات.", "Couldn't load renewals.")} />
      ) : renewals.data.length ? (
        <ul className="space-y-3">
          {renewals.data.map((item) => (
            <li key={item.id} className="rounded-2xl border border-line/70 bg-white/[0.02] p-4" data-testid="c360-renewal">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-ink">{item.packageName} <span className="nums text-xs text-ink-3">#{item.id}</span></p>
                  <p className="text-xs text-ink-3">
                    {t("ينتهي", "Ends")} <span className="nums">{formatDate(item.expiryDate, lang)}</span>
                    {item.lastContactAt ? <> · {t("آخر تواصل", "Last contacted")} <span className="nums">{formatDateTime(item.lastContactAt, lang)}</span></> : null}
                  </p>
                </div>
                <StatusBadge status={item.state} label={SUBSCRIPTION_STATE_LABELS[item.state][lang]} />
              </div>
              {item.openRenewalOrder ? (
                <p className="mt-2 text-xs text-success" data-testid="c360-renewal-requested">
                  {t("طلب تجديد مفتوح:", "Renewal requested:")} <Link href={`/admin/orders/${item.openRenewalOrder.id}`} className="nums font-semibold underline-offset-4 hover:underline">{item.openRenewalOrder.number}</Link>
                </p>
              ) : null}
              <OpsActionForm action={logRenewalContactAction} className="mt-3 flex flex-wrap items-center gap-2">
                <input type="hidden" name="subscriptionId" value={item.id} />
                <Input name="note" placeholder={t("ملاحظة (اختياري)", "Note (optional)")} className="h-9 min-w-40 flex-1 py-0 text-sm" maxLength={200} aria-label={t("ملاحظة", "Note")} />
                <SubmitButton size="sm" variant="ghost"><Phone size={14} aria-hidden /> {t("تسجيل تواصل", "Log contact")}</SubmitButton>
              </OpsActionForm>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyLine>{t("لا توجد تجديدات مستحقة.", "No renewals due.")}</EmptyLine>
      )}
    </SectionCard>
  );
}

// ------------------------------------------------------------------ orders

async function Orders({ data }: { data: Customer360 }) {
  const { t, lang } = await getI18n();
  const orders = data.orders!;

  return (
    <SectionCard title={t("الطلبات", "Orders")} icon={<ShoppingBag size={14} aria-hidden />} action={{ href: `/admin/orders?status=all&q=${encodeURIComponent(data.customer.phone)}`, label: t("كل طلباته", "All their orders") }} testId="c360-orders">
      {!orders.ok ? (
        <SectionError label={t("تعذر تحميل الطلبات.", "Couldn't load orders.")} />
      ) : orders.data.length ? (
        <ul className="divide-y divide-line/70">
          {orders.data.slice(0, 10).map((order) => (
            <li key={order.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5" data-testid="c360-order">
              <Link href={`/admin/orders/${order.id}`} className="min-w-0">
                <span className="nums block text-sm font-bold text-ink">{order.number}</span>
                <span className="block truncate text-xs text-ink-3">
                  {REQUEST_TYPE_LABELS[order.requestType]?.[lang] ?? order.requestType} · {order.serviceName} · <span className="nums">{formatPrice(order.price, lang)}</span> · <span className="nums">{formatDate(order.createdAt, lang)}</span>
                </span>
              </Link>
              <span className="flex flex-wrap items-center gap-2">
                {order.proofUploadedAt && isUnpaid(order.status) ? (
                  <Link href={`/admin/operations?queue=payments&q=${order.number}`} className="inline-flex items-center gap-1 text-xs font-semibold text-glow hover:underline" data-testid="c360-verify-payment">
                    <FileCheck2 size={13} aria-hidden /> {t("تحقق من الدفع", "Verify payment")}
                  </Link>
                ) : null}
                {["PAID", "FULFILLING"].includes(order.status) && order.requestType !== "DEVICE_PURCHASE" ? (
                  <Link href={`/admin/subscription-requests/${order.id}/add`} className="text-xs font-semibold text-brand-ink hover:underline">{t("تفعيل", "Activate")}</Link>
                ) : null}
                <StatusBadge status={order.status} label={ORDER_STATUS_LABELS[order.status][lang]} />
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyLine>{t("لا توجد طلبات.", "No orders.")}</EmptyLine>
      )}
      {orders.ok && orders.data.length > 10 ? <p className="mt-2 text-xs text-ink-3">{t(`و ${orders.data.length - 10} طلب أقدم`, `and ${orders.data.length - 10} older orders`)}</p> : null}
      {data.can("orders") ? (
        <p className="mt-3 text-[11px] text-ink-3">
          <Workflow size={11} className="me-1 inline" aria-hidden />
          {t("تغيير حالة الطلب والتحقق من الدفع يتم من صفحة الطلب أو مركز العمليات.", "Status changes and payment checks happen on the order page or in the Operations Center.")}
        </p>
      ) : null}
    </SectionCard>
  );
}

// ------------------------------------------------------------------ devices

async function Devices({ data }: { data: Customer360 }) {
  const { t, lang } = await getI18n();
  const purchased = data.orders?.ok ? data.orders.data.filter((order) => order.deviceName && (order.requestType === "DEVICE_PURCHASE" || (order.devicePrice ?? 0) > 0)) : null;
  const linked = data.subscriptions?.ok ? data.subscriptions.data.filter((sub) => sub.deviceId || sub.macAddress) : null;
  const failed = (data.orders && !data.orders.ok) || (data.subscriptions && !data.subscriptions.ok);
  const empty = !(purchased?.length || linked?.length);

  return (
    <SectionCard title={t("الأجهزة", "Devices")} icon={<Cpu size={14} aria-hidden />} action={data.can("catalogue") ? { href: "/admin/devices", label: t("كتالوج الأجهزة", "Device catalogue") } : undefined} testId="c360-devices">
      {failed ? <div className="mb-3"><SectionError label={t("تعذر تحميل بعض بيانات الأجهزة.", "Couldn't load some device data.")} /></div> : null}
      {purchased?.length ? (
        <div>
          <p className="text-xs font-semibold text-ink-3">{t("أجهزة مشتراة", "Purchased devices")}</p>
          <ul className="mt-2 divide-y divide-line/70">
            {purchased.map((order) => (
              <li key={order.id}>
                <Link href={`/admin/orders/${order.id}`} className="flex items-center justify-between gap-3 py-2" data-testid="c360-device-purchase">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-ink">{order.deviceName}</span>
                    <span className="nums block text-xs text-ink-3">{order.number} · {formatPrice(order.devicePrice ?? order.price, lang)}</span>
                  </span>
                  <StatusBadge status={order.status} label={ORDER_STATUS_LABELS[order.status][lang]} />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {linked?.length ? (
        <div className={purchased?.length ? "mt-4" : undefined}>
          <p className="text-xs font-semibold text-ink-3">{t("أجهزة مرتبطة بالاشتراكات", "Devices linked to subscriptions")}</p>
          <ul className="mt-2 divide-y divide-line/70">
            {linked.map((sub) => (
              <li key={sub.id} className="flex flex-wrap items-center justify-between gap-3 py-2" data-testid="c360-device-linked">
                <span className="min-w-0 text-sm text-ink">
                  {sub.packageName} <span className="nums text-xs text-ink-3">#{sub.id}</span>
                </span>
                <span className="nums text-xs text-ink-2" dir="ltr">{[sub.deviceId, sub.macAddress].filter(Boolean).join(" · ")}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {!failed && empty ? <EmptyLine>{t("لا توجد أجهزة مرتبطة.", "No linked devices.")}</EmptyLine> : null}
    </SectionCard>
  );
}
