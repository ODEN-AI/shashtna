import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, PackageCheck, Phone, Tv, UserRound } from "lucide-react";

import { updateOrderStatusAction } from "@/app/admin/actions";
import { Forbidden } from "@/app/components/admin/Forbidden";
import { ActionForm } from "@/app/ui/ActionForm";
import { StatusBadge } from "@/app/ui/Badge";
import { WhatsAppIcon } from "@/app/ui/BrandIcons";
import { LinkButton } from "@/app/ui/Button";
import { Card, CardHeader } from "@/app/ui/Card";
import { Field, Input, Select, Textarea } from "@/app/ui/Field";
import { OrderStepper } from "@/app/ui/OrderStepper";
import { Notice } from "@/app/ui/States";
import { SubmitButton } from "@/app/ui/SubmitButton";
import { formatDateTime, formatPrice } from "@/src/lib/i18n";
import { ORDER_STATUS_LABELS, REQUEST_TYPE_LABELS, allowedTransitions, isOpen } from "@/src/lib/order-status";
import { listEntityActivity } from "@/src/server/activity";
import { customersById } from "@/src/server/admin-data";
import { requireStaffPage } from "@/src/server/auth";
import { getI18n } from "@/src/server/i18n";
import { getOrder } from "@/src/server/orders";
import { whatsappLink } from "@/src/server/settings";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "تفاصيل الطلب" };

const CONTACT_LABELS: Record<string, string> = {
  PENDING: "—",
  TELEGRAM: "Telegram",
  WHATSAPP: "WhatsApp",
  FACEBOOK: "Facebook",
  PHONE: "Phone",
};

