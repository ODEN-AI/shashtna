/**
 * Order state machine.
 *
 * Orders are stored in the existing `subscriptionRequest` table. Rows written
 * before the redesign use the legacy values PENDING / ACCEPTED / REJECTED,
 * which are mapped onto the new states when read.
 */

export const ORDER_STATUSES = [
  "SUBMITTED",
  "AWAITING_PAYMENT",
  "PAID",
  "FULFILLING",
  "COMPLETED",
  "CANCELLED",
  "REJECTED",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** The happy path, in order, used to draw the customer timeline. */
export const ORDER_FLOW: readonly OrderStatus[] = [
  "SUBMITTED",
  "AWAITING_PAYMENT",
  "PAID",
  "FULFILLING",
  "COMPLETED",
];

const LEGACY_STATUS: Record<string, OrderStatus> = {
  PENDING: "SUBMITTED",
  ACCEPTED: "COMPLETED",
};

export function normalizeOrderStatus(value: unknown): OrderStatus {
  const status = String(value ?? "")
    .trim()
    .toUpperCase();

  if ((ORDER_STATUSES as readonly string[]).includes(status)) {
    return status as OrderStatus;
  }

  return LEGACY_STATUS[status] ?? "SUBMITTED";
}

const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  SUBMITTED: ["AWAITING_PAYMENT", "PAID", "CANCELLED", "REJECTED"],
  AWAITING_PAYMENT: ["PAID", "SUBMITTED", "CANCELLED", "REJECTED"],
  PAID: ["FULFILLING", "COMPLETED", "CANCELLED"],
  FULFILLING: ["COMPLETED", "PAID", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
  REJECTED: [],
};

export function allowedTransitions(from: unknown): readonly OrderStatus[] {
  return TRANSITIONS[normalizeOrderStatus(from)];
}

export function canTransition(from: unknown, to: unknown) {
  const target = String(to ?? "").trim().toUpperCase();

  return allowedTransitions(from).includes(target as OrderStatus);
}

export function isTerminal(status: unknown) {
  return allowedTransitions(status).length === 0;
}

/** Not yet paid: the customer can still cancel, and a new checkout for the
 * same plan updates this order instead of creating a duplicate. */
export function isUnpaid(status: unknown) {
  const normalized = normalizeOrderStatus(status);
  return normalized === "SUBMITTED" || normalized === "AWAITING_PAYMENT";
}

/** Still waiting on the Shashtna team (any non-terminal state). */
export function isOpen(status: unknown) {
  return !isTerminal(status);
}

/** Stored values that count as "not yet paid", including the legacy one. */
export const UNPAID_STORED_STATUSES = ["SUBMITTED", "AWAITING_PAYMENT", "PENDING"];

/** Stored values that count as open, including the legacy one. */
export const OPEN_STORED_STATUSES = [
  "SUBMITTED",
  "AWAITING_PAYMENT",
  "PAID",
  "FULFILLING",
  "PENDING",
];

export function formatOrderNumber(id: number) {
  return `SH-${String(id).padStart(6, "0")}`;
}

export function parseOrderNumber(value: string) {
  const match = String(value ?? "")
    .trim()
    .toUpperCase()
    .match(/^(?:SH-)?0*(\d{1,9})$/);

  return match ? Number(match[1]) : null;
}

export type TimelineStep = {
  status: OrderStatus;
  state: "done" | "current" | "upcoming";
};

/** Timeline for display. Terminal failure states are shown separately. */
export function orderTimeline(status: unknown): TimelineStep[] {
  const normalized = normalizeOrderStatus(status);
  const index = ORDER_FLOW.indexOf(normalized);

  return ORDER_FLOW.map((step, stepIndex) => {
    if (index === -1) {
      return { status: step, state: stepIndex === 0 ? "done" : "upcoming" };
    }

    if (normalized === "COMPLETED") {
      return { status: step, state: "done" };
    }

    return {
      status: step,
      state:
        stepIndex < index ? "done" : stepIndex === index ? "current" : "upcoming",
    };
  });
}

export const ORDER_STATUS_LABELS: Record<
  OrderStatus,
  { ar: string; en: string; hintAr: string; hintEn: string }
> = {
  SUBMITTED: {
    ar: "تم الإرسال",
    en: "Submitted",
    hintAr: "استلمنا طلبك. فريقنا راح يتواصل وياك لترتيب الدفع.",
    hintEn: "We received your order. Our team will contact you to arrange payment.",
  },
  AWAITING_PAYMENT: {
    ar: "بانتظار الدفع",
    en: "Awaiting payment",
    hintAr: "بانتظار إتمام الدفع حسب الطريقة المتفق عليها مع فريقنا.",
    hintEn: "Waiting for payment using the method agreed with our team.",
  },
  PAID: {
    ar: "تم الدفع",
    en: "Paid",
    hintAr: "تم تأكيد الدفع. طلبك بالدور للتفعيل.",
    hintEn: "Payment confirmed. Your order is queued for activation.",
  },
  FULFILLING: {
    ar: "قيد التفعيل",
    en: "Activating",
    hintAr: "فريقنا يجهز اشتراكك الآن.",
    hintEn: "Our team is preparing your subscription now.",
  },
  COMPLETED: {
    ar: "مكتمل",
    en: "Completed",
    hintAr: "تم تنفيذ طلبك. تفاصيل الاشتراك موجودة بحسابك.",
    hintEn: "Your order is complete. Subscription details are in your account.",
  },
  CANCELLED: {
    ar: "ملغي",
    en: "Cancelled",
    hintAr: "تم إلغاء هذا الطلب.",
    hintEn: "This order was cancelled.",
  },
  REJECTED: {
    ar: "مرفوض",
    en: "Rejected",
    hintAr: "تعذر تنفيذ هذا الطلب. تواصل ويانا إذا تحتاج توضيح.",
    hintEn: "This order could not be completed. Contact us if you need details.",
  },
};

export const REQUEST_TYPE_LABELS: Record<string, { ar: string; en: string }> = {
  NEW: { ar: "اشتراك جديد", en: "New subscription" },
  RENEW: { ar: "تجديد", en: "Renewal" },
  UPGRADE: { ar: "ترقية", en: "Upgrade" },
  DEVICE_PURCHASE: { ar: "شراء جهاز", en: "Device purchase" },
};
