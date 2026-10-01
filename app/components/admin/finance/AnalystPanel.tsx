import Link from "next/link";
import { AlertTriangle, ArrowLeft, Sparkles } from "lucide-react";

import { cn } from "@/app/ui/cn";
import type { Statement, StatementKind } from "@/src/lib/analyst";
import type { PeriodKey } from "@/src/lib/business-time";
import { formatDateTime, translator, type Lang } from "@/src/lib/i18n";
import type { StoredReport } from "@/src/server/analyst";

const KIND_STYLE: Record<StatementKind, string> = {
  FACT: "bg-sky/15 text-brand-ink",
  OBSERVATION: "bg-white/8 text-ink-2",
  INTERPRETATION: "bg-viz-profit/15 text-[#d7c2fb]",
  RECOMMENDATION: "bg-success/12 text-success",
};

export function kindLabel(kind: StatementKind, lang: Lang) {
  const t = translator(lang);

  switch (kind) {
    case "FACT":
      return t("حقيقة", "Fact");
    case "OBSERVATION":
      return t("ملاحظة", "Observation");
    case "INTERPRETATION":
      return t("تفسير محتمل", "Interpretation");
    case "RECOMMENDATION":
    default:
      return t("توصية", "Recommendation");
  }
}

export function generatorLabel(generator: string, lang: Lang) {
  const t = translator(lang);

  return generator.startsWith("ai:") ? t("تحليل ذكاء اصطناعي", "AI analysis") : t("تحليل آلي بالقواعد", "Rule-based analysis");
}

/** One analyst statement: kind tag + text; an unverified FACT is flagged, never hidden. */
export function StatementItem({ statement, lang }: { statement: Statement; lang: Lang }) {
  const t = translator(lang);
  const unverified = statement.kind === "FACT" && statement.verified === false;

  return (
    <li className="flex items-start gap-3" data-testid="analyst-statement" data-kind={statement.kind}>
      <span className={cn("mt-0.5 shrink-0 rounded-md px-2 py-0.5 text-[11px] font-bold", KIND_STYLE[statement.kind])}>{kindLabel(statement.kind, lang)}</span>
      <p className="text-sm leading-7 text-ink">
        {statement.text}
        {unverified ? (
          <span className="ms-2 inline-flex items-center gap-1 rounded-md bg-warning/12 px-1.5 py-0.5 align-middle text-[11px] font-semibold text-warning" data-testid="analyst-unverified">
            <AlertTriangle size={11} aria-hidden />
            {t("رقم غير مطابق للبيانات — تجاهله", "Number not found in the data — disregard")}
          </span>
        ) : null}
      </p>
    </li>
  );
}

/**
 * "Shashtna AI Analyst" — the latest stored report's headline and key
 * statements on the dashboard. A premium analytical panel, not a chat.
 */
export function AnalystPanel({ lang, report, period, from, to }: { lang: Lang; report: StoredReport | null; period: PeriodKey; from: string; to: string }) {
  const t = translator(lang);
  const query = new URLSearchParams({ period, ...(period === "custom" ? { from, to } : {}) }).toString();
  const key = report?.report.sections.flatMap((section) => (section.key === "summary" || section.key === "observations" || section.key === "anomalies" ? section.statements : [])) ?? [];
  const highlights = [...key.filter((item) => item.kind !== "FACT"), ...key.filter((item) => item.kind === "FACT")].slice(0, 4);

  return (
    <section
      aria-labelledby="analyst-title"
      data-testid="analyst-panel"
      className="relative overflow-hidden rounded-[1.6rem] border border-white/10 bg-[radial-gradient(120%_120%_at_100%_0%,rgb(25_81_252/0.28),transparent_55%),linear-gradient(180deg,rgb(10_28_77/0.92),rgb(6_21_61/0.92))] p-5 shadow-card [border-top-color:rgb(203_233_253/0.2)] sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-glow">
            <Sparkles size={14} aria-hidden />
            Shashtna AI Analyst
          </p>
          <h2 id="analyst-title" className="mt-2 text-lg font-extrabold text-ink">
            {t("محلل الأعمال", "Business analyst")}
          </h2>
        </div>
        <Link href={`/admin/finance/reports?${query}`} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-white px-3.5 text-sm font-bold text-navy shadow-glow transition hover:bg-glow">
          {report ? t("التقارير", "Reports") : t("إنشاء تقرير", "Generate report")}
          <ArrowLeft size={15} className="ltr:rotate-180" aria-hidden />
        </Link>
      </div>

      {report ? (
        <div className="mt-5" dir={report.lang === "ar" ? "rtl" : "ltr"}>
          <p className="nums text-xl font-extrabold leading-8 text-white" data-testid="analyst-headline">{report.report.headline}</p>
          <p className="nums mt-1 text-xs text-ink-3">
            {generatorLabel(report.generator, lang)} · {report.from} → {report.to} · {formatDateTime(report.createdAt, lang)}
          </p>
          <ul className="mt-4 space-y-3">
            {highlights.map((statement, index) => (
              <StatementItem key={index} statement={statement} lang={lang} />
            ))}
          </ul>
          <Link href={`/admin/finance/reports/${report.id}`} className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-ink hover:text-ink">
            {t("التقرير الكامل", "Full report")}
            <ArrowLeft size={14} className="ltr:rotate-180" aria-hidden />
          </Link>
        </div>
      ) : (
        <p className="mt-5 text-sm leading-7 text-ink-2">
          {t(
            "ماكو تقرير بعد. المحلل يكتب تقرير من أرقام النظام فقط ويفصل بين الحقائق والملاحظات والتفسيرات والتوصيات.",
            "No report yet. The analyst writes only from the system's own numbers and separates facts, observations, interpretations and recommendations.",
          )}
        </p>
      )}
    </section>
  );
}
