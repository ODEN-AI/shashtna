/**
 * Shashtna AI Business Analyst — pure parts (unit-tested).
 *
 * The analyst never sees raw tables and never computes: the server computes
 * a FACT PACK from the database, the model (or the rule-based fallback)
 * writes statements classified as FACT / OBSERVATION / INTERPRETATION /
 * RECOMMENDATION, and every number inside a FACT is checked against the
 * fact pack before the report is shown. Anything unverifiable is flagged.
 */

export type StatementKind = "FACT" | "OBSERVATION" | "INTERPRETATION" | "RECOMMENDATION";

export type Statement = { kind: StatementKind; text: string; verified?: boolean };

export type ReportSection = { key: "summary" | "financial" | "sales" | "customers" | "webapp" | "anomalies" | "observations"; title: string; statements: Statement[] };

export type AnalystReport = {
  headline: string;
  sections: ReportSection[];
  dataGaps: string[];
};

export type FactPack = {
  period: { key: string; label: string; from: string; to: string; comparison: string; timeZone: string };
  currency: "IQD";
  revenue: { current: number; previous: number; changePct: number | null; completedSales: number; previousCompletedSales: number };
  expenses: { recorded: boolean; current: number | null; previous: number | null; changePct: number | null };
  netProfit: { status: "ok" | "incomplete"; current: number | null; previous: number | null };
  averageOrderValue: { current: number | null; previous: number | null };
  products: { name: string; kind: string; units: number; revenue: number; sharePct: number; previousUnits: number }[];
  mostSold: { name: string; units: number; revenue: number; sharePct: number } | null;
  orders: { created: number; paidOrCompleted: number; awaitingPayment: number; inFulfilment: number; cancelled: number; rejected: number; conversionPct: number | null; previous: { created: number; paidOrCompleted: number; cancelled: number; conversionPct: number | null } };
  customers: { new: number; paying: number; returning: number; renewals: number; previousRenewals: number; activeSubscribersNow: number; expiringNow: number; revenuePerCustomer: number | null };
  paymentProofs: { awaitingReview: number; uploadedThisPeriod: number; uploadedPreviousPeriod: number };
  unavailable: string[];
};

const round = (value: number | null, digits = 1) => (value === null || !Number.isFinite(value) ? null : Number(value.toFixed(digits)));

/** Every number that appears in the fact pack, in the forms a report may cite it. */
export function factNumbers(facts: FactPack) {
  const values = new Set<number>();
  const visit = (value: unknown) => {
    if (typeof value === "number" && Number.isFinite(value)) {
      values.add(Math.round(value * 10) / 10);
      values.add(Math.round(value));
      values.add(Math.abs(Math.round(value * 10) / 10));
      values.add(Math.abs(Math.round(value)));
    } else if (Array.isArray(value)) {
      value.forEach(visit);
    } else if (value && typeof value === "object") {
      Object.values(value).forEach(visit);
    }
  };

  visit(facts);

  return values;
}

/** Western and Arabic-Indic digits, thousands separators and decimals. */
export function extractNumbers(text: string) {
  const normalized = text
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[٬،]/g, ",")
    .replace(/٫/g, ".");
  const matches = normalized.match(/\d[\d,]*(?:\.\d+)?/g) ?? [];

  return matches.map((match) => Number(match.replace(/,/g, ""))).filter((value) => Number.isFinite(value));
}

/**
 * A FACT is verified when every number in it exists in the fact pack
 * (rounded to 0 or 1 decimal). Years and small counters like "2" in "2
 * products" must also come from the facts — nothing is exempt.
 */
export function verifyStatement(statement: Statement, numbers: Set<number>): Statement {
  if (statement.kind !== "FACT") return { ...statement, verified: undefined };

  const cited = extractNumbers(statement.text);
  const verified = cited.every((value) => numbers.has(Math.round(value * 10) / 10) || numbers.has(Math.round(value)));

  return { ...statement, verified };
}

export function verifyReport(report: AnalystReport, facts: FactPack): AnalystReport {
  const numbers = factNumbers(facts);
  // Period boundaries are legitimate numbers to cite.
  for (const part of `${facts.period.from} ${facts.period.to}`.split(/[^0-9]+/)) if (part) numbers.add(Number(part));

  return { ...report, sections: report.sections.map((section) => ({ ...section, statements: section.statements.map((statement) => verifyStatement(statement, numbers)) })) };
}

function money(value: number, ar: boolean) {
  return `${new Intl.NumberFormat("en-US").format(Math.round(value))} ${ar ? "د.ع" : "IQD"}`;
}

function pct(value: number | null) {
  return value === null ? null : `${Math.abs(value).toFixed(1)}%`;
}

