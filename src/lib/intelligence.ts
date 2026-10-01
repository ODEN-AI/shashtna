/**
 * Shashtna Intelligence — pure parts (unit-tested).
 *
 * The Intelligence console reads the existing engines (Finance for money,
 * the order state machine, subscription states, support and content
 * stores). This module holds the rules every page and the analyst share:
 *
 * - comparisons that never produce Infinity / NaN (no base → pct null);
 * - durations from real event timestamps (median, average, sample size,
 *   excluded orders), never from updatedAt;
 * - which role may see which section (checked before anything loads);
 * - the verified fact pack and the rule-based report written from it.
 *
 * ZERO and UNKNOWN stay distinct: a section that failed to load is not in
 * the pack and is listed as unavailable — it is never reported as 0.
 */

import type { Statement, StatementKind } from "@/src/lib/analyst";
import { hasPermission, type Permission } from "@/src/lib/roles";

// ------------------------------------------------------------------ numbers

export const round1 = (value: number) => Math.round(value * 10) / 10;

/** Current vs previous. pct is null when there is no base (previous = 0). */
export type Comparison = { current: number; previous: number; abs: number; pct: number | null };

export function compare(current: number, previous: number): Comparison {
  const safe = (value: number) => (Number.isFinite(value) ? value : 0);
  const now = safe(current);
  const before = safe(previous);
  const pct = before !== 0 ? round1(((now - before) / Math.abs(before)) * 100) : null;

  return { current: now, previous: before, abs: now - before, pct: pct !== null && Number.isFinite(pct) ? pct : null };
}

export function median(values: number[]) {
  const finite = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!finite.length) return null;
  const middle = Math.floor(finite.length / 2);

  return finite.length % 2 ? finite[middle] : (finite[middle - 1] + finite[middle]) / 2;
}

/** Sample of elapsed times in hours (median / average), plus what was left out. */
export type Duration = { count: number; excluded: number; medianHours: number | null; averageHours: number | null };

export function durationStats(milliseconds: number[], excluded = 0): Duration {
  const hours = milliseconds.filter((value) => Number.isFinite(value) && value >= 0).map((value) => value / 3_600_000);
  const mid = median(hours);

  return {
    count: hours.length,
    excluded,
    medianHours: mid === null ? null : round1(mid),
    averageHours: hours.length ? round1(hours.reduce((sum, value) => sum + value, 0) / hours.length) : null,
  };
}

