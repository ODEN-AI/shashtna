import type { Metadata } from "next";
import Link from "next/link";
import { Activity, ArrowLeft, Sparkles } from "lucide-react";
import type { ReactNode } from "react";

import { StatementItem, generatorLabel } from "@/app/components/admin/finance/AnalystPanel";
import { money } from "@/app/components/admin/finance/FinanceUI";
import { EmptyLine, KpiTile, SectionCard, SectionError } from "@/app/components/admin/dashboard/DashboardUI";
import { ChangeLine, INTEL_PATHS, IntelHeader, NotAvailable, fmt, periodQuery } from "@/app/components/admin/intelligence/IntelUI";
import { Forbidden } from "@/app/components/admin/Forbidden";
import { formatDateTime } from "@/src/lib/i18n";
import { INTEL_PAGES, INTEL_SECTIONS, businessPulse } from "@/src/lib/intelligence";
import { listIntelligenceReports } from "@/src/server/analyst";
import { requireStaffPage } from "@/src/server/auth";
import { getI18n } from "@/src/server/i18n";
import { buildIntelligencePack, loadIntelligence, parseIntelSelection } from "@/src/server/intelligence";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "الذكاء والتحليلات" };

/**
 * Intelligence overview: executive KPIs for the sections this role may see
 * (each loaded only with its permission), current vs the previous
 * comparable period, a factual pulse (no causes) and the latest analyst
 * report the role may open.
 */