/**
 * The rule-based analyst: the same report shape, written from the fact pack
 * by fixed rules (used when no AI model is configured or the AI call fails).
 */
export function ruleBasedReport(facts: FactPack, lang: "ar" | "en"): AnalystReport {
  const ar = lang === "ar";
  const t = (a: string, e: string) => (ar ? a : e);
  const r = facts.revenue;
  const change = r.changePct;
  const sections: ReportSection[] = [];

  // Executive summary
  const summary: Statement[] = [
    {
      kind: "FACT",
      text: t(
        `الإيرادات ${money(r.current, ar)} من ${r.completedSales} عملية بيع مكتملة (${facts.period.label}).`,
        `Revenue was ${money(r.current, ar)} from ${r.completedSales} completed sales (${facts.period.label}).`,
      ),
    },
  ];
  if (change !== null) {
    summary.push({
      kind: "FACT",
      text: t(
        `${change >= 0 ? "ارتفعت" : "انخفضت"} الإيرادات ${pct(change)} ${facts.period.comparison} (${money(r.previous, ar)}).`,
        `Revenue ${change >= 0 ? "increased" : "decreased"} ${pct(change)} ${facts.period.comparison} (${money(r.previous, ar)}).`,
      ),
    });
  } else {
    summary.push({ kind: "FACT", text: t("لا توجد إيرادات بالفترة السابقة للمقارنة.", "There is no previous-period revenue to compare against.") });
  }
  sections.push({ key: "summary", title: t("الملخص التنفيذي", "Executive summary"), statements: summary });

  // Financial performance
  const financial: Statement[] = [];
  if (facts.expenses.recorded && facts.netProfit.status === "ok") {
    financial.push({ kind: "FACT", text: t(`المصاريف المسجلة ${money(facts.expenses.current ?? 0, ar)}، وصافي الربح ${money(facts.netProfit.current ?? 0, ar)}.`, `Recorded expenses were ${money(facts.expenses.current ?? 0, ar)} and net profit ${money(facts.netProfit.current ?? 0, ar)}.`) });
  } else {
    financial.push({ kind: "FACT", text: t("لم تُسجَّل مصاريف، لذلك لا يمكن حساب صافي الربح.", "No expenses are recorded, so net profit cannot be calculated.") });
  }
  if (facts.averageOrderValue.current !== null) {
    financial.push({ kind: "FACT", text: t(`متوسط قيمة البيع ${money(facts.averageOrderValue.current, ar)}.`, `The average sale value was ${money(facts.averageOrderValue.current, ar)}.`) });
  }
  sections.push({ key: "financial", title: t("الأداء المالي", "Financial performance"), statements: financial });

  // Sales
  const sales: Statement[] = [];
  if (facts.mostSold) {
    sales.push({ kind: "FACT", text: t(`الأكثر مبيعًا: ${facts.mostSold.name} بـ ${facts.mostSold.units} عملية شراء و${money(facts.mostSold.revenue, ar)}.`, `Most sold: ${facts.mostSold.name} with ${facts.mostSold.units} purchases and ${money(facts.mostSold.revenue, ar)}.`) });
  } else if (r.completedSales) {
    sales.push({ kind: "FACT", text: t("لا يوجد منتج متصدر واضح بعدد المبيعات بهذه الفترة.", "No single product clearly leads by units in this period.") });
  }
  const top = facts.products[0];
  if (top) {
    sales.push({ kind: "FACT", text: t(`«${top.name}» حقق ${pct(top.sharePct)} من الإيرادات.`, `“${top.name}” generated ${pct(top.sharePct)} of revenue.`) });
    if (top.sharePct >= 50 && r.completedSales >= 3) {
      sales.push({ kind: "OBSERVATION", text: t("الإيرادات مركّزة بمنتج واحد.", "Revenue is concentrated in one product.") });
      sales.push({ kind: "RECOMMENDATION", text: t("راقب أي تغيير بسعر أو توفر هذا المنتج لأنه يحمل أغلب الإيرادات.", "Watch this product's price and availability closely; it carries most of the revenue.") });
    }
  }
  if (!r.completedSales) {
    sales.push({ kind: "FACT", text: t("لا توجد مبيعات مكتملة بهذه الفترة.", "There were no completed sales in this period.") });
  }
  sections.push({ key: "sales", title: t("المبيعات", "Sales"), statements: sales });

  // Customers
  const c = facts.customers;
  const customers: Statement[] = [
    { kind: "FACT", text: t(`${c.new} عميل جديد سجّل، و${c.paying} عميل دفع، منهم ${c.returning} عائد.`, `${c.new} new customers registered and ${c.paying} paid, ${c.returning} of them returning.`) },
    { kind: "FACT", text: t(`التجديدات ${c.renewals} مقابل ${c.previousRenewals} بالفترة السابقة.`, `Renewals: ${c.renewals} vs ${c.previousRenewals} in the previous period.`) },
    { kind: "FACT", text: t(`المشتركون النشطون الآن ${c.activeSubscribersNow}، منهم ${c.expiringNow} ينتهي قريبًا.`, `Active subscribers now: ${c.activeSubscribersNow}, of which ${c.expiringNow} are expiring soon.`) },
  ];
  if (c.expiringNow > 0) {
    customers.push({ kind: "RECOMMENDATION", text: t("تابع الاشتراكات اللي تنتهي قريبًا من صفحة «التجديدات المستحقة».", "Follow up the expiring subscriptions from the Renewals due page.") });
  }
  sections.push({ key: "customers", title: t("العملاء", "Customers"), statements: customers });

  // Website / app
  sections.push({
    key: "webapp",
    title: t("الموقع والتطبيقات", "Website & apps"),
    statements: [{ kind: "FACT", text: t("تحليل الزيارات واستخدام التطبيقات غير متوفر لأن بيانات التحليلات غير مربوطة حاليًا.", "Traffic and app-usage analysis is unavailable because analytics data is not currently connected.") }],
  });

  // Anomalies
  const anomalies: Statement[] = [];
  const o = facts.orders;
  if (o.previous.cancelled > 0 && o.cancelled >= o.previous.cancelled * 2 && o.cancelled >= 3) {
    anomalies.push({ kind: "OBSERVATION", text: t(`الطلبات الملغاة ${o.cancelled} مقابل ${o.previous.cancelled} قبلها.`, `Cancelled orders: ${o.cancelled} vs ${o.previous.cancelled} before.`) });
  }
  if (facts.paymentProofs.uploadedThisPeriod > facts.paymentProofs.uploadedPreviousPeriod && facts.paymentProofs.awaitingReview > 0) {
    anomalies.push({ kind: "OBSERVATION", text: t(`${facts.paymentProofs.awaitingReview} إثبات دفع بانتظار المراجعة.`, `${facts.paymentProofs.awaitingReview} payment proofs are awaiting review.`) });
    anomalies.push({ kind: "RECOMMENDATION", text: t("راجع إثباتات الدفع المعلقة حتى تتحول لإيرادات.", "Review the pending payment proofs so they can become revenue.") });
  }
  if (change !== null && Math.abs(change) >= 30 && r.previous > 0) {
    anomalies.push({ kind: "OBSERVATION", text: t(`تغيّر الإيرادات كبير (${pct(change)}).`, `The revenue change is large (${pct(change)}).`) });
    anomalies.push({ kind: "INTERPRETATION", text: t("قد يرتبط بعدد قليل من الطلبات الكبيرة؛ البيانات المتوفرة لا تكفي لتحديد السبب.", "It may relate to a few large orders; the available data is not enough to determine the cause.") });
  }
  if (!anomalies.length) {
    anomalies.push({ kind: "OBSERVATION", text: t("لم تُرصد تغييرات غير اعتيادية بالبيانات المتوفرة.", "No unusual changes were detected in the available data.") });
  }
  sections.push({ key: "anomalies", title: t("تغييرات غير اعتيادية", "Anomalies"), statements: anomalies });

  // Observations
  const observations: Statement[] = [];
  if (o.conversionPct !== null) {
    observations.push({ kind: "FACT", text: t(`نسبة الطلبات المدفوعة من الطلبات المنشأة ${pct(o.conversionPct)}.`, `${pct(o.conversionPct)} of the orders created have been paid.`) });
  }
  if (!facts.expenses.recorded) {
    observations.push({ kind: "RECOMMENDATION", text: t("سجّل المصاريف (الاستضافة، الإعلانات، الاشتراكات…) حتى يصبح صافي الربح قابلًا للقياس.", "Record expenses (hosting, ads, subscriptions…) so net profit becomes measurable.") });
  }
  if (observations.length) sections.push({ key: "observations", title: t("ملاحظات الأعمال", "Business observations"), statements: observations });

  return {
    headline:
      change === null
        ? t(`الإيرادات ${money(r.current, ar)} — ${facts.period.label}`, `Revenue ${money(r.current, ar)} — ${facts.period.label}`)
        : t(`الإيرادات ${change >= 0 ? "↑" : "↓"} ${pct(change)} — ${money(r.current, ar)}`, `Revenue ${change >= 0 ? "↑" : "↓"} ${pct(change)} — ${money(r.current, ar)}`),
    sections,
    dataGaps: facts.unavailable,
  };
}

export { round };
