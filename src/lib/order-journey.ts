import { normalizeOrderStatus } from "@/src/lib/order-status";

/**
 * The customer-facing purchase journey, derived from data that already
 * exists: the order status (state machine in order-status.ts) and whether a
 * payment proof has been uploaded. Nothing here is stored.
 *
 *   order status               proof   stage
 *   SUBMITTED/AWAITING_PAYMENT  no     PAYMENT_PENDING  (pay, then upload proof)
 *   SUBMITTED/AWAITING_PAYMENT  yes    UNDER_REVIEW     (staff check the transfer)
 *   PAID/FULFILLING             any    PAID             (confirmed, being activated)
 *   COMPLETED                   any    ACTIVATED
 *   CANCELLED/REJECTED          any    CANCELLED/REJECTED
 *
 * PACKAGE_SELECTED is the checkout moment before an order exists. "Proof
 * submitted" and "under review" are the same observable state, so there is
 * a single UNDER_REVIEW stage.
 */
export type OrderStage =
  | "PACKAGE_SELECTED"
  | "PAYMENT_PENDING"
  | "UNDER_REVIEW"
  | "PAID"
  | "ACTIVATED"
  | "CANCELLED"
  | "REJECTED";

export type JourneyStepKey = "SELECT" | "PAY" | "PROOF" | "REVIEW";
export type JourneyStepState = "done" | "current" | "upcoming";

export const JOURNEY_STEPS: { key: JourneyStepKey; ar: string; en: string }[] = [
  { key: "SELECT", ar: "اختيار الباقة", en: "Choose plan" },
  { key: "PAY", ar: "الدفع", en: "Payment" },
  { key: "PROOF", ar: "رفع إثبات الدفع", en: "Upload proof" },
  { key: "REVIEW", ar: "مراجعة وتفعيل", en: "Review & activation" },
];

export function orderStage(status: unknown, hasProof: boolean): OrderStage {
  switch (normalizeOrderStatus(status)) {
    case "COMPLETED":
      return "ACTIVATED";
    case "PAID":
    case "FULFILLING":
      return "PAID";
    case "CANCELLED":
      return "CANCELLED";
    case "REJECTED":
      return "REJECTED";
    default:
      return hasProof ? "UNDER_REVIEW" : "PAYMENT_PENDING";
  }
}

const CURRENT_INDEX: Record<OrderStage, number> = {
  PACKAGE_SELECTED: 0,
  PAYMENT_PENDING: 1,
  UNDER_REVIEW: 3,
  PAID: 3,
  ACTIVATED: 4, // past the last step: everything done
  CANCELLED: -1,
  REJECTED: -1,
};

export function journeySteps(stage: OrderStage) {
  const current = CURRENT_INDEX[stage];

  return JOURNEY_STEPS.map((step, index) => ({
    ...step,
    state: (current < 0
      ? index === 0
        ? "done"
        : "upcoming"
      : index < current
        ? "done"
        : index === current
          ? "current"
          : "upcoming") as JourneyStepState,
  }));
}

/** Whether the customer still has to pay (show transfer details and proof upload). */
export function needsPayment(stage: OrderStage) {
  return stage === "PAYMENT_PENDING";
}
