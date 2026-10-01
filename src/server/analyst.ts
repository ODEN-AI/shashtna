import Anthropic from "@anthropic-ai/sdk";

import { BUSINESS_TIME_ZONE } from "@/src/lib/business-time";
import { ruleBasedReport, round, verifyReport, type AnalystReport, type FactPack, type ReportSection, type StatementKind } from "@/src/lib/analyst";
import type { Lang } from "@/src/lib/i18n";
import { db } from "@/src/prisma/db";
import { logActivity } from "@/src/server/activity";
import { getFinanceSnapshot, type FinanceSnapshot, type PeriodSelection } from "@/src/server/finance";

/**
 * Shashtna AI Business Analyst — server side.
 *
 * 1. The finance engine computes a FACT PACK (aggregates only: no names,
 *    phones, receipts or payment proofs ever leave the server).
 * 2. Claude writes the report from that pack alone, with a fixed JSON
 *    schema and every statement classified FACT / OBSERVATION /
 *    INTERPRETATION / RECOMMENDATION. Without ANTHROPIC_API_KEY, or if the
 *    call fails, the deterministic rule-based analyst writes it instead.
 * 3. Every number in a FACT is verified against the pack before display.
 * 4. Reports are stored (BusinessReport) with the facts they were based on.
 */

export const ANALYST_MODEL = "claude-opus-5-5";

const PERIOD_LABELS: Record<string, { ar: string; en: string }> = {
  today: { ar: "اليوم", en: "today" },
  week: { ar: "هذا الأسبوع", en: "this week" },
  month: { ar: "هذا الشهر", en: "this month" },
  year: { ar: "هذه السنة", en: "this year" },
  custom: { ar: "فترة مخصصة", en: "custom range" },
};

const COMPARISON_LABELS: Record<string, { ar: string; en: string }> = {
  today: { ar: "مقارنة بنفس الوقت أمس", en: "vs the same time yesterday" },
  week: { ar: "مقارنة بنفس النقطة من الأسبوع الماضي", en: "vs the same point last week" },
  month: { ar: "مقارنة بنفس النقطة من الشهر الماضي", en: "vs the same point last month" },
  year: { ar: "مقارنة بنفس النقطة من السنة الماضية", en: "vs the same point last year" },
  custom: { ar: "مقارنة بفترة سابقة بنفس الطول", en: "vs the previous period of the same length" },
};

const GAP_TEXT: Record<string, { ar: string; en: string }> = {
  TRAFFIC: { ar: "زيارات الموقع ومصادرها غير مُجمَّعة.", en: "Website visits and traffic sources are not collected." },
  APP_USAGE: { ar: "استخدام التطبيقات وتنزيلاتها غير مُجمَّع.", en: "App usage and downloads are not collected." },
  SALES_CHANNEL: { ar: "قناة الطلب (موقع أو تطبيق) غير مسجلة على الطلبات.", en: "Order channel (website vs app) is not recorded on orders." },
  EXPENSES: { ar: "لم تُسجَّل أي مصاريف بعد.", en: "No expenses have been recorded yet." },
};

