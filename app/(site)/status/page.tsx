import type { Metadata } from "next";
import { CheckCircle2, Wrench } from "lucide-react";

import { HelpHero } from "@/app/components/site/HelpHero";
import { StatusBadge } from "@/app/ui/Badge";
import { Container } from "@/app/ui/Page";
import { ErrorState } from "@/app/ui/States";
import { formatDateTime } from "@/src/lib/i18n";
import { getActiveIncidents, getRecentResolvedIncidents } from "@/src/server/content";
import { getI18n } from "@/src/server/i18n";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "حالة الخدمة",
  description: "الأعطال والصيانة المعلنة من فريق شاشتنا.",
  alternates: { canonical: "/status" },
};

const STATUS_LABELS: Record<string, { ar: string; en: string }> = {
  DEGRADED: { ar: "أداء متأثر", en: "Degraded" },
  OUTAGE: { ar: "عطل", en: "Outage" },
  MAINTENANCE: { ar: "صيانة", en: "Maintenance" },
};

const COMPONENT_LABELS: Record<string, { ar: string; en: string }> = {
  ALL: { ar: "كل الخدمات", en: "All services" },
  IPTV: { ar: "IPTV", en: "IPTV" },
  VIP: { ar: "VIP", en: "VIP" },
  PLAYER: { ar: "Shashtna Player", en: "Shashtna Player" },
  WEBSITE: { ar: "الموقع", en: "Website" },
};

export default async function StatusPage() {
  const { t, lang } = await getI18n();

  let data: { active: Awaited<ReturnType<typeof getActiveIncidents>>; resolved: Awaited<ReturnType<typeof getRecentResolvedIncidents>> } | null = null;

  try {
    const [active, resolved] = await Promise.all([getActiveIncidents(), getRecentResolvedIncidents(8)]);
    data = { active, resolved };
  } catch (error) {
    console.error("STATUS_PAGE_ERROR:", error);
  }

  return (
    <>
      <HelpHero
        eyebrow={t("مركز المساعدة", "Help centre")}
        title={t("حالة الخدمة", "Service status")}
        description={t(
          "هنا ينشر فريق شاشتنا أي عطل أو صيانة معروفة. هاي الصفحة تعرض الإعلانات اللي ينشرها الفريق — وليست مراقبة آلية للخدمة.",
          "The Shashtna team posts known incidents and maintenance here. This page shows what the team publishes — it isn't automated monitoring.",
        )}
      />
      <Container className="py-14">
        {data === null ? (
          <ErrorState title={t("تعذر تحميل حالة الخدمة", "Status couldn't be loaded")} />
        ) : (
          <div className="space-y-10">
            {data.active.length === 0 ? (
              <div className="surface flex items-start gap-4 rounded-panel p-6 sm:p-8">
                <CheckCircle2 size={28} className="shrink-0 text-success" aria-hidden />
                <div>
                  <h2 className="text-lg font-bold text-ink">{t("ماكو مشاكل معلنة حاليًا", "No incidents reported right now")}</h2>
                  <p className="mt-1 text-sm leading-7 text-ink-2">
                    {t("إذا تواجه مشكلة، شوف صفحة حل المشاكل أو افتح تذكرة دعم.", "If you're having trouble, see Troubleshooting or open a support ticket.")}
                  </p>
                </div>
              </div>
            ) : (
              <section aria-label={t("المشاكل الحالية", "Current incidents")} className="space-y-4">
                {data.active.map((incident) => (
                  <article key={incident.id} className="surface rounded-panel p-6 sm:p-8">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={incident.status} label={STATUS_LABELS[incident.status]?.[lang] ?? incident.status} />
                      <span className="text-xs font-semibold text-ink-3">{COMPONENT_LABELS[incident.component]?.[lang] ?? incident.component}</span>
                      {incident.upcoming ? <span className="text-xs font-semibold text-info">{t("مجدولة", "Scheduled")}</span> : null}
                    </div>
                    <h2 className="mt-3 text-lg font-bold text-ink">{incident.title}</h2>
                    <p className="mt-2 whitespace-pre-line text-sm leading-7 text-ink-2">{incident.message}</p>
                    <p className="nums mt-4 text-xs text-ink-3">
                      {incident.upcoming ? t("تبدأ: ", "Starts: ") : t("منذ: ", "Since: ")}
                      {formatDateTime(incident.startsAt, lang)}
                    </p>
                  </article>
                ))}
              </section>
            )}

            <section>
              <h2 className="flex items-center gap-2 text-base font-bold text-ink">
                <Wrench size={17} className="text-ink-3" aria-hidden />
                {t("آخر المشاكل المحلولة", "Recently resolved")}
              </h2>
              {data.resolved.length ? (
                <ul className="mt-4 divide-y divide-line rounded-card border border-line bg-surface">
                  {data.resolved.map((incident) => (
                    <li key={incident.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-4 text-sm">
                      <span className="font-semibold text-ink">{incident.title}</span>
                      <span className="nums text-xs text-ink-3">
                        {t("انحلت: ", "Resolved: ")}
                        {formatDateTime(incident.resolvedAt, lang)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-ink-3">{t("ماكو سجل مشاكل سابقة.", "No past incidents on record.")}</p>
              )}
            </section>
          </div>
        )}
      </Container>
    </>
  );
}
