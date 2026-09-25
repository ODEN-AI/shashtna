import { Check } from "lucide-react";

import type { Lang } from "@/src/lib/i18n";
import { journeySteps, type JourneyStepKey, type OrderStage } from "@/src/lib/order-journey";

import { cn } from "./cn";

type Note = { ar: string; en: string };

/** One line under each step describing where it stands for this order. */
function stepNote(key: JourneyStepKey, stage: OrderStage): Note {
  switch (key) {
    case "SELECT":
      return { ar: "مكتمل", en: "Done" };
    case "PAY":
      return stage === "PAYMENT_PENDING"
        ? { ar: "حوّل المبلغ الآن", en: "Transfer the amount now" }
        : stage === "PACKAGE_SELECTED"
          ? { ar: "بعد تأكيد الطلب", en: "After you confirm" }
          : { ar: "تم", en: "Done" };
    case "PROOF":
      return stage === "PAYMENT_PENDING" || stage === "PACKAGE_SELECTED"
        ? { ar: "بانتظار رفع الإثبات", en: "Waiting for the proof" }
        : { ar: "تم رفع الإثبات", en: "Proof uploaded" };
    case "REVIEW":
      return stage === "UNDER_REVIEW"
        ? { ar: "قيد المراجعة", en: "Under review" }
        : stage === "PAID"
          ? { ar: "تم تأكيد الدفع — قيد التفعيل", en: "Payment confirmed — activating" }
          : stage === "ACTIVATED"
            ? { ar: "تم التفعيل", en: "Activated" }
            : { ar: "بعد رفع الإثبات", en: "After the proof" };
  }
}

/**
 * The four-step purchase journey (choose → pay → upload proof → review &
 * activation). Vertical on phones, horizontal from `sm` up.
 */
export function OrderJourney({ stage, lang, className }: { stage: OrderStage; lang: Lang; className?: string }) {
  const steps = journeySteps(stage);

  return (
    <ol className={cn("grid gap-0 sm:grid-cols-4 sm:gap-2", className)} data-testid="order-journey" data-stage={stage}>
      {steps.map((step, index) => {
        const note = stepNote(step.key, stage);
        const last = index === steps.length - 1;

        return (
          <li
            key={step.key}
            data-step={step.key}
            data-state={step.state}
            aria-current={step.state === "current" ? "step" : undefined}
            className="relative flex gap-3 pb-5 last:pb-0 sm:flex-col sm:items-center sm:gap-2 sm:pb-0 sm:text-center"
          >
            {!last ? (
              <span
                aria-hidden
                className={cn(
                  "absolute start-[15px] top-8 bottom-0 w-0.5 sm:top-[15px] sm:bottom-auto sm:h-0.5 sm:w-auto sm:[inset-inline-start:calc(50%+20px)] sm:[inset-inline-end:calc(-50%+20px)]",
                  step.state === "done" ? "bg-brand" : "bg-line-strong",
                )}
              />
            ) : null}
            <span
              className={cn(
                "nums relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                step.state === "done" && "bg-brand text-white",
                step.state === "current" && "bg-canvas text-glow ring-2 ring-glow shadow-[0_0_0_6px_rgba(34,211,238,0.12)]",
                step.state === "upcoming" && "border border-line-strong bg-surface-2 text-ink-3",
              )}
            >
              {step.state === "done" ? <Check size={16} aria-hidden /> : index + 1}
            </span>
            <span className="min-w-0 pt-1 sm:pt-0">
              <span
                className={cn(
                  "block text-sm font-bold",
                  step.state === "upcoming" ? "text-ink-3" : "text-ink",
                )}
              >
                {lang === "ar" ? step.ar : step.en}
              </span>
              <span
                className={cn(
                  "mt-0.5 block text-xs",
                  step.state === "current" ? "font-semibold text-glow" : step.state === "done" ? "text-success" : "text-ink-3",
                )}
              >
                {lang === "ar" ? note.ar : note.en}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