/** The aggregates the analyst may see — nothing else. */
export function buildFactPack(snapshot: FinanceSnapshot, lang: Lang): FactPack {
  const ar = lang === "ar";
  const key = snapshot.selection.period;
  const previousUnits = new Map(snapshot.productsPrevious.map((row) => [row.product, row.units]));

  return {
    period: {
      key,
      label: ar ? PERIOD_LABELS[key].ar : PERIOD_LABELS[key].en,
      from: snapshot.range.current.from,
      to: snapshot.range.current.to,
      comparison: ar ? COMPARISON_LABELS[key].ar : COMPARISON_LABELS[key].en,
      timeZone: BUSINESS_TIME_ZONE,
    },
    currency: "IQD",
    revenue: {
      current: snapshot.revenue.amount,
      previous: snapshot.revenue.previous,
      changePct: round(snapshot.revenue.change),
      completedSales: snapshot.revenue.sales,
      previousCompletedSales: snapshot.revenue.previousSales,
    },
    expenses: {
      recorded: snapshot.expenses.recorded,
      current: snapshot.expenses.recorded ? snapshot.expenses.amount : null,
      previous: snapshot.expenses.recorded ? snapshot.expenses.previous : null,
      changePct: round(snapshot.expenses.change),
    },
    netProfit: {
      status: snapshot.profit.status,
      current: snapshot.profit.status === "ok" ? snapshot.profit.amount : null,
      previous: snapshot.profitPrevious.status === "ok" ? snapshot.profitPrevious.amount : null,
    },
    averageOrderValue: { current: round(snapshot.orders.averageOrderValue, 0), previous: round(snapshot.orders.previousAverageOrderValue, 0) },
    products: snapshot.products.slice(0, 8).map((row) => ({
      name: row.name,
      kind: row.kind,
      units: row.units,
      revenue: row.revenue,
      sharePct: round(row.share) ?? 0,
      previousUnits: previousUnits.get(row.product) ?? 0,
    })),
    mostSold: snapshot.mostSold ? { name: snapshot.mostSold.name, units: snapshot.mostSold.units, revenue: snapshot.mostSold.revenue, sharePct: round(snapshot.mostSold.share) ?? 0 } : null,
    orders: {
      created: snapshot.orders.created,
      paidOrCompleted: snapshot.orders.completed,
      awaitingPayment: snapshot.orders.pending,
      inFulfilment: snapshot.orders.inProgress,
      cancelled: snapshot.orders.cancelled,
      rejected: snapshot.orders.rejected,
      conversionPct: round(snapshot.orders.conversion),
      previous: {
        created: snapshot.orders.previous.created,
        paidOrCompleted: snapshot.orders.previous.completed,
        cancelled: snapshot.orders.previous.cancelled,
        conversionPct: round(snapshot.orders.previous.conversion),
      },
    },
    customers: {
      new: snapshot.customers.newCustomers,
      paying: snapshot.customers.payingCustomers,
      returning: snapshot.customers.returningCustomers,
      renewals: snapshot.customers.renewals,
      previousRenewals: snapshot.customers.previous.renewals,
      activeSubscribersNow: snapshot.customers.activeSubscribers,
      expiringNow: snapshot.customers.expiringSubscriptions,
      revenuePerCustomer: round(snapshot.customers.revenuePerCustomer, 0),
    },
    paymentProofs: {
      awaitingReview: snapshot.proofs.awaitingReview,
      uploadedThisPeriod: snapshot.proofs.uploadedCurrent,
      uploadedPreviousPeriod: snapshot.proofs.uploadedPrevious,
    },
    unavailable: snapshot.dataGaps.map((gap) => (ar ? GAP_TEXT[gap].ar : GAP_TEXT[gap].en)),
  };
}

const SECTION_KEYS: ReportSection["key"][] = ["summary", "financial", "sales", "customers", "webapp", "anomalies", "observations"];
const KINDS: StatementKind[] = ["FACT", "OBSERVATION", "INTERPRETATION", "RECOMMENDATION"];

const REPORT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["headline", "sections"],
  properties: {
    headline: { type: "string" },
    sections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["key", "title", "statements"],
        properties: {
          key: { type: "string", enum: SECTION_KEYS },
          title: { type: "string" },
          statements: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["kind", "text"],
              properties: { kind: { type: "string", enum: KINDS }, text: { type: "string" } },
            },
          },
        },
      },
    },
  },
} as const;

function systemPrompt(lang: Lang) {
  return `You are the business analyst for Shashtna, an Iraqi IPTV subscription and streaming-device store. You write a periodic report for the owner from a FACT PACK the server computed from the database. You see aggregates only.

How to write it:
- Use only the facts in the pack. If something is not in the pack, it is unknown: say so plainly rather than estimating, and never invent visitors, traffic, conversion funnels, costs, profit, causes or market data.
- Classify every statement:
  FACT — directly stated by the pack. Every number you write in a FACT must appear in the pack (amounts in IQD as whole numbers, percentages to one decimal, as given).
  OBSERVATION — a pattern visible across facts (e.g. concentration, a change in mix).
  INTERPRETATION — a possible explanation. Phrase it as possible, not certain.
  RECOMMENDATION — a concrete, realistic next step for a small team.
- Revenue is not profit. When netProfit.status is "incomplete", state that net profit cannot be calculated because expenses are not recorded; do not give a profit figure.
- Compare with the previous period using the pack's comparison wording. When a previous value is 0 or changePct is null, say there is no base to compare with.
- Small numbers are small: with only a few sales, avoid strong conclusions and say the sample is small.
- Sections, in this order, using these keys: summary (Executive summary, 2–4 statements), financial, sales, customers, webapp (Website & apps — only what the pack supports; the unavailable list explains what is not collected), anomalies (say none were detected if none are), observations (business observations and recommendations).
- Tone: a serious, concise analyst. No hype, no emoji, no marketing language.
- Write all text in ${lang === "ar" ? "Arabic (clear Modern Standard Arabic, Western digits for numbers)" : "English"}. Currency: ${lang === "ar" ? "د.ع" : "IQD"}.
- headline: one line, the single most important fact of the period.`;
}

