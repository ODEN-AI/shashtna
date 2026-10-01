import type { Metadata } from "next";
import Link from "next/link";
import { History, LockKeyhole, ShieldAlert } from "lucide-react";

import { SystemHeader } from "@/app/components/admin/system/SystemUI";
import { EmptyLine, SectionCard, SectionError } from "@/app/components/admin/dashboard/DashboardUI";
import { Forbidden } from "@/app/components/admin/Forbidden";
import { Badge } from "@/app/ui/Badge";
import { formatDateTime } from "@/src/lib/i18n";
import { ROLE_LABELS, hasPermission } from "@/src/lib/roles";
import { requireStaffPage } from "@/src/server/auth";
import { getI18n } from "@/src/server/i18n";
import { getSecurityOverview } from "@/src/server/system";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "الأمان والجلسات — النظام" };

/**
 * Staff security overview on the existing session model: signed tokens with a
 * staff maximum lifetime, ended per person through StaffSessionRevocation.
 * There is no per-device session list (sessions aren't stored), so this shows
 * the policy, when each person's sessions were last ended and by whom, and
 * recent security events from the audit log.
 */
export default async function SystemSecurityPage() {
  const { user, allowed } = await requireStaffPage("/admin/system/security", "staff");

  if (!allowed) return <Forbidden />;

  const { t, lang } = await getI18n();
  const data = await getSecurityOverview();
  const can = (permission: Parameters<typeof hasPermission>[1]) => hasPermission(user.role, permission);

  return (
    <div className="space-y-5" data-testid="system-security-page">
      <SystemHeader active="security" t={t} can={can} title={t("الأمان والجلسات", "Security & sessions")} description={t("سياسة الجلسات، آخر إنهاء لجلسات كل عضو، والأحداث الأمنية الأخيرة.", "Session policy, when each member's sessions were last ended, and recent security events.")} />

      <SectionCard title={t("سياسة الجلسات", "Session policy")} icon={<LockKeyhole size={14} aria-hidden />} testId="security-policy">
        <ul className="space-y-2 text-sm leading-6 text-ink-2">
          <li data-testid="security-max-age">{t(`جلسة عضو الفريق تنتهي بعد ${data.sessionDays} أيام كحد أقصى، حتى لو بقي الجهاز مفتوحًا.`, `A staff session ends after at most ${data.sessionDays} days, even if the device stays signed in.`)}</li>
          <li>{t("«إنهاء كل الجلسات» يوقف كل الأجهزة فورًا (المتصفح، التطبيق المثبت، والأجهزة الأخرى).", "“End all sessions” stops every device immediately (browser, installed app and other devices).")}</li>
          <li>{t("تغيير الدور يسري على الطلب التالي مباشرة؛ الصلاحيات تُقرأ من قاعدة البيانات بكل طلب.", "Role changes apply on the very next request; permissions are read from the database every time.")}</li>
          <li>{t("كلمات مرور الاشتراكات مخفية افتراضيًا، وكل «إظهار» يُسجَّل في سجل التدقيق.", "Subscription passwords are hidden by default, and every reveal is written to the audit log.")}</li>
        </ul>
        <p className="mt-3 text-xs text-ink-3">
          {t("لا تُخزَّن الجلسات بشكل منفصل، لذلك لا توجد قائمة أجهزة. لإدارة جلساتك أنت: ", "Sessions aren't stored individually, so there's no device list. For your own sessions: ")}
          <Link href="/admin/security" className="font-semibold text-brand-ink hover:underline">{t("الأمان والجلسات الشخصية", "your security page")}</Link>
        </p>
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title={t("آخر إنهاء لجلسات الفريق", "Sessions last ended")} icon={<History size={14} aria-hidden />} action={{ href: "/admin/system/staff", label: t("فريق العمل", "Staff") }} testId="security-revocations">
          {!data.revocations?.ok ? (
            <SectionError label={t("تعذر تحميل الجلسات.", "Couldn't load sessions.")} />
          ) : data.revocations.data.length ? (
            <ul className="divide-y divide-line/60">
              {data.revocations.data.map((row) => (
                <li key={row.userId} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm" data-testid="security-revocation" data-user={row.userId}>
                  <span className="min-w-0">
                    <span className="font-semibold text-ink">{row.name}</span> <Badge className="ms-1">{ROLE_LABELS[row.role]?.[lang] ?? row.role}</Badge>
                    <span className="block text-xs text-ink-3">{row.by === "SELF" ? t("بنفسه (كل الأجهزة)", "by themselves (all devices)") : row.by ? t(`بواسطة ${row.by}`, `by ${row.by}`) : "—"}</span>
                  </span>
                  <span className="nums text-xs text-ink-3">{row.revokedAt ? formatDateTime(row.revokedAt, lang) : "—"}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyLine>{t("لم تُنهَ جلسات أي عضو بعد.", "No one's sessions have been ended yet.")}</EmptyLine>
          )}
        </SectionCard>

        <SectionCard title={t("أحداث أمنية حديثة", "Recent security events")} icon={<ShieldAlert size={14} aria-hidden />} action={can("audit") ? { href: "/admin/audit?staff=1", label: t("سجل التدقيق", "Audit log") } : undefined} testId="security-events">
          {!data.events?.ok ? (
            <SectionError label={t("تعذر تحميل الأحداث الأمنية.", "Couldn't load security events.")} />
          ) : data.events.data.length ? (
            <ul className="divide-y divide-line/60">
              {data.events.data.map((event) => (
                <li key={event.id} className="py-2.5 text-sm" data-testid="security-event" data-action={event.action}>
                  <p className="text-ink">{event.summary}</p>
                  <p className="nums text-xs text-ink-3">{event.actorName ?? t("النظام", "System")} · {event.action} · {formatDateTime(event.createdAt, lang)}</p>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyLine>{t("لا توجد أحداث أمنية مسجلة.", "No security events recorded.")}</EmptyLine>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
