import { CheckCircle2, Clock3, Tv } from "lucide-react";

import { OrderProofForm } from "@/app/components/payment/OrderProofForm";
import { ProofReceivedAnchor } from "@/app/components/payment/ProofReceivedAnchor";
import { TransferDetails, type TransferInfo } from "@/app/components/payment/TransferDetails";
import { LinkButton } from "@/app/ui/Button";
import { Notice } from "@/app/ui/States";
import type { Lang } from "@/src/lib/i18n";
import { ORDER_STATUS_LABELS } from "@/src/lib/order-status";
import type { OrderStage } from "@/src/lib/order-journey";
import type { Order } from "@/src/server/orders";

/**
 * What the customer does next for an order, by journey stage: pay and
 * upload the proof, wait for review, or see the result. Shared by the
 * dashboard's "current order" panel and the order page.
 */
export function OrderPaymentFlow({
  order,
  stage,
  proofUrl,
  transfer,
  lang,
}: {
  order: Order;
  stage: OrderStage;
  proofUrl: string | null;
  transfer: TransferInfo | null;
  lang: Lang;
}) {
  const t = (ar: string, en: string) => (lang === "ar" ? ar : en);

  if (stage === "PAYMENT_PENDING") {
    return (
      <div className="space-y-5">
        <section
          aria-labelledby={`pay-${order.id}`}
          data-testid="payment-card"
          className="rounded-panel border-2 border-brand/50 bg-surface-2/60 p-5 sm:p-6"
        >
          <h3 id={`pay-${order.id}`} className="flex items-center gap-2.5 text-lg font-bold text-ink">
            <span className="nums flex h-7 w-7 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">2</span>
            {t("الدفع", "Payment")}
          </h3>
          <div className="mt-4">
            {transfer ? (
              <TransferDetails amount={order.price} info={transfer} />
            ) : (
              <Notice tone="warning">
                {t("تفاصيل الدفع غير متاحة حاليًا. تواصل ويانا حتى نكمل طلبك.", "Payment details aren't available right now. Contact us to complete your order.")}
              </Notice>
            )}
          </div>
        </section>

        <section aria-labelledby={`proof-${order.id}`} data-testid="proof-section" className="surface rounded-panel p-5 sm:p-6">
          <h3 id={`proof-${order.id}`} className="flex items-center gap-2.5 text-lg font-bold text-ink">
            <span className="nums flex h-7 w-7 items-center justify-center rounded-full border border-line-strong text-xs font-bold text-ink-2">3</span>
            {t("إثبات الدفع", "Payment proof")}
          </h3>
          <p className="mb-4 mt-2 text-[15px] leading-7 text-ink-2">
            {t("بعد إتمام التحويل، ارفع صورة إثبات الدفع.", "Once the transfer is done, upload a screenshot of it.")}
          </p>
          <OrderProofForm orderId={order.id} paymentReference={order.paymentReference} replacing={false} />
        </section>
      </div>
    );
  }

  if (stage === "UNDER_REVIEW") {
    return (
      <div className="space-y-4" data-testid="review-card">
        <ProofReceivedAnchor orderId={order.id} />
        <div className="surface-raised flex items-start gap-3 rounded-panel border border-success/40 p-5">
          <CheckCircle2 size={24} className="mt-0.5 shrink-0 text-success" aria-hidden />
          <div>
            <p className="text-base font-bold text-ink">{t("تم استلام إثبات الدفع ✅", "Payment proof received ✅")}</p>
            <p className="mt-1 text-[15px] leading-7 text-ink-2">
              {t(
                "طلبك قيد المراجعة. فريق شاشتنا يتأكد من وصول المبلغ ثم يفعّل اشتراكك، وراح يوصلك إشعار.",
                "Your order is under review. The Shashtna team checks the payment arrived, then activates your subscription — you'll get a notification.",
              )}
            </p>
          </div>
        </div>
        {proofUrl ? (
          <div className="grid gap-4 sm:grid-cols-[180px_1fr] sm:items-start">
            <a href={proofUrl} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-2xl border border-line bg-black/30">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={proofUrl} alt={t("إثبات الدفع المرسل", "Payment proof you sent")} className="max-h-56 w-full object-contain" />
            </a>
            <details className="group rounded-2xl border border-line bg-surface-2 px-4 py-1 open:pb-4">
              <summary className="flex min-h-12 cursor-pointer list-none items-center text-sm font-semibold text-ink [&::-webkit-details-marker]:hidden">
                {t("رفعت صورة غلط؟ أرسل صورة جديدة", "Wrong image? Send a new one")}
              </summary>
              <OrderProofForm orderId={order.id} paymentReference={order.paymentReference} replacing />
            </details>
          </div>
        ) : null}
      </div>
    );
  }

  if (stage === "PAID") {
    return (
      <div className="surface-raised flex items-start gap-3 rounded-panel border border-success/40 p-5" data-testid="paid-card">
        <Clock3 size={24} className="mt-0.5 shrink-0 text-glow" aria-hidden />
        <div>
          <p className="text-base font-bold text-ink">{t("تم تأكيد الدفع ✅", "Payment confirmed ✅")}</p>
          <p className="mt-1 text-[15px] leading-7 text-ink-2">
            {t(
              "فريقنا يجهز اشتراكك الآن. عند التفعيل تلگى بيانات الدخول بحسابك ويوصلك إشعار.",
              "Our team is setting up your subscription. When it's active you'll find your login details in your account and get a notification.",
            )}
          </p>
        </div>
      </div>
    );
  }

  if (stage === "ACTIVATED") {
    return (
      <div className="surface-raised flex flex-wrap items-center gap-4 rounded-panel border border-success/40 p-5" data-testid="activated-card">
        <CheckCircle2 size={24} className="shrink-0 text-success" aria-hidden />
        <p className="flex-1 text-base font-bold text-ink">{t("تم تفعيل اشتراكك ✅", "Your subscription is active ✅")}</p>
        {order.subscriptionId ? (
          <LinkButton href={`/subscriptions/${order.subscriptionId}`}>
            <Tv size={16} aria-hidden />
            {t("عرض الاشتراك", "View subscription")}
          </LinkButton>
        ) : null}
      </div>
    );
  }

  const label = ORDER_STATUS_LABELS[order.status];

  return (
    <Notice tone="warning" title={label[lang]}>
      {lang === "ar" ? label.hintAr : label.hintEn}
    </Notice>
  );
}
