import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, FileText, Info, Sparkles } from "lucide-react";

import { generateIntelligenceReportAction } from "@/app/admin/intelligence/actions";
import { generatorLabel } from "@/app/components/admin/finance/AnalystPanel";
import { EXTENDED_PERIODS, GlassTile, TileLabel, periodLabel } from "@/app/components/admin/finance/FinanceUI";
import { SectionError } from "@/app/components/admin/dashboard/DashboardUI";
import { IntelHeader, sectionLabels } from "@/app/components/admin/intelligence/IntelUI";
import { Forbidden } from "@/app/components/admin/Forbidden";
import { ActionForm } from "@/app/ui/ActionForm";
import { Field, Input, Select } from "@/app/ui/Field";
import { EmptyState } from "@/app/ui/States";
import { SubmitButton } from "@/app/ui/SubmitButton";
import type { PeriodKey } from "@/src/lib/business-time";
import { formatDateTime } from "@/src/lib/i18n";
import { INTEL_PAGES, allowedSections } from "@/src/lib/intelligence";
import { aiConfigured, listIntelligenceReports } from "@/src/server/analyst";
import { requireStaffPage } from "@/src/server/auth";
import { getI18n } from "@/src/server/i18n";
import { parseIntelSelection, rangesOf } from "@/src/server/intelligence";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "محلل الأعمال — الذكاء والتحليلات" };

/**
 * The existing Business Analyst, Intelligence scope (insights or finance).
 * Reports use only the sections the signed-in role may see, and the list
 * shows only reports whose every section that role may see.
 */
export default async function IntelligenceAnalyst({ searchParams }: { searchParams: Promise<{ period?: string; from?: string; to?: string }> }) {
  const params = await searchParams;
  const { user } = await requireStaffPage("/admin/intelligence/analyst");

  if (!INTEL_PAGES.analyst(user.role)) return <Forbidden />;

  const { t, lang } = await getI18n();
  const selection = parseIntelSelection(params);
  const ranges = rangesOf(selection);
  const reports = await listIntelligenceReports(user.role).catch(() => null);
  const labels = sectionLabels(t);
  const scope = allowedSections(user.role);

  return (
    <div className="space-y-6" data-testid="intel-analyst">
      <IntelHeader
        active="analyst"
        role={user.role}
        t={t}
        lang={lang}
        selection={selection}
        range={ranges}
        showPeriod={false}
        title={t("محلل الأعمال", "Business analyst")}
        description={t("تقرير مكتوب من أرقام النظام فقط. الحقائق تُطابق مع البيانات قبل العرض، والتفسيرات والتوصيات مفصولة عنها.", "A report written from the system's own numbers only. Facts are checked against the data before display; interpretations and recommendations are kept separate.")}
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_1.3fr]">
        <GlassTile testId="intel-generate">
          <TileLabel icon={<Sparkles size={14} aria-hidden />}>{t("إنشاء تقرير", "Generate a report")}</TileLabel>
          <ActionForm action={generateIntelligenceReportAction} className="mt-4 space-y-4">
            <Field label={t("الفترة", "Period")} htmlFor="intel-period" required>
              <Select id="intel-period" name="period" defaultValue={selection.period}>
                {[...EXTENDED_PERIODS, { key: "custom" as PeriodKey, ar: "فترة مخصصة", en: "Custom range" }].map((item) => (
                  <option key={item.key} value={item.key}>{t(item.ar, item.en)}</option>
                ))}
              </Select>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("من (للفترة المخصصة)", "From (custom)")} htmlFor="intel-from">
                <Input id="intel-from" name="from" type="date" defaultValue={ranges.from} className="nums" />
              </Field>
              <Field label={t("إلى (للفترة المخصصة)", "To (custom)")} htmlFor="intel-to">
                <Input id="intel-to" name="to" type="date" defaultValue={ranges.to} className="nums" />
              </Field>
            </div>
            <div className="rounded-xl border border-line bg-surface-2/60 p-3 text-xs leading-5 text-ink-3" data-testid="intel-scope" data-sections={scope.join(",")}>
              <p className="font-semibold text-ink-2">{t("أقسام التقرير حسب صلاحياتك:", "Sections in your report (by your permissions):")}</p>
              <p className="mt-1">{scope.map((section) => labels[section]).join(" · ")}</p>
            </div>
            <p className="flex items-start gap-2 rounded-xl border border-line bg-surface-2/60 p-3 text-xs leading-5 text-ink-3" data-testid="analyst-mode">
              <Info size={14} className="mt-0.5 shrink-0 text-brand-ink" aria-hidden />
              {aiConfigured()
                ? t("المحلل الذكي مفعّل. إذا تعذر الاتصال، يُكتب التقرير بالتحليل الآلي بالقواعد ويُوضَّح ذلك.", "The AI analyst is enabled. If it can't be reached, the rule-based analyst writes the report and it is labelled as such.")
                : t("المحلل الذكي غير مفعّل (لا يوجد مفتاح ANTHROPIC_API_KEY). سيُكتب التقرير بالتحليل الآلي بالقواعد.", "The AI analyst is not configured (no ANTHROPIC_API_KEY). Reports are written by the rule-based analyst.")}
            </p>
            <SubmitButton pendingLabel={t("جاري التحليل…", "Analysing…")}>{t("إنشاء التقرير", "Generate report")}</SubmitButton>
          </ActionForm>
        </GlassTile>

        <section aria-labelledby="intel-history" className="space-y-3">
          <h2 id="intel-history" className="text-lg font-bold text-ink">{t("التقارير السابقة", "Previous reports")}</h2>
          {reports === null ? (
            <SectionError label={t("تعذر تحميل التقارير.", "Couldn't load reports.")} />
          ) : reports.length ? (
            <ul className="space-y-2" data-testid="intel-report-list">
              {reports.map((report) => (
                <li key={report.id}>
                  <Link href={`/admin/intelligence/analyst/${report.id}`} data-testid="intel-report-link" data-id={report.id} data-sections={report.sections.join(",")} className="flex items-center gap-3 rounded-2xl border border-line bg-surface/70 p-4 transition hover:border-line-strong hover:bg-surface-2">
                    <FileText size={18} className="shrink-0 text-brand-ink" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-ink">{periodLabel(report.period as PeriodKey, lang)}</span>
                      <span className="nums block text-xs text-ink-3">
                        {report.from} → {report.to} · {generatorLabel(report.generator, lang)} · {formatDateTime(report.createdAt, lang)}
                      </span>
                    </span>
                    <ArrowLeft size={16} className="shrink-0 text-ink-3 ltr:rotate-180" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState compact title={t("ماكو تقارير بعد", "No reports yet")} />
          )}
        </section>
      </div>
    </div>
  );
}
