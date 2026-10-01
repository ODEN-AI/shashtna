import type { Metadata } from "next";
import { Database, KeyRound, Settings2 } from "lucide-react";

import { SystemHeader } from "@/app/components/admin/system/SystemUI";
import { SectionCard, SectionError } from "@/app/components/admin/dashboard/DashboardUI";
import { Forbidden } from "@/app/components/admin/Forbidden";
import { Badge } from "@/app/ui/Badge";
import { LinkButton } from "@/app/ui/Button";
import { DataTable } from "@/app/ui/DataTable";
import { formatDateTime } from "@/src/lib/i18n";
import { hasPermission } from "@/src/lib/roles";
import { requireStaffPage } from "@/src/server/auth";
import { getI18n } from "@/src/server/i18n";
import { getConfiguration, getSettingsSummary } from "@/src/server/system";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "الإعدادات والتهيئة — النظام" };

/**
 * Settings (SiteSetting, edited in Admin → Settings) and configuration
 * status. Environment configuration is shown as configured / not
 * configured only — values never reach the page.
 */
export default async function SystemSettingsPage() {
  const { user, allowed } = await requireStaffPage("/admin/system/settings", "settings");

  if (!allowed) return <Forbidden />;

  const { t, lang } = await getI18n();
  const [summary, overview] = await Promise.all([getSettingsSummary(), getConfiguration()]);
  const descriptions: Record<string, string> = {
    DATABASE_URL: t("اتصال قاعدة البيانات (مطلوب).", "Database connection (required)."),
    AUTH_SECRET: t("مفتاح توقيع الجلسات، 32 حرفًا على الأقل (مطلوب).", "Session signing key, at least 32 characters (required)."),
    ANTHROPIC_API_KEY: t("المحلل الذكي في المالية (اختياري؛ بدونه يُستخدم المحلل الآلي).", "AI analyst in Finance (optional; without it the rule-based analyst is used)."),
    NETLIFY_BLOBS: t("تخزين الملفات المرفوعة وتذاكر الدعم على Netlify (في الإنتاج).", "Uploads and support tickets stored on Netlify (in production)."),
  };

  return (
    <div className="space-y-5" data-testid="system-settings-page">
      <SystemHeader
        active="settings"
        t={t}
        can={(permission) => hasPermission(user.role, permission)}
        title={t("الإعدادات والتهيئة", "Settings & configuration")}
        actions={<LinkButton href="/admin/settings" size="sm"><Settings2 size={15} aria-hidden /> {t("تعديل الإعدادات", "Edit settings")}</LinkButton>}
      />

      <SectionCard title={t("التهيئة (متغيرات البيئة)", "Configuration (environment)")} icon={<KeyRound size={14} aria-hidden />} testId="config-status">
        <ul className="divide-y divide-line/60">
          <li className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm" data-testid="config-db">
            <span className="flex items-center gap-2 text-ink"><Database size={14} aria-hidden /> {t("قاعدة البيانات", "Database")}</span>
            {overview.database?.ok ? <Badge tone="success" dot>{t("متصلة", "Connected")}</Badge> : <Badge tone="danger" dot>{t("غير متاحة", "Unavailable")}</Badge>}
          </li>
          {overview.configuration.map((item) => (
            <li key={item.key} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm" data-testid="config-row" data-key={item.key} data-configured={item.configured}>
              <span className="min-w-0">
                <span className="font-semibold text-ink" dir="ltr">{item.key}</span>
                <span className="block text-xs text-ink-3">{descriptions[item.key]}</span>
              </span>
              {item.configured ? <Badge tone="success" dot>{t("مهيأ", "Configured")}</Badge> : <Badge tone={item.required ? "danger" : "neutral"} dot>{t("غير مهيأ", "Not configured")}</Badge>}
            </li>
          ))}
          <li className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm" data-testid="config-deploy">
            <span className="text-ink">{t("معرّف النشر (Netlify)", "Deploy ID (Netlify)")}</span>
            <span className="nums text-xs text-ink-3" dir="ltr">{overview.deployId ?? t("غير متاح", "Unavailable")}</span>
          </li>
        </ul>
        <p className="mt-3 text-xs text-ink-3">{t("القيم السرية لا تُعرض أبدًا؛ تُدار من إعدادات Netlify.", "Secret values are never shown; they're managed in Netlify's environment settings.")}</p>
      </SectionCard>

      <SectionCard title={t("إعدادات الموقع", "Site settings")} icon={<Settings2 size={14} aria-hidden />} testId="settings-summary">
        {!summary?.ok ? (
          <SectionError label={t("تعذر تحميل الإعدادات.", "Couldn't load settings.")} />
        ) : (
          <DataTable
            caption={t("إعدادات الموقع", "Site settings")}
            rows={summary.data}
            rowKey={(row) => row.key}
            columns={[
              { key: "label", header: t("الإعداد", "Setting"), cell: (row) => <span className="block" data-testid="setting-row" data-key={row.key} data-set={row.set}><span className="font-semibold text-ink">{lang === "ar" ? row.labelAr : row.labelEn}</span><span className="block text-xs text-ink-3" dir="ltr">{row.key}</span></span> },
              {
                key: "value",
                header: t("القيمة", "Value"),
                cell: (row) =>
                  !row.set ? <Badge tone="warning">{t("فارغ — العنصر مخفي", "Empty — hidden")}</Badge> : /^\d+$/.test(row.preview) && row.group === "legal" ? <span className="text-xs text-ink-3">{t(`نص (${row.preview} حرف)`, `Text (${row.preview} chars)`)}</span> : <span className="break-all text-xs text-ink-2" dir="auto">{row.preview}</span>,
              },
              { key: "updated", header: t("آخر تعديل", "Last changed"), hideOnMobile: true, cell: (row) => <span className="nums text-xs text-ink-3">{row.updatedAt ? `${formatDateTime(row.updatedAt, lang)}${row.updatedBy ? ` · ${row.updatedBy}` : ""}` : row.usingDefault ? t("القيمة الافتراضية", "Default value") : "—"}</span> },
            ]}
          />
        )}
      </SectionCard>
    </div>
  );
}
