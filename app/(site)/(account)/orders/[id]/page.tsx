import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ImageIcon, MessageSquarePlus, Phone } from "lucide-react";

import { updateOrderContactAction } from "@/app/(site)/(account)/actions";
import { CancelOrderButton } from "@/app/components/account/OrderControls";
import { OrderPaymentFlow } from "@/app/components/account/OrderPaymentFlow";
import { ActionForm } from "@/app/ui/ActionForm";
import { StatusBadge } from "@/app/ui/Badge";
import { FacebookIcon, TelegramIcon, WhatsAppIcon } from "@/app/ui/BrandIcons";
import { LinkButton } from "@/app/ui/Button";
import { Card, CardHeader } from "@/app/ui/Card";
import { Field, Select } from "@/app/ui/Field";
import { OrderJourney } from "@/app/ui/OrderJourney";
import { Notice } from "@/app/ui/States";
import { SubmitButton } from "@/app/ui/SubmitButton";
import { formatDate, formatDateTime, formatPrice } from "@/src/lib/i18n";
import { orderStage } from "@/src/lib/order-journey";
import { ORDER_STATUS_LABELS, REQUEST_TYPE_LABELS, isUnpaid } from "@/src/lib/order-status";
import { listEntityActivity } from "@/src/server/activity";
import { requireCustomer } from "@/src/server/auth";
import { getI18n } from "@/src/server/i18n";
import { getOrderForUser } from "@/src/server/orders";
import { proofUploadTimes } from "@/src/server/payment-proofs";
import { getSettings, manualTransferDetails, safeExternalUrl, telegramLink, whatsappLink } from "@/src/server/settings";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "تفاصيل الطلب" };

const CONTACT_LABELS: Record<string, { ar: string; en: string }> = {
  PENDING: { ar: "لم تُحدد", en: "Not chosen" },
  TELEGRAM: { ar: "تيليجرام", en: "Telegram" },
  WHATSAPP: { ar: "واتساب", en: "WhatsApp" },
  FACEBOOK: { ar: "فيسبوك", en: "Facebook" },
  PHONE: { ar: "اتصال هاتفي", en: "Phone call" },
};

/**
 * Everything about one order after checkout: the package, the journey,
 * paying and uploading the proof, the review state and the history.
 */
