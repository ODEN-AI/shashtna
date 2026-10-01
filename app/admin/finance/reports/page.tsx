import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, FileText, Info, Sparkles } from "lucide-react";

import { generateReportAction } from "@/app/admin/finance/actions";
import { generatorLabel } from "@/app/components/admin/finance/AnalystPanel";
import { GlassTile, TileLabel, periodLabel } from "@/app/components/admin/finance/FinanceUI";
import { Forbidden } from "@/app/components/admin/Forbidden";
import { ActionForm } from "@/app/ui/ActionForm";
import { Field, Input, Select } from "@/app/ui/Field";
import { EmptyState } from "@/app/ui/States";
import { SubmitButton } from "@/app/ui/SubmitButton";
import { businessDay, resolveRange, type PeriodKey } from "@/src/lib/business-time";
import { parseInstant } from "@/src/lib/finance";
import { formatDateTime } from "@/src/lib/i18n";
import { aiConfigured, listReports } from "@/src/server/analyst";
import { requireStaffPage } from "@/src/server/auth";
import { parseSelection } from "@/src/server/finance";
import { getI18n } from "@/src/server/i18n";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "تقارير المحلل" };

const REPORT_TYPES: { key: PeriodKey; ar: string; en: string }[] = [
  { key: "today", ar: "تقرير يومي (اليوم حتى الآن)", en: "Daily (today so far)" },
  { key: "week", ar: "تقرير أسبوعي (هذا الأسبوع)", en: "Weekly (this week)" },
  { key: "month", ar: "تقرير شهري (هذا الشهر)", en: "Monthly (this month)" },
  { key: "year", ar: "تقرير سنوي (هذه السنة)", en: "Yearly (this year)" },
  { key: "custom", ar: "فترة مخصصة", en: "Custom range" },
];

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ period?: string; from?: string; to?: string }> }) {
  const { allowed } = await requireStaffPage("/admin/finance/reports", "finance");

  if (!allowed) {
    return <Forbidden />;
  }

  const [{ t, lang }, params] = await Promise.all([getI18n(), searchParams]);
  const selection = parseSelection(params);
  const { current } = resolveRange(selection.period, new Date(), { from: selection.from, to: selection.to });
  const reports = await listReports();
  const ai = aiConfigured();

  return (
    <div className="relative isolate space-y-6" data-testid="reports-page">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-24 -z-10 h-[420px] bg-[radial-gradient(55%_60%_at_75%_0%,rgb(25_81_252/0.18),transparent_70%)]" />
      <header>
        <Link href="/admin/finance" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-ink hover:text-ink">
          <ArrowRight size={14} className="ltr:rotate-180" aria-hidden /> {t("المالية والأداء", "Finance & performance")}
        </Link>
        <p className="mt-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-glow">
          <Sparkles size={14} aria-hidden /> Shashtna AI Analyst
        </p>
        <h1 className="mt-1 text-h1 font-bold text-ink">{t("تقارير محلل الأعمال", "Business analyst reports")}</h1>
        <p className="mt-1 max-w-3xl text-sm leading-7 text-ink-3">
          {t(
            "كل تقرير يُكتب من أرقام النظام فقط ويُقارن بالفترة السابقة. كل رقم بالحقائق يُطابق مع البيانات قبل العرض.",
            "Every report is written from the system's own numbers only and compared with the previous period. Every number in a fact is checked against the data before it is shown.",
          )}
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[1fr_1.3fr]">
        <GlassTile testId="report-generate">
          <TileLabel icon={<Sparkles size={14} aria-hidden />}>{t("إنشاء تقرير", "Generate a report")}</TileLabel>
          <ActionForm action={generateReportAction} className="mt-4 space-y-4">
            <Field label={t("نوع التقرير", "Report type")} htmlFor="report-period" required>
              <Select id="report-period" name="period" defaultValue={selection.period}>
                {REPORT_TYPES.map((item) => (
                  <option key={item.key} value={item.key}>{t(item.ar, item.en)}</option>
                ))}
              </Select>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("من (للفترة المخصصة)", "From (custom)")} htmlFor="report-from">
                <Input id="report-from" name="from" type="date" defaultValue={businessDay(current.start)} className="nums" />
              </Field>
              <Field label={t("إلى (للفترة المخصصة)", "To (custom)")} htmlFor="report-to">
                <Input id="report-to" name="to" type="date" defaultValue={businessDay(new Date(current.end.getTime() - 1))} className="nums" />
              </Field>
            </div>
            <p className="flex items-start gap-2 rounded-xl border border-line bg-surface-2/60 p-3 text-xs leading-5 text-ink-3" data-testid="analyst-mode">
              <Info size={14} className="mt-0.5 shrink-0 text-brand-ink" aria-hidden />
              {ai
                ? t("المحلل الذكي مفعّل. إذا تعذر الاتصال، يُكتب التقرير بالتحليل الآلي بالقواعد ويُوضَّح ذلك.", "The AI analyst is enabled. If it can't be reached, the rule-based analyst writes the report and it is labelled as such.")
                : t("المحلل الذكي غير مفعّل (لا يوجد مفتاح ANTHROPIC_API_KEY). سيُكتب التقرير بالتحليل الآلي بالقواعد.", "The AI analyst is not configured (no ANTHROPIC_API_KEY). Reports are written by the rule-based analyst.")}
            </p>
            <SubmitButton pendingLabel={t("جاري التحليل…", "Analysing…")}>{t("إنشاء التقرير", "Generate report")}</SubmitButton>
          </ActionForm>
        </GlassTile>

        <section aria-labelledby="report-history" className="space-y-3">
          <h2 id="report-history" className="text-lg font-bold text-ink">{t("التقارير السابقة", "Previous reports")}</h2>
          {reports.length ? (
            <ul className="space-y-2" data-testid="report-list">
              {reports.map((report) => {
                const start = parseInstant(report.rangeStart);
                const end = parseInstant(report.rangeEnd);

                return (
                  <li key={report.id}>
                    <Link href={`/admin/finance/reports/${report.id}`} className="flex items-center gap-3 rounded-2xl border border-line bg-surface/70 p-4 transition hover:border-line-strong hover:bg-surface-2">
                      <FileText size={18} className="shrink-0 text-brand-ink" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-ink">{periodLabel(report.period as PeriodKey, lang)}</span>
                        <span className="nums block text-xs text-ink-3">
                          {start ? businessDay(start) : "—"} → {end ? businessDay(new Date(end.getTime() - 1)) : "—"} · {generatorLabel(report.generator, lang)} · {formatDateTime(report.createdAt, lang)}
                        </span>
                      </span>
                      <ArrowLeft size={16} className="shrink-0 text-ink-3 ltr:rotate-180" aria-hidden />
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState compact title={t("ماكو تقارير بعد", "No reports yet")} />
          )}
        </section>
      </div>
    </div>
  );
}