const time = (value: string | null | undefined) => {
  const parsed = value ? Date.parse(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
};

/**
 * Order processing times from the order's own ActivityEvent timestamps:
 *
 * - created → paid: SubscriptionRequest.createdAt → the first ORDER_PAID /
 *   ORDER_FULFILLING / ORDER_COMPLETED event (the same "paid moment" the
 *   Finance engine uses to date a sale);
 * - paid → completed: that paid moment → the first ORDER_COMPLETED event.
 *
 * An order whose status says it got there but whose events are missing
 * (older orders, direct edits) is counted as excluded, never guessed.
 */
export const PAID_EVENT_ACTIONS = ["ORDER_PAID", "ORDER_FULFILLING", "ORDER_COMPLETED"] as const;

export function processingTimes(
  orders: { id: number; status: string; createdAt: string }[],
  events: { orderId: number; action: string; at: string }[],
) {
  const firstPaid = new Map<number, number>();
  const firstCompleted = new Map<number, number>();

  for (const event of events) {
    const at = time(event.at);
    if (at === null) continue;
    if ((PAID_EVENT_ACTIONS as readonly string[]).includes(event.action)) {
      const seen = firstPaid.get(event.orderId);
      if (seen === undefined || at < seen) firstPaid.set(event.orderId, at);
    }
    if (event.action === "ORDER_COMPLETED") {
      const seen = firstCompleted.get(event.orderId);
      if (seen === undefined || at < seen) firstCompleted.set(event.orderId, at);
    }
  }

  const toPaid: number[] = [];
  const toCompleted: number[] = [];
  let paidMissing = 0;
  let completedMissing = 0;

  for (const order of orders) {
    const status = String(order.status).toUpperCase();
    const reachedPaid = (["PAID", "FULFILLING", "COMPLETED"] as string[]).includes(status);
    const created = time(order.createdAt);
    const paid = firstPaid.get(order.id);

    if (paid !== undefined && created !== null && paid >= created) toPaid.push(paid - created);
    else if (reachedPaid) paidMissing += 1;

    if (status === "COMPLETED") {
      const completed = firstCompleted.get(order.id);
      if (paid !== undefined && completed !== undefined && completed >= paid) toCompleted.push(completed - paid);
      else completedMissing += 1;
    }
  }

  return { createdToPaid: durationStats(toPaid, paidMissing), paidToCompleted: durationStats(toCompleted, completedMissing) };
}

/**
 * Support first response: the ticket's first customer message → the first
 * team reply after it, from the stored message timestamps. Tickets still
 * waiting for a first reply are reported separately (excluded).
 */
export function firstResponseTimes(tickets: { messages: { sender: string; createdAt: string }[] }[]) {
  const samples: number[] = [];
  let waiting = 0;

  for (const ticket of tickets) {
    const ordered = [...ticket.messages].map((message) => ({ sender: message.sender, at: time(message.createdAt) })).filter((message) => message.at !== null) as { sender: string; at: number }[];
    ordered.sort((a, b) => a.at - b.at);
    const first = ordered.find((message) => message.sender === "CUSTOMER");
    if (!first) continue;
    const reply = ordered.find((message) => message.sender === "ADMIN" && message.at >= first.at);
    if (reply) samples.push(reply.at - first.at);
    else waiting += 1;
  }

  return durationStats(samples, waiting);
}

// ------------------------------------------------------------------ permissions

export const INTEL_SECTIONS = ["finance", "sales", "orders", "customers", "subscriptions", "support", "promotions"] as const;
export type IntelSection = (typeof INTEL_SECTIONS)[number];

/** Any one of these permissions opens the section. Money is only ever in "finance". */
export const SECTION_GATES: Record<IntelSection, Permission[]> = {
  finance: ["finance"],
  sales: ["insights", "catalogue", "finance"],
  orders: ["orders"],
  customers: ["customers"],
  subscriptions: ["subscriptions"],
  support: ["support"],
  promotions: ["content"],
};

export function canSection(role: string | null | undefined, section: IntelSection) {
  return SECTION_GATES[section].some((permission) => hasPermission(role, permission));
}

export function allowedSections(role: string | null | undefined) {
  return INTEL_SECTIONS.filter((section) => canSection(role, section));
}

/** The Intelligence pages: any section opens the overview. */
export const INTEL_PAGES = {
  overview: (role: string) => allowedSections(role).length > 0,
  revenue: (role: string) => hasPermission(role, "finance"),
  customers: (role: string) => hasPermission(role, "customers"),
  subscriptions: (role: string) => hasPermission(role, "subscriptions"),
  products: (role: string) => hasPermission(role, "insights") || hasPermission(role, "catalogue"),
  operations: (role: string) => hasPermission(role, "orders") || hasPermission(role, "support"),
  promotions: (role: string) => hasPermission(role, "content"),
  analyst: (role: string) => hasPermission(role, "insights") || hasPermission(role, "finance"),
} as const;

/** A stored report is readable only by someone who may see every section in it. */
export function canReadReport(role: string | null | undefined, sections: readonly string[]) {
  if (!INTEL_PAGES.analyst(String(role ?? ""))) return false;

  return sections.every((section) => (INTEL_SECTIONS as readonly string[]).includes(section) && canSection(role, section as IntelSection));
}

// ------------------------------------------------------------------ fact pack

export type IntelligencePack = {
  kind: "intelligence";
  period: { key: string; label: string; from: string; to: string; comparison: string; timeZone: string };
  currency: "IQD";
  sections: IntelSection[];
  finance?: {
    revenue: Comparison;
    completedSales: Comparison;
    averageOrderValue: { current: number | null; previous: number | null };
    expensesRecorded: boolean;
    expenses: Comparison | null;
    netProfit: { status: "ok" | "incomplete"; current: number | null; previous: number | null };
    topProducts: { name: string; revenue: number; sharePct: number }[];
  };
  sales?: {
    completedSales: Comparison;
    products: { name: string; kind: string; units: number; previousUnits: number }[];
    mostSold: { name: string; units: number } | null;
  };
  orders?: {
    created: Comparison;
    cancelled: Comparison;
    paidOfCreatedPct: number | null;
    awaitingPaymentNow: number;
    proofsAwaitingReviewNow: number;
    readyToActivateNow: number;
    createdToPaid: Duration;
    paidToCompleted: Duration;
  };
  customers?: { new: Comparison; paying: Comparison; returning: number; firstTime: number; total: number };
  subscriptions?: { expiringWindowDays: number; active: number; expiring: number; expired: number; suspended: number; dueForRenewal: number; renewals: Comparison; byPackage: { name: string; active: number }[] };
  support?: { created: Comparison; open: number; waitingOnTeam: number; firstResponse: Duration };
  promotions?: { endingSoonDays: number; live: number; scheduled: number; ended: number; inactive: number; endingSoon: number; notificationsSent: Comparison; notificationsRead: number };
  unavailable: string[];
};

export type IntelReportKey = "summary" | "numbers" | "changes" | "attention" | "recommendations" | "gaps";
export const INTEL_REPORT_KEYS: IntelReportKey[] = ["summary", "numbers", "changes", "attention", "recommendations", "gaps"];

export type IntelReport = { headline: string; sections: { key: IntelReportKey; title: string; statements: Statement[] }[]; dataGaps: string[] };

export function intelSectionTitle(key: IntelReportKey, lang: "ar" | "en") {
  const titles: Record<IntelReportKey, [string, string]> = {
    summary: ["ملخص تنفيذي", "Executive summary"],
    numbers: ["الأرقام المهمة", "Key numbers"],
    changes: ["ما الذي تغيّر؟", "What changed?"],
    attention: ["نقاط تحتاج انتباه", "Needs attention"],
    recommendations: ["توصيات", "Recommendations"],
    gaps: ["بيانات غير متوفرة", "Data not available"],
  };

  return titles[key][lang === "ar" ? 0 : 1];
}

/** Which statement kinds belong in which section. Anything else is moved, never relabelled. */
const SECTION_KINDS: Record<IntelReportKey, StatementKind[]> = {
  summary: ["FACT", "OBSERVATION"],
  numbers: ["FACT"],
  changes: ["FACT", "OBSERVATION"],
  attention: ["FACT", "OBSERVATION", "INTERPRETATION"],
  recommendations: ["RECOMMENDATION"],
  gaps: ["FACT", "OBSERVATION"],
};

const HOME: Record<StatementKind, IntelReportKey> = { FACT: "numbers", OBSERVATION: "changes", INTERPRETATION: "attention", RECOMMENDATION: "recommendations" };

/**
 * Fixed section order and titles; a statement in the wrong section keeps its
 * kind and moves to where that kind belongs, so a recommendation or an
 * interpretation can never sit among the facts.
 */
export function normalizeIntelReport(report: IntelReport, lang: "ar" | "en"): IntelReport {
  const buckets = new Map<IntelReportKey, Statement[]>(INTEL_REPORT_KEYS.map((key) => [key, []]));

  for (const section of report.sections) {
    for (const statement of section.statements) {
      const key = SECTION_KINDS[section.key]?.includes(statement.kind) ? section.key : HOME[statement.kind];
      buckets.get(key)!.push(statement);
    }
  }

  return {
    headline: report.headline,
    dataGaps: report.dataGaps,
    sections: INTEL_REPORT_KEYS.filter((key) => buckets.get(key)!.length).map((key) => ({ key, title: intelSectionTitle(key, lang), statements: buckets.get(key)! })),
  };
}

// ------------------------------------------------------------------ rule-based report

const fmt = (value: number) => new Intl.NumberFormat("en-US").format(Math.round(value));
const pctText = (value: number) => `${Math.abs(value).toFixed(1)}%`;

function money(value: number, ar: boolean) {
  return `${fmt(value)} ${ar ? "د.ع" : "IQD"}`;
}

/** One comparison sentence; with no base it says so instead of inventing a change. */
function changeText(label: { ar: string; en: string }, value: Comparison, ar: boolean, format: (n: number) => string = fmt) {
  if (value.pct === null) {
    if (value.current === 0 && value.previous === 0) {
      return ar ? `${label.ar}: لا يوجد نشاط بالفترتين.` : `${label.en}: no activity in either period.`;
    }

    return ar
      ? `${label.ar}: ${format(value.current)} مقابل ${format(value.previous)} — لا تتوفر مقارنة نسبية لأن الفترة السابقة صفر.`
      : `${label.en}: ${format(value.current)} vs ${format(value.previous)} — no percentage comparison, the previous period is zero.`;
  }

  const direction = value.pct > 0 ? (ar ? "ارتفاع" : "up") : value.pct < 0 ? (ar ? "انخفاض" : "down") : ar ? "بدون تغيير" : "unchanged";

  return ar
    ? `${label.ar}: ${format(value.current)} مقابل ${format(value.previous)} (${direction} ${pctText(value.pct)}).`
    : `${label.en}: ${format(value.current)} vs ${format(value.previous)} (${direction} ${pctText(value.pct)}).`;
}

function durationText(label: { ar: string; en: string }, value: Duration, ar: boolean, unit: { ar: string; en: string } = { ar: "طلب", en: "orders" }) {
  if (!value.count || value.medianHours === null || value.averageHours === null) {
    return ar ? `${label.ar}: لا توجد عينة كافية بهذه الفترة.` : `${label.en}: no sample in this period.`;
  }

  return ar
    ? `${label.ar}: الوسيط ${value.medianHours.toFixed(1)} ساعة والمتوسط ${value.averageHours.toFixed(1)} ساعة (عينة: ${value.count} ${unit.ar}).`
    : `${label.en}: median ${value.medianHours.toFixed(1)} h, average ${value.averageHours.toFixed(1)} h (sample: ${value.count} ${unit.en}).`;
}

/** The factual pulse: the "what changed" statements, no causes. */
export function businessPulse(pack: IntelligencePack, lang: "ar" | "en"): Statement[] {
  const ar = lang === "ar";
  const out: Statement[] = [];
  const fact = (text: string) => out.push({ kind: "FACT", text });

  if (pack.finance) fact(changeText({ ar: "الإيرادات", en: "Revenue" }, pack.finance.revenue, ar, (n) => money(n, ar)));
  if (pack.sales) fact(changeText({ ar: "المبيعات المكتملة", en: "Completed sales" }, pack.sales.completedSales, ar));
  if (pack.orders) {
    fact(changeText({ ar: "الطلبات الجديدة", en: "New orders" }, pack.orders.created, ar));
    fact(changeText({ ar: "الطلبات الملغاة (من طلبات الفترة)", en: "Cancelled orders (of the period's orders)" }, pack.orders.cancelled, ar));
  }
  if (pack.customers) {
    fact(changeText({ ar: "العملاء الجدد", en: "New customers" }, pack.customers.new, ar));
    fact(changeText({ ar: "العملاء الدافعون", en: "Paying customers" }, pack.customers.paying, ar));
  }
  if (pack.subscriptions) fact(changeText({ ar: "التجديدات", en: "Renewals" }, pack.subscriptions.renewals, ar));
  if (pack.support) fact(changeText({ ar: "تذاكر الدعم الجديدة", en: "New support tickets" }, pack.support.created, ar));
  if (pack.promotions) fact(changeText({ ar: "الإشعارات المرسلة", en: "Notifications sent" }, pack.promotions.notificationsSent, ar));

  return out;
}

export function ruleBasedIntelligenceReport(pack: IntelligencePack, lang: "ar" | "en"): IntelReport {
  const ar = lang === "ar";
  const t = (a: string, e: string) => (ar ? a : e);
  const summary: Statement[] = [];
  const numbers: Statement[] = [];
  const attention: Statement[] = [];
  const recommendations: Statement[] = [];
  const fact = (list: Statement[], text: string) => list.push({ kind: "FACT", text });

  const f = pack.finance;
  const s = pack.sales;
  const o = pack.orders;
  const c = pack.customers;
  const sub = pack.subscriptions;
  const sup = pack.support;
  const p = pack.promotions;

  // Summary: the most important verified figures this role may see.
  if (f) fact(summary, t(`الإيرادات ${money(f.revenue.current, ar)} من ${f.completedSales.current} عملية بيع مكتملة (${pack.period.label}).`, `Revenue was ${money(f.revenue.current, ar)} from ${f.completedSales.current} completed sales (${pack.period.label}).`));
  else if (s) fact(summary, t(`${s.completedSales.current} عملية بيع مكتملة (${pack.period.label}).`, `${s.completedSales.current} completed sales (${pack.period.label}).`));
  if (o) fact(summary, t(`${o.created.current} طلب جديد، و${o.awaitingPaymentNow} طلب بانتظار الدفع الآن.`, `${o.created.current} new orders; ${o.awaitingPaymentNow} awaiting payment now.`));
  if (c) fact(summary, t(`${c.new.current} عميل جديد و${c.paying.current} عميل دفع بهذه الفترة.`, `${c.new.current} new customers and ${c.paying.current} paying customers in this period.`));
  if (sub && summary.length < 3) fact(summary, t(`${sub.active} اشتراك فعّال الآن، منها ${sub.expiring} ينتهي خلال ${sub.expiringWindowDays} أيام.`, `${sub.active} active subscriptions now, ${sub.expiring} of them ending within ${sub.expiringWindowDays} days.`));
  if (sup && summary.length < 3) fact(summary, t(`${sup.waitingOnTeam} تذكرة دعم بانتظار رد الفريق.`, `${sup.waitingOnTeam} support tickets are waiting on the team.`));
  if (p && summary.length < 3) fact(summary, t(`${p.live} محتوى منشور الآن و${p.scheduled} مجدول.`, `${p.live} content items live now and ${p.scheduled} scheduled.`));

  // Key numbers
  if (f) {
    if (f.averageOrderValue.current !== null) fact(numbers, t(`متوسط قيمة البيع ${money(f.averageOrderValue.current, ar)}.`, `Average sale value: ${money(f.averageOrderValue.current, ar)}.`));
    if (f.expensesRecorded && f.netProfit.status === "ok" && f.expenses && f.netProfit.current !== null) {
      fact(numbers, t(`المصاريف ${money(f.expenses.current, ar)} وصافي الربح ${money(f.netProfit.current, ar)}.`, `Expenses ${money(f.expenses.current, ar)}; net profit ${money(f.netProfit.current, ar)}.`));
    } else {
      fact(numbers, t("لم تُسجَّل مصاريف، لذلك صافي الربح غير قابل للحساب.", "No expenses are recorded, so net profit cannot be calculated."));
    }
    const top = f.topProducts[0];
    if (top) fact(numbers, t(`«${top.name}» حقق ${pctText(top.sharePct)} من الإيرادات.`, `“${top.name}” generated ${pctText(top.sharePct)} of revenue.`));
  }
  if (s?.mostSold) fact(numbers, t(`الأكثر مبيعًا: «${s.mostSold.name}» بـ ${s.mostSold.units} عملية شراء.`, `Most sold: “${s.mostSold.name}” with ${s.mostSold.units} purchases.`));
  if (o) {
    if (o.paidOfCreatedPct !== null) fact(numbers, t(`${pctText(o.paidOfCreatedPct)} من طلبات الفترة دُفعت.`, `${pctText(o.paidOfCreatedPct)} of the period's orders have been paid.`));
    fact(numbers, durationText({ ar: "من إنشاء الطلب إلى الدفع", en: "Order created → paid" }, o.createdToPaid, ar));
    fact(numbers, durationText({ ar: "من الدفع إلى الإكمال", en: "Paid → completed" }, o.paidToCompleted, ar));
  }
  if (c) fact(numbers, t(`من العملاء الدافعين: ${c.returning} عائد و${c.firstTime} لأول مرة.`, `Of the paying customers: ${c.returning} returning, ${c.firstTime} first-time.`));
  if (sub) fact(numbers, t(`${sub.dueForRenewal} اشتراك ضمن نافذة التجديد، و${sub.expired} منتهي.`, `${sub.dueForRenewal} subscriptions are in the renewal window; ${sub.expired} have expired.`));
  if (sup) fact(numbers, durationText({ ar: "أول رد على تذاكر الدعم", en: "Support first response" }, sup.firstResponse, ar, { ar: "تذكرة", en: "tickets" }));
  if (p) fact(numbers, t(`${p.notificationsRead} من الإشعارات المرسلة بهذه الفترة قُرئت.`, `${p.notificationsRead} of the notifications sent in this period were read.`));

  // Needs attention (observations; at most a hedged interpretation)
  if (o && o.proofsAwaitingReviewNow > 0) attention.push({ kind: "OBSERVATION", text: t(`${o.proofsAwaitingReviewNow} إثبات دفع بانتظار المراجعة.`, `${o.proofsAwaitingReviewNow} payment proofs are awaiting review.`) });
  if (o && o.readyToActivateNow > 0) attention.push({ kind: "OBSERVATION", text: t(`${o.readyToActivateNow} طلب مدفوع بانتظار التفعيل.`, `${o.readyToActivateNow} paid orders are waiting to be activated.`) });
  if (o && o.createdToPaid.excluded + o.paidToCompleted.excluded > 0) {
    attention.push({ kind: "OBSERVATION", text: t(`${o.createdToPaid.excluded + o.paidToCompleted.excluded} طلب بدون سجل أحداث كامل، لذلك استُثني من أوقات المعالجة.`, `${o.createdToPaid.excluded + o.paidToCompleted.excluded} orders lack a complete event history and are excluded from processing times.`) });
  }
  if (sub && sub.expiring > 0) attention.push({ kind: "OBSERVATION", text: t(`${sub.expiring} اشتراك ينتهي خلال ${sub.expiringWindowDays} أيام.`, `${sub.expiring} subscriptions end within ${sub.expiringWindowDays} days.`) });
  if (sup && sup.waitingOnTeam > 0) attention.push({ kind: "OBSERVATION", text: t(`${sup.waitingOnTeam} تذكرة آخر رسالة فيها من العميل.`, `${sup.waitingOnTeam} tickets have a customer message as the last one.`) });
  if (p && p.endingSoon > 0) attention.push({ kind: "OBSERVATION", text: t(`${p.endingSoon} محتوى منشور ينتهي خلال ${p.endingSoonDays} أيام.`, `${p.endingSoon} live content items end within ${p.endingSoonDays} days.`) });
  if (f && f.revenue.pct !== null && Math.abs(f.revenue.pct) >= 30 && f.completedSales.current < 10) {
    attention.push({ kind: "INTERPRETATION", text: t("التغيّر الكبير بالإيرادات قد يعود لعدد قليل من الطلبات؛ العينة صغيرة والبيانات لا تكفي لتحديد السبب.", "The large revenue change may come from a few orders; the sample is small and the data cannot show the cause.") });
  }

  // Recommendations (concrete, small-team steps tied to what was observed)
  if (o && o.proofsAwaitingReviewNow > 0) recommendations.push({ kind: "RECOMMENDATION", text: t("راجع إثباتات الدفع المعلقة من مركز العمليات.", "Review the pending payment proofs from the Operations Center.") });
  if (o && o.readyToActivateNow > 0) recommendations.push({ kind: "RECOMMENDATION", text: t("فعّل الطلبات المدفوعة المنتظرة.", "Activate the paid orders that are waiting.") });
  if (sub && sub.expiring > 0) recommendations.push({ kind: "RECOMMENDATION", text: t("تواصل مع أصحاب الاشتراكات اللي تنتهي قريبًا من قائمة التجديدات.", "Contact the subscribers whose plans end soon from the renewals list.") });
  if (sup && sup.waitingOnTeam > 0) recommendations.push({ kind: "RECOMMENDATION", text: t("رد على التذاكر المنتظرة.", "Reply to the waiting tickets.") });
  if (f && !f.expensesRecorded) recommendations.push({ kind: "RECOMMENDATION", text: t("سجّل المصاريف حتى يصبح صافي الربح قابلًا للقياس.", "Record expenses so net profit becomes measurable.") });

  const changes = businessPulse(pack, lang);
  const gaps: Statement[] = pack.unavailable.map((text) => ({ kind: "FACT", text }));

  const headline = f
    ? f.revenue.pct === null
      ? t(`الإيرادات ${money(f.revenue.current, ar)} — ${pack.period.label}`, `Revenue ${money(f.revenue.current, ar)} — ${pack.period.label}`)
      : t(`الإيرادات ${f.revenue.pct >= 0 ? "↑" : "↓"} ${pctText(f.revenue.pct)} — ${money(f.revenue.current, ar)}`, `Revenue ${f.revenue.pct >= 0 ? "↑" : "↓"} ${pctText(f.revenue.pct)} — ${money(f.revenue.current, ar)}`)
    : o
      ? t(`${o.created.current} طلب جديد — ${pack.period.label}`, `${o.created.current} new orders — ${pack.period.label}`)
      : t(`ملخص ${pack.period.label}`, `Summary — ${pack.period.label}`);

  return normalizeIntelReport(
    {
      headline,
      dataGaps: pack.unavailable,
      sections: [
        { key: "summary", title: "", statements: summary },
        { key: "numbers", title: "", statements: numbers },
        { key: "changes", title: "", statements: changes },
        { key: "attention", title: "", statements: attention.length ? attention : [{ kind: "OBSERVATION", text: t("لا توجد نقاط معلقة بالبيانات المتوفرة.", "Nothing pending in the available data.") }] },
        { key: "recommendations", title: "", statements: recommendations },
        { key: "gaps", title: "", statements: gaps },
      ],
    },
    lang,
  );
}

// ------------------------------------------------------------------ data gaps

/** Metrics deliberately not computed, with the reason (shown, never estimated). */
export function structuralGaps(sections: IntelSection[], lang: "ar" | "en") {
  const ar = lang === "ar";
  const gaps = [
    ar ? "زيارات الموقع واستخدام التطبيقات غير مُجمَّعة." : "Website visits and app usage are not collected.",
    ar ? "قناة الطلب (موقع أو تطبيق) غير مسجلة على الطلبات." : "Order channel (website vs app) is not recorded on orders.",
  ];

  if (sections.includes("customers")) {
    gaps.push(ar ? "قيمة العميل مدى الحياة ونسبة الفقد والاحتفاظ والمجموعات غير محسوبة: لا توجد بيانات دورة حياة موثوقة." : "Customer lifetime value, churn, retention and cohorts are not calculated: there is no reliable lifecycle data.");
  }
  if (sections.includes("subscriptions")) {
    gaps.push(ar ? "نسبة التجديد غير متاحة: التجديد يحدّث تاريخ الانتهاء نفسه، فلا يُعرف تاريخ الاستحقاق الأصلي." : "Renewal rate is unavailable: a renewal overwrites the expiry date, so the original due date is not kept.");
  }
  if (sections.includes("promotions")) {
    gaps.push(ar ? "العائد والنقرات والتحويل للعروض غير متاحة: لا تُسجَّل مشاهدات أو نقرات أو نسبة للطلبات." : "Promotion ROI, clicks and conversion are unavailable: impressions, clicks and order attribution are not recorded.");
  }

  return gaps;
}