export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { allowed } = await requireStaffPage(`/admin/orders/${id}`, "orders");

  if (!allowed) {
    return <Forbidden />;
  }

  const order = Number.isInteger(Number(id)) ? await getOrder(Number(id)) : null;

  if (!order) {
    notFound();
  }

  const [{ t, lang }, customers, events] = await Promise.all([
    getI18n(),
    customersById([order.userId]),
    listEntityActivity("ORDER", order.id),
  ]);
  const customer = customers.get(order.userId);
  const transitions = allowedTransitions(order.status);
  const open = isOpen(order.status);
  const canActivate = open && order.requestType !== "DEVICE_PURCHASE";
  const customerWhatsApp = customer
    ? whatsappLink(
        customer.phone.replace(/^0/, "964"),
        `مرحبًا ${customer.name}، معك فريق شاشتنا بخصوص طلبك ${order.number} (${order.serviceName}) بمبلغ ${formatPrice(order.price, "ar")}.`,
      )
    : null;

  const details = [
    { label: t("النوع", "Type"), value: REQUEST_TYPE_LABELS[order.requestType]?.[lang] ?? order.requestType },
    { label: t("الخدمة", "Service"), value: `${order.serviceName} (${order.serviceType})` },
    { label: t("المدة", "Duration"), value: order.durationLabel },
    order.deviceName ? { label: t("الجهاز", "Device"), value: `${order.deviceName}${order.devicePrice ? ` · ${formatPrice(order.devicePrice, lang)}` : ""}` } : null,
    { label: t("المبلغ", "Amount"), value: formatPrice(order.price, lang) },
    { label: t("طريقة التواصل", "Contact method"), value: CONTACT_LABELS[order.contactMethod] ?? order.contactMethod },
    { label: t("طريقة الدفع", "Payment method"), value: order.paymentMethod ?? "—" },
    { label: t("مرجع الدفع", "Payment reference"), value: order.paymentReference ?? "—" },
    order.subscriptionId ? { label: t("الاشتراك المرتبط", "Linked subscription"), value: `#${order.subscriptionId}` } : null,
    { label: t("أُنشئ", "Created"), value: formatDateTime(order.createdAt, lang) },
    { label: t("آخر تحديث", "Updated"), value: formatDateTime(order.updatedAt, lang) },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <div className="space-y-6">
      <LinkButton href="/admin/orders" variant="ghost" size="sm" className="-ms-3">
        <ArrowRight size={16} className="ltr:rotate-180" aria-hidden />
        {t("الطلبات", "Orders")}
      </LinkButton>

      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="nums text-2xl font-bold text-ink">{order.number}</p>
            <p className="mt-1 text-sm text-ink-2">{order.serviceName}</p>
          </div>
          <div className="text-end">
            <StatusBadge status={order.status} label={ORDER_STATUS_LABELS[order.status][lang]} />
            <p className="nums mt-2 text-xl font-bold text-ink">{formatPrice(order.price, lang)}</p>
          </div>
        </div>
        <div className="mt-8">
          <OrderStepper status={order.status} lang={lang} />
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card className="p-6">
            <CardHeader title={t("تفاصيل الطلب", "Order details")} />
            <dl className="mt-4 grid gap-x-8 sm:grid-cols-2">
              {details.map((row) => (
                <div key={row.label} className="flex items-start justify-between gap-4 border-b border-line/70 py-3 text-sm">
                  <dt className="text-ink-3">{row.label}</dt>
                  <dd className="nums text-end font-semibold text-ink">{row.value}</dd>
                </div>
              ))}
            </dl>
            {order.customerNote ? (
              <p className="mt-4 rounded-xl bg-surface-2 p-3 text-sm text-ink-2">
                <span className="font-semibold text-ink">{t("ملاحظة العميل: ", "Customer note: ")}</span>
                {order.customerNote}
              </p>
            ) : null}
          </Card>

          <Card className="p-6">
            <CardHeader title={t("سجل الطلب", "Order history")} />
            {events.length ? (
              <ol className="mt-4 space-y-3">
                {events.map((event) => (
                  <li key={event.id} className="flex items-start gap-3 text-sm">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-hidden />
                    <span className="flex-1 text-ink-2">{event.summary}</span>
                    <span className="nums shrink-0 text-xs text-ink-3">{formatDateTime(event.createdAt, lang)}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-4 text-sm text-ink-3">{t("ماكو أحداث مسجلة لهذا الطلب (طلب قديم).", "No events recorded for this order (older order).")}</p>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <CardHeader icon={<UserRound size={19} aria-hidden />} title={t("العميل", "Customer")} />
            {customer ? (
              <div className="mt-4 space-y-3">
                <Link href={`/admin/customers/${customer.id}`} className="block font-bold text-ink hover:text-brand-ink">
                  {customer.name}
                </Link>
                <p className="nums text-sm text-ink-2" dir="ltr">{customer.phone}</p>
                <div className="flex flex-wrap gap-2">
                  <LinkButton href={`tel:${customer.phone.replace(/[^\d+]/g, "")}`} external variant="secondary" size="sm">
                    <Phone size={15} aria-hidden />
                    {t("اتصال", "Call")}
                  </LinkButton>
                  {customerWhatsApp ? (
                    <LinkButton href={customerWhatsApp} external variant="secondary" size="sm">
                      <WhatsAppIcon size={15} />
                      WhatsApp
                    </LinkButton>
                  ) : null}
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm text-ink-3">—</p>
            )}
          </Card>

          {canActivate ? (
            <Card className="p-6" raised>
              <CardHeader
                icon={<PackageCheck size={19} aria-hidden />}
                title={order.requestType === "RENEW" ? t("تنفيذ التجديد", "Fulfil renewal") : t("تفعيل الاشتراك", "Activate subscription")}
                description={t("يفتح نموذج إنشاء/تجديد الاشتراك وإصدار الإيصال. الطلب يصير «مكتمل» تلقائيًا.", "Opens the create/renew form and issues the receipt. The order becomes Completed automatically.")}
              />
              <LinkButton href={`/admin/subscription-requests/${order.id}/add`} className="mt-4 w-full">
                <Tv size={16} aria-hidden />
                {order.requestType === "RENEW" ? t("تجديد الاشتراك", "Renew subscription") : t("إنشاء الاشتراك", "Create subscription")}
              </LinkButton>
            </Card>
          ) : null}

          <Card className="p-6">
            <CardHeader title={t("تحديث الحالة", "Update status")} />
            {transitions.length ? (
              <ActionForm action={updateOrderStatusAction} className="mt-4 space-y-4">
                <input type="hidden" name="orderId" value={order.id} />
                <Field label={t("الحالة الجديدة", "New status")} htmlFor="status">
                  <Select id="status" name="status" defaultValue={transitions[0]}>
                    {transitions.map((status) => (
                      <option key={status} value={status}>
                        {ORDER_STATUS_LABELS[status][lang]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={t("مرجع الدفع", "Payment reference")} htmlFor="paymentReference">
                  <Input id="paymentReference" name="paymentReference" defaultValue={order.paymentReference ?? ""} dir="ltr" className="text-start" />
                </Field>
                <Field label={t("ملاحظة داخلية", "Internal note")} htmlFor="adminNote" hint={t("لا تظهر للعميل.", "Not visible to the customer.")}>
                  <Textarea id="adminNote" name="adminNote" rows={3} defaultValue={order.adminNote ?? ""} />
                </Field>
                <SubmitButton pendingLabel={t("جاري الحفظ...", "Saving...")}>{t("حفظ", "Save")}</SubmitButton>
                <p className="text-xs text-ink-3">{t("العميل يستلم إشعار بكل تغيير حالة.", "The customer is notified of every status change.")}</p>
              </ActionForm>
            ) : (
              <Notice tone="info" className="mt-4">
                {t("الطلب منتهي ولا يمكن تغيير حالته.", "This order is final and its status can't change.")}
              </Notice>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
