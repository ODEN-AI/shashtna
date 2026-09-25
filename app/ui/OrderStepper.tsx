import { Check } from "lucide-react";

import type { Lang } from "@/src/lib/i18n";
import {
  ORDER_STATUS_LABELS,
  normalizeOrderStatus,
  orderTimeline,
} from "@/src/lib/order-status";

import { cn } from "./cn";
import { Notice } from "./States";

/** Visual order timeline: vertical on phones, horizontal from `sm` up. */
export function OrderStepper({ status, lang }: { status: string; lang: Lang }) {
  const normalized = normalizeOrderStatus(status);
  const steps = orderTimeline(normalized);
  const isAr = lang === "ar";

  if (normalized === "CANCELLED" || normalized === "REJECTED") {
    const label = ORDER_STATUS_LABELS[normalized];

    return (
      <Notice tone={normalized === "REJECTED" ? "danger" : "warning"} title={isAr ? label.ar : label.en}>
        {isAr ? label.hintAr : label.hintEn}
      </Notice>
    );
  }

  return (
    <ol className="grid gap-0 sm:grid-cols-5" aria-label={isAr ? "مراحل الطلب" : "Order progress"}>
      {steps.map((step, index) => {
        const label = ORDER_STATUS_LABELS[step.status];
        const last = index === steps.length - 1;

        return (
          <li key={step.status} className="relative flex gap-3 pb-6 sm:flex-col sm:items-center sm:pb-0 sm:text-center">
            {!last ? (
              <span
                aria-hidden
                className={cn(
                  "absolute start-[15px] top-8 h-[calc(100%-2rem)] w-px sm:start-[calc(50%+18px)] sm:top-[15px] sm:h-px sm:w-[calc(100%-36px)]",
                  step.state === "done" ? "bg-brand" : "bg-line-strong",
                )}
              />
            ) : null}
            <span
              className={cn(
                "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-bold",
                step.state === "done" && "border-brand bg-brand text-white",
                step.state === "current" && "border-glow bg-glow/10 text-glow shadow-glow",
                step.state === "upcoming" && "border-line-strong bg-surface-2 text-ink-3",
              )}
              aria-current={step.state === "current" ? "step" : undefined}
            >
              {step.state === "done" ? <Check size={15} aria-hidden /> : <span className="nums">{index + 1}</span>}
            </span>
            <div className="min-w-0 pt-1 sm:mt-3 sm:px-1 sm:pt-0">
              <p
                className={cn(
                  "text-sm font-bold",
                  step.state === "upcoming" ? "text-ink-3" : "text-ink",
                )}
              >
                {isAr ? label.ar : label.en}
              </p>
              {step.state === "current" ? (
                <p className="mt-1 text-xs leading-5 text-ink-2 sm:hidden">
                  {isAr ? label.hintAr : label.hintEn}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
