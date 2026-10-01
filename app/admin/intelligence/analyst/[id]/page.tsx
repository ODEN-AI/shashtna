import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowRight, Database, Sparkles } from "lucide-react";

import { StatementItem, generatorLabel, kindLabel } from "@/app/components/admin/finance/AnalystPanel";
import { GlassTile, periodLabel } from "@/app/components/admin/finance/FinanceUI";
import { sectionLabels } from "@/app/components/admin/intelligence/IntelUI";
import { Forbidden } from "@/app/components/admin/Forbidden";
import { PrintButton } from "@/app/ui/PrintButton";
import type { StatementKind } from "@/src/lib/analyst";
import type { PeriodKey } from "@/src/lib/business-time";
import { formatDateTime } from "@/src/lib/i18n";
import { INTEL_PAGES } from "@/src/lib/intelligence";
import { customersById } from "@/src/server/admin-data";
import { getIntelligenceReport } from "@/src/server/analyst";
import { requireStaffPage } from "@/src/server/auth";
import { getI18n } from "@/src/server/i18n";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "تقرير المحلل — الذكاء والتحليلات" };

const KINDS: StatementKind[] = ["FACT", "OBSERVATION", "INTERPRETATION", "RECOMMENDATION"];

/**
 * One stored Intelligence report. It opens only for a role that may see
 * every section in it; otherwise it is "not found" (its existence isn't
 * revealed).
 */
export default async function IntelligenceReport({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await requireStaffPage("/admin/intelligence/analyst");

  if (!INTEL_PAGES.analyst(user.role)) return <Forbidden />;

  const [{ t, lang }, { id }] = await Promise.all([getI18n(), params]);
  const reportId = Number(id);
  const stored = Number.isInteger(reportId) && reportId > 0 ? await getIntelligenceReport(reportId, user.role) : null;

  if (!stored) notFound();

  const { report, facts } = stored;
  const unverified = report.sections.reduce((sum, section) => sum + section.statements.filter((item) => item.kind === "FACT" && item.verified === false).length, 0);
  const creator = stored.createdBy ? (await customersById([stored.createdBy]).catch(() => new Map())).get(stored.createdBy)?.name ?? null : null;
  const labels = sectionLabels(t);

  return (
    <div className="space-y-6" data-testid="intel-report" data-sections={stored.sections.join(",")} data-generator={stored.generator}>
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link href="/admin/intelligence/analyst" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-ink hover:text-ink print:hidden">
            <ArrowRight size={14} className="ltr:rotate-180" aria-hidden /> {t("التقارير", "Reports")}
          </Link>
          <p className="mt-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-glow">
            <Sparkles size={14} aria-hidden /> Shashtna AI Analyst · {generatorLabel(stored.generator, lang)}
          </p>
          <h1 className="nums mt-2 max-w-4xl text-h2 font-extrabold leading-tight text-ink" dir={stored.lang === "ar" ? "rtl" : "ltr"} data-testid="intel-report-headline">
            {report.headline}
          </h1>
          <p className="nums mt-2 text-sm text-ink-3">
            {periodLabel(stored.period as PeriodKey, lang)} · {stored.from} → {stored.to} · {facts.period.comparison} · {formatDateTime(stored.createdAt, lang)}
            {creator ? ` · ${t("أنشأه", "by")} ${creator}` : ""}
          </p>
        </div>
        <div className="print:hidden">
          <PrintButton label={t("طباعة / PDF", "Print / PDF")} />
        </div>
      </header>

      <div className="flex flex-wrap gap-2 text-xs text-ink-3" aria-label={t("دليل التصنيفات", "Legend")}>
        {KINDS.map((kind) => (
          <span key={kind} className="rounded-full border border-line px-2.5 py-1">{kindLabel(kind, lang)}</span>
        ))}
      </div>

      {unverified ? (
        <p className="flex items-start gap-2 rounded-2xl border border-warning/30 bg-warning/8 p-4 text-sm text-warning" data-testid="report-unverified-warning">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
          {t(`${unverified} حقيقة تحتوي رقمًا غير موجود بالبيانات وتم تعليمها — لا تعتمد عليها.`, `${unverified} fact(s) cite a number not found in the data and are flagged — do not rely on them.`)}
        </p>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <div className="space-y-5" dir={stored.lang === "ar" ? "rtl" : "ltr"}>
          {report.sections.map((section) => (
            <GlassTile key={section.key} testId={`intel-report-section-${section.key}`}>
              <h2 className="text-base font-bold text-ink">{section.title}</h2>
              <ul className="mt-4 space-y-3">
                {section.statements.map((statement, index) => (
                  <StatementItem key={index} statement={statement} lang={lang} />
                ))}
              </ul>
            </GlassTile>
          ))}
        </div>

        <aside className="space-y-5">
          <GlassTile testId="intel-report-scope">
            <h2 className="flex items-center gap-2 text-base font-bold text-ink">
              <Database size={16} className="text-brand-ink" aria-hidden /> {t("نطاق التقرير", "Report scope")}
            </h2>
            <p className="mt-3 text-sm text-ink-2">{stored.sections.map((section) => labels[section] ?? section).join(" · ")}</p>
            <p className="mt-2 text-xs leading-5 text-ink-3">
              {t("بُني من أرقام مجمّعة فقط (بدون أسماء عملاء أو أرقام هواتف أو بيانات دخول أو إثباتات دفع)، بتوقيت بغداد.", "Built from aggregates only (no customer names, phone numbers, credentials or payment proofs), in Baghdad time.")}
            </p>
          </GlassTile>
        </aside>
      </div>
    </div>
  );
}
