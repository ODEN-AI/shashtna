import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowRight, Database, Sparkles } from "lucide-react";

import { PrintButton } from "@/app/ui/PrintButton";
import { StatementItem, generatorLabel, kindLabel } from "@/app/components/admin/finance/AnalystPanel";
import { GlassTile, money, periodLabel } from "@/app/components/admin/finance/FinanceUI";
import { Forbidden } from "@/app/components/admin/Forbidden";
import type { StatementKind } from "@/src/lib/analyst";
import type { PeriodKey } from "@/src/lib/business-time";
import { formatDateTime } from "@/src/lib/i18n";
import { getReport } from "@/src/server/analyst";
import { requireStaffPage } from "@/src/server/auth";
import { getI18n } from "@/src/server/i18n";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "تقرير المحلل" };

const KINDS: StatementKind[] = ["FACT", "OBSERVATION", "INTERPRETATION", "RECOMMENDATION"];

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { allowed } = await requireStaffPage("/admin/finance/reports", "finance");

  if (!allowed) {
    return <Forbidden />;
  }

  const [{ t, lang }, { id }] = await Promise.all([getI18n(), params]);
  const reportId = Number(id);
  const stored = Number.isInteger(reportId) && reportId > 0 ? await getReport(reportId) : null;

  if (!stored) {
    notFound();
  }

  const { report, facts } = stored;
  const unverified = report.sections.reduce((sum, section) => sum + section.statements.filter((item) => item.kind === "FACT" && item.verified === false).length, 0);

  return (
    <div className="space-y-6" data-testid="report-detail">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link href="/admin/finance/reports" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-ink hover:text-ink print:hidden">
            <ArrowRight size={14} className="ltr:rotate-180" aria-hidden /> {t("التقارير", "Reports")}
          </Link>
          <p className="mt-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-glow">
            <Sparkles size={14} aria-hidden /> Shashtna AI Analyst · {generatorLabel(stored.generator, lang)}
          </p>
          <h1 className="nums mt-2 max-w-4xl text-h2 font-extrabold leading-tight text-ink" dir={stored.lang === "ar" ? "rtl" : "ltr"} data-testid="report-headline">
            {report.headline}
          </h1>
          <p className="nums mt-2 text-sm text-ink-3">
            {periodLabel(stored.period as PeriodKey, lang)} · {stored.from} → {stored.to} · {facts.period.comparison} · {formatDateTime(stored.createdAt, lang)}
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
            <GlassTile key={section.key} testId={`report-section-${section.key}`}>
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
          <GlassTile testId="report-facts">
            <h2 className="flex items-center gap-2 text-base font-bold text-ink">
              <Database size={16} className="text-brand-ink" aria-hidden /> {t("البيانات التي بُني عليها التقرير", "Data this report is based on")}
            </h2>
            <dl className="nums mt-4 space-y-2.5 text-sm">
              <div className="flex justify-between gap-4"><dt className="text-ink-3">{t("الإيرادات", "Revenue")}</dt><dd className="font-semibold text-ink">{money(facts.revenue.current, lang)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-ink-3">{t("الفترة السابقة", "Previous period")}</dt><dd className="text-ink-2">{money(facts.revenue.previous, lang)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-ink-3">{t("مبيعات مكتملة", "Completed sales")}</dt><dd className="text-ink-2">{facts.revenue.completedSales}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-ink-3">{t("المصاريف", "Expenses")}</dt><dd className="text-ink-2">{facts.expenses.current === null ? t("غير مسجلة", "Not recorded") : money(facts.expenses.current, lang)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-ink-3">{t("صافي الربح", "Net profit")}</dt><dd className="text-ink-2">{facts.netProfit.current === null ? t("بيانات غير مكتملة", "Data incomplete") : money(facts.netProfit.current, lang)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-ink-3">{t("طلبات منشأة", "Orders created")}</dt><dd className="text-ink-2">{facts.orders.created}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-ink-3">{t("عملاء جدد", "New customers")}</dt><dd className="text-ink-2">{facts.customers.new}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-ink-3">{t("تجديدات", "Renewals")}</dt><dd className="text-ink-2">{facts.customers.renewals}</dd></div>
            </dl>
          </GlassTile>
          {report.dataGaps.length ? (
            <GlassTile testId="report-gaps">
              <h2 className="text-base font-bold text-ink">{t("بيانات غير متوفرة", "Data not available")}</h2>
              <ul className="mt-3 list-disc space-y-1.5 ps-5 text-sm leading-6 text-ink-3">
                {report.dataGaps.map((gap) => <li key={gap}>{gap}</li>)}
              </ul>
            </GlassTile>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