export default async function IntelligenceOverview({ searchParams }: { searchParams: Promise<{ period?: string; from?: string; to?: string }> }) {
  const params = await searchParams;
  const { user } = await requireStaffPage("/admin/intelligence");

  if (!INTEL_PAGES.overview(user.role)) return <Forbidden />;

  const { t, lang } = await getI18n();
  const selection = parseIntelSelection(params);
  const [data, reports] = await Promise.all([
    loadIntelligence(user.role, selection, INTEL_SECTIONS),
    INTEL_PAGES.analyst(user.role) ? listIntelligenceReports(user.role, 1).catch(() => null) : Promise.resolve(null),
  ]);
  const pack = buildIntelligencePack(data, lang);
  const pulse = businessPulse(pack, lang);
  const query = periodQuery(selection);
  const href = (page: keyof typeof INTEL_PATHS) => `${INTEL_PATHS[page]}?${query}`;
  const failed = (label: string, key: string) => (
    <div key={key} className="rounded-[1.6rem] border border-white/8 p-5" data-testid="intel-kpi-failed" data-section={key}>
      <p className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-ink-3">{label}</p>
      <SectionError label={t("تعذر التحميل — غير متاح الآن", "Couldn't load — unavailable right now")} />
    </div>
  );
  const tiles: ReactNode[] = [];

  if (data.finance) {
    tiles.push(
      data.finance.ok ? (
        <KpiTile key="revenue" hero href={href("revenue")} testId="intel-kpi-revenue" label={t("الإيرادات", "Revenue")} value={money(data.finance.data.pack.revenue.current, lang)} chip={<ChangeLine value={data.finance.data.pack.revenue} lang={lang} money />} />
      ) : (
        failed(t("الإيرادات", "Revenue"), "finance")
      ),
    );
  }
  if (data.sales) {
    tiles.push(
      data.sales.ok ? (
        <KpiTile key="sales" href={href("products")} testId="intel-kpi-sales" label={t("المبيعات المكتملة", "Completed sales")} value={fmt(data.sales.data.pack.completedSales.current)} chip={<ChangeLine value={data.sales.data.pack.completedSales} lang={lang} />} />
      ) : (
        failed(t("المبيعات المكتملة", "Completed sales"), "sales")
      ),
    );
  }
  if (data.orders) {
    tiles.push(
      data.orders.ok ? (
        <KpiTile key="orders" href={href("operations")} testId="intel-kpi-orders" label={t("الطلبات الجديدة", "New orders")} value={fmt(data.orders.data.pack.created.current)} chip={<ChangeLine value={data.orders.data.pack.created} lang={lang} />} hint={t(`${data.orders.data.pack.awaitingPaymentNow} بانتظار الدفع الآن`, `${data.orders.data.pack.awaitingPaymentNow} awaiting payment now`)} />
      ) : (
        failed(t("الطلبات الجديدة", "New orders"), "orders")
      ),
    );
  }
  if (data.customers) {
    tiles.push(
      data.customers.ok ? (
        <KpiTile key="customers" href={href("customers")} testId="intel-kpi-customers" label={t("العملاء الجدد", "New customers")} value={fmt(data.customers.data.pack.new.current)} chip={<ChangeLine value={data.customers.data.pack.new} lang={lang} />} hint={t(`${data.customers.data.pack.paying.current} عميل دفع`, `${data.customers.data.pack.paying.current} paying`)} />
      ) : (
        failed(t("العملاء الجدد", "New customers"), "customers")
      ),
    );
  }
  if (data.subscriptions) {
    tiles.push(
      data.subscriptions.ok ? (
        <KpiTile key="subscriptions" href={href("subscriptions")} testId="intel-kpi-subscriptions" label={t("الاشتراكات الفعالة الآن", "Active subscriptions now")} value={fmt(data.subscriptions.data.pack.active)} hint={t(`التجديدات بالفترة: ${data.subscriptions.data.pack.renewals.current}`, `Renewals in period: ${data.subscriptions.data.pack.renewals.current}`)} />
      ) : (
        failed(t("الاشتراكات", "Subscriptions"), "subscriptions")
      ),
    );
  }
  if (data.support) {
    tiles.push(
      data.support.ok ? (
        <KpiTile key="support" href={href("operations")} testId="intel-kpi-support" label={t("تذاكر الدعم الجديدة", "New support tickets")} value={fmt(data.support.data.pack.created.current)} chip={<ChangeLine value={data.support.data.pack.created} lang={lang} invert />} hint={t(`${data.support.data.pack.waitingOnTeam} بانتظار الفريق`, `${data.support.data.pack.waitingOnTeam} waiting on the team`)} />
      ) : (
        failed(t("الدعم", "Support"), "support")
      ),
    );
  }
  if (data.promotions) {
    tiles.push(
      data.promotions.ok ? (
        <KpiTile key="promotions" href={href("promotions")} testId="intel-kpi-promotions" label={t("المحتوى المنشور الآن", "Content live now")} value={fmt(data.promotions.data.pack.live)} hint={t(`${data.promotions.data.pack.scheduled} مجدول`, `${data.promotions.data.pack.scheduled} scheduled`)} />
      ) : (
        failed(t("العروض والمحتوى", "Promotions"), "promotions")
      ),
    );
  }

  const latest = reports?.[0] ?? null;

  return (
    <div className="space-y-6" data-testid="intel-overview" data-sections={pack.sections.join(",")}>
      <IntelHeader
        active="overview"
        role={user.role}
        t={t}
        lang={lang}
        selection={selection}
        range={data.ranges}
        title={t("الذكاء والتحليلات", "Intelligence")}
        description={t("أرقام حقيقية من النظام، مقارنة بالفترة السابقة بنفس الطول. ترى فقط الأقسام المسموحة لدورك.", "Real numbers from the system, compared with the previous period of the same length. You only see the sections your role allows.")}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{tiles}</div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <SectionCard title={t("نبض الأعمال", "Business pulse")} icon={<Activity size={14} aria-hidden />} testId="intel-pulse">
          <p className="mb-3 text-xs text-ink-3">{t("حقائق فقط — ماذا تغيّر مقارنة بالفترة السابقة، بدون تفسير أسباب.", "Facts only — what changed vs the previous period, with no claimed causes.")}</p>
          {pulse.length ? (
            <ul className="space-y-3">
              {pulse.map((statement, index) => (
                <StatementItem key={index} statement={statement} lang={lang} />
              ))}
            </ul>
          ) : (
            <EmptyLine>{t("لا توجد أقسام قابلة للعرض لهذه الفترة.", "No sections to show for this period.")}</EmptyLine>
          )}
        </SectionCard>

        {INTEL_PAGES.analyst(user.role) ? (
          <SectionCard title={t("محلل الأعمال", "Business analyst")} icon={<Sparkles size={14} aria-hidden />} action={{ href: href("analyst"), label: t("التقارير", "Reports") }} testId="intel-analyst-card">
            {reports === null ? (
              <SectionError label={t("تعذر تحميل التقارير.", "Couldn't load reports.")} />
            ) : latest ? (
              <div dir={latest.lang === "ar" ? "rtl" : "ltr"}>
                <p className="nums text-lg font-extrabold leading-7 text-ink" data-testid="intel-analyst-headline">{latest.report.headline}</p>
                <p className="nums mt-1 text-xs text-ink-3">
                  {generatorLabel(latest.generator, lang)} · {latest.from} → {latest.to} · {formatDateTime(latest.createdAt, lang)}
                </p>
                <Link href={`/admin/intelligence/analyst/${latest.id}`} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand-ink hover:text-ink">
                  {t("التقرير الكامل", "Full report")} <ArrowLeft size={14} className="ltr:rotate-180" aria-hidden />
                </Link>
              </div>
            ) : (
              <EmptyLine>{t("لا يوجد تقرير بعد. أنشئ واحدًا من صفحة المحلل.", "No report yet. Generate one from the Analyst page.")}</EmptyLine>
            )}
          </SectionCard>
        ) : null}
      </div>

      <NotAvailable items={pack.unavailable} lang={lang} />
    </div>
  );
}
