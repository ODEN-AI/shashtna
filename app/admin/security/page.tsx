import type { Metadata } from "next";
import { Clock, KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";

import { Card, CardHeader } from "@/app/ui/Card";
import { PageHeader } from "@/app/ui/Page";
import { formatDateTime } from "@/src/lib/i18n";
import { STAFF_SESSION_MAX_AGE_SECONDS } from "@/src/lib/staff-session";
import { requireStaffPage } from "@/src/server/auth";
import { getI18n } from "@/src/server/i18n";
import { currentStaffSession } from "@/src/server/staff-sessions";

import { SignOutEverywhere } from "./SignOutEverywhere";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "الأمان والجلسات" };

/** Every staff member's own security page (no extra permission needed). */
export default async function SecurityPage() {
  const { user } = await requireStaffPage("/admin/security");
  const [{ t, lang }, session] = await Promise.all([getI18n(), currentStaffSession(user.id)]);
  const days = STAFF_SESSION_MAX_AGE_SECONDS / 86400;

  return (
    <div className="space-y-6" data-testid="security-page">
      <PageHeader
        title={t("الأمان والجلسات", "Security & sessions")}
        description={t("تحكم بجلسات دخولك للوحة الإدارة على كل أجهزتك.", "Control your admin sign-ins across all your devices.")}
      />

      <Card className="p-6">
        <CardHeader title={t("هذه الجلسة", "This session")} />
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-line bg-surface-2 p-4">
            <dt className="flex items-center gap-2 text-xs font-semibold text-ink-3"><Clock size={14} aria-hidden />{t("بدأت", "Signed in")}</dt>
            <dd className="nums mt-1 font-bold text-ink" data-testid="session-issued">{session.issuedAt ? formatDateTime(new Date(session.issuedAt), lang) : "—"}</dd>
          </div>
          <div className="rounded-2xl border border-line bg-surface-2 p-4">
            <dt className="flex items-center gap-2 text-xs font-semibold text-ink-3"><LockKeyhole size={14} aria-hidden />{t("تنتهي تلقائيًا", "Ends automatically")}</dt>
            <dd className="nums mt-1 font-bold text-ink" data-testid="session-ends">{session.endsAt ? formatDateTime(new Date(session.endsAt), lang) : "—"}</dd>
          </div>
        </dl>
        <p className="mt-4 text-sm leading-6 text-ink-3">
          {t(
            `جلسات فريق العمل تنتهي بعد ${days} أيام كحد أقصى، حتى لو بقي الجهاز مفتوحًا.`,
            `Staff sessions end after at most ${days} days, even if the device stays signed in.`,
          )}
        </p>
      </Card>

      <Card className="p-6">
        <CardHeader
          title={t("تسجيل الخروج من كل الأجهزة", "Sign out of all devices")}
          description={t(
            "استخدمه إذا فقدت جهازًا أو سجّلت الدخول من جهاز مو إلك. كل الجلسات الحالية — هذا المتصفح، التطبيق المثبت، والأجهزة الثانية — تتوقف فورًا.",
            "Use this if you lose a device or signed in somewhere that isn't yours. Every current session — this browser, the installed app and other devices — stops immediately.",
          )}
        />
        <div className="mt-4">
          <SignOutEverywhere />
        </div>
        {session.lastRevokedAt ? (
          <p className="nums mt-4 text-xs text-ink-3" data-testid="last-revoked">
            {t("آخر خروج من كل الأجهزة:", "Last signed out everywhere:")} {formatDateTime(new Date(session.lastRevokedAt), lang)}
          </p>
        ) : null}
      </Card>

      <Card className="p-6">
        <CardHeader title={t("بيانات الاشتراكات الحساسة", "Sensitive subscription credentials")} />
        <ul className="mt-4 space-y-2 text-sm leading-6 text-ink-2">
          <li className="flex items-start gap-2"><KeyRound size={15} className="mt-1 shrink-0 text-brand-ink" aria-hidden />{t("كلمات مرور الاشتراكات مخفية افتراضيًا ولا تُرسل للمتصفح.", "Subscription passwords are hidden by default and aren't sent to the browser.")}</li>
          <li className="flex items-start gap-2"><ShieldCheck size={15} className="mt-1 shrink-0 text-brand-ink" aria-hidden />{t("كل «إظهار» يُسجَّل بسجل التدقيق باسمك ووقته.", "Every “reveal” is written to the audit log with your name and the time.")}</li>
        </ul>
      </Card>
    </div>
  );
}