function parseModelReport(raw: unknown, facts: FactPack): AnalystReport | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as { headline?: unknown; sections?: unknown };
  if (typeof value.headline !== "string" || !Array.isArray(value.sections)) return null;

  const sections: ReportSection[] = [];
  for (const section of value.sections as { key?: unknown; title?: unknown; statements?: unknown }[]) {
    const key = SECTION_KEYS.find((item) => item === section?.key);
    if (!key || typeof section.title !== "string" || !Array.isArray(section.statements)) continue;
    const statements = (section.statements as { kind?: unknown; text?: unknown }[])
      .filter((item) => KINDS.includes(item?.kind as StatementKind) && typeof item.text === "string" && item.text.trim())
      .map((item) => ({ kind: item.kind as StatementKind, text: String(item.text).trim().slice(0, 600) }));
    if (statements.length) sections.push({ key, title: section.title.slice(0, 80), statements });
  }

  return sections.length ? { headline: value.headline.slice(0, 200), sections, dataGaps: facts.unavailable } : null;
}

/** Ask Claude for the report. Returns null when AI is not configured or the call fails. */
async function aiReport(facts: FactPack, lang: Lang): Promise<{ report: AnalystReport; model: string } | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  try {
    // Keep well inside the hosting function's time limit; on timeout the
    // rule-based analyst answers instead.
    const client = new Anthropic({ timeout: 25_000, maxRetries: 0 });
    const response = await client.beta.messages.create({
      model: ANALYST_MODEL,
      max_tokens: 8000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort: "medium", format: { type: "json_schema", schema: REPORT_SCHEMA as unknown as Record<string, unknown> } },
      system: systemPrompt(lang),
      messages: [{ role: "user", content: `FACT PACK (JSON):\n${JSON.stringify(facts)}` }],
    });

    if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens") return null;

    const text = response.content.flatMap((block) => (block.type === "text" ? [block.text] : [])).join("");
    const report = parseModelReport(JSON.parse(text), facts);

    return report ? { report, model: response.model } : null;
  } catch (error) {
    console.error("ANALYST_AI_ERROR:", error instanceof Error ? error.message : error);
    return null;
  }
}

export function aiConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export type StoredReport = {
  id: number;
  period: string;
  from: string;
  to: string;
  generator: string;
  lang: Lang;
  createdAt: string;
  report: AnalystReport;
  facts: FactPack;
};

type ReportRow = { id: number; period: string; generator: string; facts: string; content: string; createdAt: unknown };

function toStored(row: ReportRow): StoredReport | null {
  try {
    const content = JSON.parse(row.content) as { lang?: Lang; report: AnalystReport };
    const facts = JSON.parse(row.facts) as FactPack;

    return {
      id: row.id,
      period: row.period,
      from: facts.period.from,
      to: facts.period.to,
      generator: row.generator,
      lang: content.lang === "en" ? "en" : "ar",
      createdAt: String(row.createdAt),
      report: content.report,
      facts,
    };
  } catch {
    return null;
  }
}

/** Generate, verify and store a report for the selection. */
export async function generateReport(selection: PeriodSelection, actor: { id: number; role?: string | null }, lang: Lang) {
  const snapshot = await getFinanceSnapshot(selection);
  const facts = buildFactPack(snapshot, lang);
  const ai = await aiReport(facts, lang);
  const report = verifyReport(ai?.report ?? ruleBasedReport(facts, lang), facts);
  const generator = ai ? `ai:${ai.model}` : "rules";

  const created = await db.orm.public.BusinessReport.create({
    period: selection.period,
    rangeStart: snapshot.range.current.start,
    rangeEnd: snapshot.range.current.end,
    generator,
    facts: JSON.stringify(facts),
    content: JSON.stringify({ lang, report }),
    createdBy: actor.id,
  });

  await logActivity({
    actor,
    entityType: "FINANCE",
    entityId: `report:${created.id}`,
    action: "FINANCE_REPORT_GENERATED",
    summary: `Business report generated (${selection.period} ${facts.period.from} → ${facts.period.to}, ${generator})`,
  });

  return { id: created.id, generator };
}

export async function latestReport() {
  const row = await db.orm.public.BusinessReport.orderBy((item) => item.id.desc()).first();

  return row ? toStored(row) : null;
}

export async function getReport(id: number) {
  const row = await db.orm.public.BusinessReport.where({ id }).first();

  return row ? toStored(row) : null;
}

export async function listReports(limit = 30) {
  const rows = await db.orm.public.BusinessReport.select("id", "period", "generator", "rangeStart", "rangeEnd", "createdAt")
    .orderBy((item) => item.id.desc())
    .limit(limit)
    .all();

  return rows.map((row) => ({ ...row, rangeStart: String(row.rangeStart), rangeEnd: String(row.rangeEnd), createdAt: String(row.createdAt) }));
}
