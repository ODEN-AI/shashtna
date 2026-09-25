import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ImageIcon, PackageCheck, Phone, Tv, UserRound } from "lucide-react";

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
import { proofUploadTimes } from "@/src/server/payment-proofs";
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

  const [{ t, lang }, customers, events, proofs] = await Promise.all([
    getI18n(),
    customersById([order.userId]),
    listEntityActivity("ORDER", order.id),
    proofUploadTimes([order.id]),
  ]);
  const proofUploadedAt = proofs.get(order.id) ?? null;
  const proofUrl = proofUploadedAt ? `/api/orders/${order.id}/payment-proof?v=${encodeURIComponent(proofUploadedAt)}` : null;
  const customer = customers.get(order.userId);
  const transitions = allowedTransitions(order.status);
  // With a proof on file the likely next step is "Paid" — still a manual choice.
  const suggestedStatus = proofUrl && transitions.includes("PAID") ? "PAID" : transitions[0];
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
    { label: t("رقم العملية / مرجع الدفع", "Transaction / payment reference"), value: order.paymentReference ?? "—" },
    { label: t("إثبات الدفع", "Payment proof"), value: proofUploadedAt ? t("مرفوع", "Uploaded") : t("غير مرفوع", "Not uploaded") },
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
          <Card className={proofUrl ? "border-2 border-brand/50 p-6" : "p-6"} raised={Boolean(proofUrl)}>
            <CardHeader
              icon={<ImageIcon size={19} aria-hidden />}
              title={t("إثبات الدفع", "Payment proof")}
              description={
                proofUploadedAt
                  ? t(`رفعه العميل ${formatDateTime(proofUploadedAt, lang)}`, `Uploaded by the customer ${formatDateTime(proofUploadedAt, lang)}`)
                  : undefined
              }
            />
            {proofUrl ? (
              <div className="mt-4 space-y-3">
                <a href={proofUrl} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-2xl border border-line bg-black/30">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={proofUrl} alt={t("إثبات الدفع", "Payment proof")} className="max-h-[28rem] w-full object-contain" data-testid="admin-payment-proof" />
                </a>
                <p className="text-xs leading-6 text-ink-3">
                  {t(
                    "رفع الصورة ما يغيّر حالة الطلب. تأكد من وصول المبلغ فعلًا، بعدين غيّر الحالة إلى «تم الدفع».",
                    "Uploading a proof doesn't change the order status. Check the money actually arrived, then set the status to Paid.",
                  )}{" "}
                  <a href={proofUrl} target="_blank" rel="noreferrer" className="font-semibold text-brand-ink hover:underline">
                    {t("فتح الصورة بحجمها الكامل", "Open full size")}
                  </a>
                </p>
              </div>
            ) : (
              <p className="mt-4 text-sm text-ink-3">{t("لم يرفع العميل إثبات الدفع بعد.", "The customer hasn't uploaded a payment proof yet.")}</p>
            )}
          </Card>

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
                  <Select id="status" name="status" defaultValue={suggestedStatus}>
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
