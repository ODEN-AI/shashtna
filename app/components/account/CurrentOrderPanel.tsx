import { CheckCircle2, ChevronLeft } from "lucide-react";

import { OrderPaymentFlow } from "@/app/components/account/OrderPaymentFlow";
import type { TransferInfo } from "@/app/components/payment/TransferDetails";
import { LinkButton } from "@/app/ui/Button";
import { cn } from "@/app/ui/cn";
import { OrderJourney } from "@/app/ui/OrderJourney";
import { formatPrice, type Lang } from "@/src/lib/i18n";
import type { OrderStage } from "@/src/lib/order-journey";
import type { Order } from "@/src/server/orders";

/**
 * The dashboard's "your current order" block: package summary, journey and
 * the next action (pay + upload proof, or the review state).
 */
export function CurrentOrderPanel({
  order,
  stage,
  proofUrl,
  transfer,
  lang,
  justCreated,
}: {
  order: Order;
  stage: OrderStage;
  proofUrl: string | null;
  transfer: TransferInfo | null;
  lang: Lang;
  justCreated: boolean;
}) {
  const t = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const summary = [
    order.requestType !== "DEVICE_PURCHASE" ? order.durationLabel : null,
    order.deviceName && order.requestType !== "DEVICE_PURCHASE" ? order.deviceName : null,
  ].filter(Boolean);

  return (
    <section
      id="current-order"
      aria-labelledby="current-order-heading"
      data-testid="current-order"
      data-order-id={order.id}
      className={cn(
        "surface scroll-mt-24 space-y-5 rounded-panel p-5 sm:p-6",
        justCreated && "ring-2 ring-glow/60",
      )}
    >
      {justCreated ? (
        <div className="flex items-start gap-3 rounded-2xl border border-success/40 bg-success/10 p-4" role="status">
          <CheckCircle2 size={24} className="mt-0.5 shrink-0 text-success" aria-hidden />
          <div>
            <p className="text-lg font-bold text-ink">{t("تم إنشاء طلبك ✅", "Your order has been created ✅")}</p>
            <p className="mt-0.5 text-[15px] text-ink-2">
              {stage === "PAYMENT_PENDING"
                ? t("الخطوة التالية: إتمام الدفع", "Next step: complete the payment")
                : t("تكدر تتابع طلبك من هنا.", "You can follow your order here.")}
            </p>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="current-order-heading" className="text-xs font-semibold text-ink-3">
            {t("طلبك الحالي", "Your current order")} · <span className="nums">{order.number}</span>
          </h2>
          <p className="mt-1 text-xl font-bold text-ink">{order.serviceName}</p>
          {summary.length ? <p className="mt-0.5 text-sm text-ink-2">{summary.join(" · ")}</p> : null}
        </div>
        <div className="text-end">
          <p className="text-xs text-ink-3">{t("الإجمالي", "Total")}</p>
          <p className="nums text-xl font-bold text-ink">{formatPrice(order.price, lang)}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-surface-2/50 p-4 sm:p-5">
        <OrderJourney stage={stage} lang={lang} />
      </div>

      <OrderPaymentFlow order={order} stage={stage} proofUrl={proofUrl} transfer={transfer} lang={lang} />

      <LinkButton href={`/orders/${order.id}`} variant="ghost" size="sm" className="-ms-2">
        {t("تفاصيل الطلب كاملة", "Full order details")}
        <ChevronLeft size={15} className="ltr:rotate-180" aria-hidden />
      </LinkButton>
    </section>
  );
}
