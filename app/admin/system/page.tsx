import type { Metadata } from "next";
import Link from "next/link";
import { Activity, Database, KeyRound, Settings2, ShieldAlert, UsersRound } from "lucide-react";

import { SystemHeader } from "@/app/components/admin/system/SystemUI";
import { EmptyLine, KpiTile, SectionCard, SectionError } from "@/app/components/admin/dashboard/DashboardUI";
import { Forbidden } from "@/app/components/admin/Forbidden";
import { Badge } from "@/app/ui/Badge";
import { formatDateTime } from "@/src/lib/i18n";
import { ROLE_LABELS, hasPermission } from "@/src/lib/roles";
import { requireStaffPage } from "@/src/server/auth";
import { getI18n } from "@/src/server/i18n";
import { getSystemOverview } from "@/src/server/system";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "النظام والإدارة" };

/**
 * System command centre: who has access, recent security-relevant actions,
 * settings completeness and configuration status (configured / not — never
 * values). Each section loads only with its permission (staff / audit /
 * settings), which only full-access roles hold today.
 */
export default async function SystemPage() {
  const { user } = await requireStaffPage("/admin/system");
  const allowedAny = (["staff", "audit", "settings"] as const).some((permission) => hasPermission(user.role, permission));

  if (!allowedAny) return <Forbidden />;

  const { t, lang } = await getI18n();
  const data = await getSystemOverview(user.role);
  const actionLabels: Record<string, string> = {
    ROLE_CHANGED: t("تغيير أدوار", "Role changes"),
    STAFF_SESSIONS_REVOKED: t("إنهاء جلسات", "Sessions ended"),
    SUBSCRIPTION_CREDENTIALS_REVEALED: t("إظهار بيانات اشتراك", "Credential reveals"),
    SETTINGS_UPDATED: t("تعديل إعدادات", "Settings changes"),
    PASSWORD_RESET_CODE_ISSUED: t("رموز إعادة تعيين", "Reset codes issued"),
    PASSWORD_CHANGED: t("تغيير كلمات مرور", "Passwords changed"),
    CONSOLE_DEVICE_REGISTERED: t("تسجيل أجهزة التطبيق", "App devices registered"),
    CONSOLE_DEVICE_REVOKED: t("إلغاء أجهزة التطبيق", "App devices revoked"),
  };

  return (
    <div className="space-y-6" data-testid="system-overview">
      <SystemHeader active="overview" t={t} can={data.can} title={t("النظام والإدارة", "System & admin")} description={t("من يملك الوصول، ما الذي تغيّر، وحالة الإعدادات والتهيئة.", "Who has access, what changed, and the state of settings and configuration.")} />

      {data.staff === null ? null : !data.staff.ok ? (
        <SectionError label={t("تعذر تحميل فريق العمل.", "Couldn't load staff.")} />
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="system-kpis">
          <KpiTile hero label={t("فريق العمل", "Staff")} value={data.staff.data.total} hint={t(`${data.staff.data.fullAccess} بصلاحيات كاملة`, `${data.staff.data.fullAccess} with full access`)} href="/admin/system/staff" testId="system-kpi-staff" />
          {data.staff.data.byRole.filter((row) => row.role !== "ADMIN" || row.count > 0).slice(0, 3).map((row) => (
            <KpiTile key={row.role} label={ROLE_LABELS[row.role]?.[lang] ?? row.role} value={row.count} href={`/admin/system/staff?role=${row.role}`} testId={`system-kpi-role-${row.role}`} />
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {data.staff?.ok ? (
          <SectionCard title={t("توزيع الأدوار", "Role distribution")} icon={<UsersRound size={14} aria-hidden />} action={{ href: "/admin/system/roles", label: t("الصلاحيات", "Permissions") }} testId="system-roles">
            <ul className="divide-y divide-line/60">
              {data.staff.data.byRole.map((row) => (
                <li key={row.role}>
                  <Link href={`/admin/system/staff?role=${row.role}`} className="flex items-center justify-between gap-3 py-2.5 text-sm hover:text-brand-ink" data-testid="system-role-row" data-role={row.role}>
                    <span className="text-ink">{ROLE_LABELS[row.role]?.[lang] ?? row.role}</span>
                    <span className="nums font-bold text-ink">{row.count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </SectionCard>
        ) : null}

        {data.security === null ? null : (
          <SectionCard title={t("أحداث أمنية — آخر 7 أيام", "Security events — last 7 days")} icon={<ShieldAlert size={14} aria-hidden />} action={{ href: "/admin/system/security", label: t("التفاصيل", "Details") }} testId="system-security">
            {!data.security.ok ? (
              <SectionError label={t("تعذر تحميل الأحداث الأمنية.", "Couldn't load security events.")} />
            ) : (
              <ul className="divide-y divide-line/60">
                {data.security.data.map((row) => (
                  <li key={row.action}>
                    <Link href={`/admin/audit?action=${row.action}&since=7d`} className="flex items-center justify-between gap-3 py-2.5 text-sm hover:text-brand-ink" data-testid="system-security-row" data-action={row.action}>
                      <span className="text-ink">{actionLabels[row.action] ?? row.action}</span>
                      <span className="nums font-bold text-ink">{row.count}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {data.activity === null ? null : (
          <SectionCard title={t("آخر إجراءات الإدارة", "Latest admin actions")} icon={<Activity size={14} aria-hidden />} action={{ href: "/admin/audit?entity=STAFF", label: t("سجل التدقيق", "Audit log") }} testId="system-activity">
            {!data.activity.ok ? (
              <SectionError label={t("تعذر تحميل السجل.", "Couldn't load the log.")} />
            ) : data.activity.data.length ? (
              <ul className="divide-y divide-line/60">
                {data.activity.data.map((event) => (
                  <li key={event.id} className="py-2.5 text-sm">
                    <p className="text-ink">{event.summary}</p>
                    <p className="nums text-xs text-ink-3">{event.action} · {formatDateTime(event.createdAt, lang)}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyLine>{t("لا توجد إجراءات إدارية مسجلة بعد.", "No admin actions recorded yet.")}</EmptyLine>
            )}
          </SectionCard>
        )}

        {data.configuration ? (
          <SectionCard title={t("التهيئة والإعدادات", "Configuration & settings")} icon={<Settings2 size={14} aria-hidden />} action={{ href: "/admin/system/settings", label: t("التفاصيل", "Details") }} testId="system-config">
            <ul className="space-y-2 text-sm">
              <li className="flex items-center justify-between gap-3" data-testid="system-db">
                <span className="flex items-center gap-2 text-ink"><Database size={14} aria-hidden /> {t("قاعدة البيانات", "Database")}</span>
                {data.database?.ok ? <Badge tone="success" dot>{t("متصلة", "Connected")}</Badge> : <Badge tone="danger" dot>{t("غير متاحة", "Unavailable")}</Badge>}
              </li>
              {data.configuration.map((item) => (
                <li key={item.key} className="flex items-center justify-between gap-3" data-testid="system-config-row" data-key={item.key} data-configured={item.configured}>
                  <span className="flex items-center gap-2 text-ink" dir="ltr"><KeyRound size={14} aria-hidden /> {item.key}</span>
                  {item.configured ? <Badge tone="success" dot>{t("مهيأ", "Configured")}</Badge> : <Badge tone={item.required ? "danger" : "neutral"} dot>{t("غير مهيأ", "Not configured")}</Badge>}
                </li>
              ))}
              {data.settings?.ok ? (
                <li className="flex items-center justify-between gap-3 border-t border-line/60 pt-2" data-testid="system-settings-count">
                  <span className="text-ink">{t("إعدادات الموقع المعبأة", "Site settings filled in")}</span>
                  <span className="nums font-bold text-ink">{data.settings.data.set} / {data.settings.data.total}</span>
                </li>
              ) : data.settings ? (
                <li><SectionError label={t("تعذر تحميل الإعدادات.", "Couldn't load settings.")} /></li>
              ) : null}
            </ul>
          </SectionCard>
        ) : null}
      </div>

      <p className="text-xs text-ink-3">
        {t(`جلسات فريق العمل تنتهي بعد ${data.sessionDays} أيام كحد أقصى. لإدارة جلساتك أنت: `, `Staff sessions end after at most ${data.sessionDays} days. For your own sessions: `)}
        <Link href="/admin/security" className="font-semibold text-brand-ink hover:underline">{t("الأمان والجلسات", "Security & sessions")}</Link>
      </p>
    </div>
  );
}