export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireCustomer(`/orders/${id}`);
  const orderId = Number(id);
  const order = Number.isInteger(orderId) ? await getOrderForUser(user.id, orderId) : null;

  if (!order) {
    notFound();
  }

  const [{ t, lang }, settings, events, proofs] = await Promise.all([
    getI18n(),
    getSettings(),
    listEntityActivity("ORDER", order.id, { customerVisibleOnly: true }),
    proofUploadTimes([order.id]),
  ]);
  const proofUploadedAt = proofs.get(order.id) ?? null;
  const proofUrl = proofUploadedAt ? `/api/orders/${order.id}/payment-proof?v=${encodeURIComponent(proofUploadedAt)}` : null;
  const stage = orderStage(order.status, Boolean(proofUploadedAt));

  const label = ORDER_STATUS_LABELS[order.status];
  const unpaid = isUnpaid(order.status);
  const message = t(
    `السلام عليكم، عندي طلب ${order.number} (${order.serviceName}) بمبلغ ${formatPrice(order.price, "ar")}. اسمي ${user.name} ورقمي ${user.phone}.`,
    `Hello, I have order ${order.number} (${order.serviceName}) for ${formatPrice(order.price, "en")}. My name is ${user.name}, phone ${user.phone}.`,
  );
  const channels = [
    telegramLink(settings["contact.telegram"], message) && { key: "TELEGRAM", href: telegramLink(settings["contact.telegram"], message)!, label: "Telegram", icon: <TelegramIcon size={18} /> },
    whatsappLink(settings["contact.whatsapp"], message) && { key: "WHATSAPP", href: whatsappLink(settings["contact.whatsapp"], message)!, label: "WhatsApp", icon: <WhatsAppIcon size={18} /> },
    safeExternalUrl(settings["contact.facebook"]) && { key: "FACEBOOK", href: safeExternalUrl(settings["contact.facebook"])!, label: "Facebook", icon: <FacebookIcon size={18} /> },
  ].filter(Boolean) as { key: string; href: string; label: string; icon: React.ReactNode }[];
  // Show the customer's chosen channel first.
  channels.sort((a, b) => Number(b.key === order.contactMethod) - Number(a.key === order.contactMethod));

  const details = [
    { label: t("نوع الطلب", "Order type"), value: REQUEST_TYPE_LABELS[order.requestType]?.[lang] ?? order.requestType },
    { label: order.requestType === "DEVICE_PURCHASE" ? t("الجهاز", "Device") : t("الباقة", "Plan"), value: order.serviceName },
    order.requestType !== "DEVICE_PURCHASE" ? { label: t("المدة", "Duration"), value: order.durationLabel } : null,
    order.deviceName && order.requestType !== "DEVICE_PURCHASE" ? { label: t("جهاز VIP", "VIP device"), value: order.deviceName } : null,
    { label: t("المبلغ", "Amount"), value: <span className="nums">{formatPrice(order.price, lang)}</span> },
    order.paymentMethod ? { label: t("طريقة الدفع", "Payment method"), value: order.paymentMethod } : null,
    order.paymentReference ? { label: t("رقم العملية", "Transaction number"), value: <span className="nums" dir="ltr">{order.paymentReference}</span> } : null,
    {
      label: t("إثبات الدفع", "Payment proof"),
      value: proofUrl ? (
        <a href={proofUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-brand-ink underline-offset-4 hover:underline">
          <ImageIcon size={15} aria-hidden />
          {t("عرض الصورة", "View image")}
        </a>
      ) : (
        t("لم يُرفع بعد", "Not uploaded yet")
      ),
    },
    { label: t("طريقة التواصل", "Contact method"), value: CONTACT_LABELS[order.contactMethod]?.[lang] ?? order.contactMethod },
    { label: t("تاريخ الطلب", "Placed on"), value: <span className="nums">{formatDate(order.createdAt, lang)}</span> },
  ].filter(Boolean) as { label: string; value: React.ReactNode }[];

  return (
    <div className="space-y-6">
      <LinkButton href="/orders" variant="ghost" size="sm" className="-ms-3">
        <ArrowRight size={16} className="ltr:rotate-180" aria-hidden />
        {t("الطلبات", "Orders")}
      </LinkButton>

      <Card className="p-5 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-ink-3">{t("الطلب", "Order")}</p>
            <h1 className="nums mt-1 text-2xl font-bold text-ink">{order.number}</h1>
            <p className="mt-1 text-sm text-ink-2">
              {order.serviceName}
              {order.requestType !== "DEVICE_PURCHASE" ? ` · ${order.durationLabel}` : ""}
            </p>
          </div>
          <div className="text-end">
            <StatusBadge status={order.status} label={label[lang]} />
            <p className="nums mt-3 text-2xl font-bold text-ink">{formatPrice(order.price, lang)}</p>
          </div>
        </div>
        {stage === "CANCELLED" || stage === "REJECTED" ? null : <OrderJourney stage={stage} lang={lang} className="mt-8" />}
      </Card>

      <OrderPaymentFlow order={order} stage={stage} proofUrl={proofUrl} transfer={manualTransferDetails(settings)} lang={lang} />

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Card className="p-6">
          <CardHeader title={t("تفاصيل الطلب", "Order details")} />
          <dl className="mt-4 divide-y divide-line">
            {details.map((row) => (
              <div key={row.label} className="flex items-start justify-between gap-4 py-3 text-sm">
                <dt className="text-ink-3">{row.label}</dt>
                <dd className="text-end font-semibold text-ink">{row.value}</dd>
              </div>
            ))}
          </dl>
          {order.customerNote ? (
            <p className="mt-4 rounded-xl bg-surface-2 p-3 text-sm leading-6 text-ink-2">
              <span className="font-semibold text-ink">{t("ملاحظتك: ", "Your note: ")}</span>
              {order.customerNote}
            </p>
          ) : null}
        </Card>

        <div className="space-y-6">
          {unpaid ? (
            <Card className="p-6">
              <CardHeader
                title={t("تحتاج تتواصل ويانا؟", "Need to reach us?")}
                description={t("راسلنا ورقم طلبك جاهز بالرسالة.", "Message us — your order number is already in the message.")}
              />
              <div className="mt-4 grid gap-2">
                {channels.map((channel) => (
                  <LinkButton key={channel.key} href={channel.href} external variant={channel.key === order.contactMethod ? "primary" : "secondary"}>
                    {channel.icon}
                    {channel.label}
                  </LinkButton>
                ))}
                {settings["contact.phone"] ? (
                  <LinkButton href={`tel:${settings["contact.phone"].replace(/[^\d+]/g, "")}`} external variant="secondary">
                    <Phone size={17} aria-hidden />
                    {t("اتصال", "Call")}
                  </LinkButton>
                ) : null}
              </div>
              <ActionForm action={updateOrderContactAction} className="mt-6 space-y-4 border-t border-line pt-5">
                <input type="hidden" name="orderId" value={order.id} />
                <Field label={t("طريقة التواصل المفضلة", "Preferred contact")} htmlFor="contactMethod">
                  <Select id="contactMethod" name="contactMethod" defaultValue={order.contactMethod === "PENDING" ? "PHONE" : order.contactMethod}>
                    {["TELEGRAM", "WHATSAPP", "FACEBOOK", "PHONE"].map((key) => (
                      <option key={key} value={key}>
                        {CONTACT_LABELS[key][lang]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <SubmitButton variant="secondary" pendingLabel={t("جاري الحفظ...", "Saving...")}>
                  {t("حفظ", "Save")}
                </SubmitButton>
              </ActionForm>
            </Card>
          ) : null}

          <Card className="p-6">
            <CardHeader title={t("تحتاج مساعدة؟", "Need help?")} />
            <div className="mt-4 flex flex-wrap gap-2">
              <LinkButton href={`/support/new?category=payment&orderId=${order.id}`} variant="secondary" size="sm">
                <MessageSquarePlus size={15} aria-hidden />
                {t("افتح تذكرة عن هذا الطلب", "Open a ticket about this order")}
              </LinkButton>
              {unpaid ? <CancelOrderButton orderId={order.id} orderNumber={order.number} /> : null}
            </div>
          </Card>
        </div>
      </div>

      {events.length ? (
        <Card className="p-6">
          <CardHeader title={t("سجل الطلب", "Order history")} />
          <ol className="mt-4 space-y-3">
            {events.map((event) => (
              <li key={event.id} className="flex items-start gap-3 text-sm">
                <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand" aria-hidden />
                <span className="flex-1 text-ink-2">{event.summary}</span>
                <span className="nums shrink-0 text-xs text-ink-3">{formatDateTime(event.createdAt, lang)}</span>
              </li>
            ))}
          </ol>
        </Card>
      ) : (
        <Notice tone="info">
          {t("أي تحديث على الطلب راح يظهر هنا وبإشعاراتك.", "Any update to this order will appear here and in your notifications.")}{" "}
          <Link href="/notifications" className="font-semibold underline-offset-4 hover:underline">
            {t("الإشعارات", "Notifications")}
          </Link>
        </Notice>
      )}
    </div>
  );
}
