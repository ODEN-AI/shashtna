import type { Metadata } from "next";
import { AlertTriangle, History, Inbox, PlayCircle, RotateCcw, Settings } from "lucide-react";

import { retryOutboxAction, runNowAction } from "@/app/admin/today/actions";
import { EmptyLine, SectionCard } from "@/app/components/admin/dashboard/DashboardUI";
import { Forbidden } from "@/app/components/admin/Forbidden";
import { ActionForm } from "@/app/ui/ActionForm";
import { Badge } from "@/app/ui/Badge";
import { LinkButton } from "@/app/ui/Button";
import { PageHeader } from "@/app/ui/Page";
import { Notice } from "@/app/ui/States";
import { SubmitButton } from "@/app/ui/SubmitButton";
import { JOBS, MAX_ATTEMPTS, runKey, type Job } from "@/src/lib/automation";
import { formatDateTime } from "@/src/lib/i18n";
import { isFullAccess } from "@/src/lib/system";
import { requireStaffPage } from "@/src/server/auth";
import { JOB_LABELS, jobsOverview } from "@/src/server/automation";
import { getI18n } from "@/src/server/i18n";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "المهام" };

const STATUS_TONE: Record<string, "success" | "danger" | "warning" | "neutral"> = { SUCCEEDED: "success", FAILED: "danger", RUNNING: "warning" };

/** The counts a run stored (never customer data), as a short line. */
function statsLine(stats: Record<string, unknown> | null) {
  if (!stats) return null;

  return Object.entries(stats)
    .filter(([, value]) => typeof value === "number" || typeof value === "boolean")
    .map(([key, value]) => `${key} ${value === true ? "✓" : value === false ? "—" : value}`)
    .join(" · ");
}

/**
 * Admin → Jobs: what the automation did — recent runs per job (status,
 * attempts, timings, counts, errors) and in-app messages that didn't go
 * through. Retrying is the owner's; the services check again.
 */
export default async function JobsPage() {
  const { user, allowed } = await requireStaffPage("/admin/jobs", "orders");

  if (!allowed) {
    return <Forbidden />;
  }

  const isOwner = isFullAccess(user.role);
  const [{ t, lang }, overview] = await Promise.all([getI18n(), jobsOverview()]);
  const todayKeys = new Map(JOBS.map((job) => [job, runKey(job)]));

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("المهام", "Jobs")}
        description={t(
          `شنو سوّت الأتمتة: كل تشغيل بحالته ومحاولاته (لحد ${MAX_ATTEMPTS})، والرسائل اللي ما وصلت. الفحص كل ساعة يعيد المحاولة تلقائياً.`,
          `What the automation did: every run with its status and attempts (up to ${MAX_ATTEMPTS}), and messages that didn't arrive. The hourly check retries by itself.`,
        )}
        actions={
          <LinkButton href="/admin/settings#automation" variant="ghost" size="sm">
            <Settings size={15} aria-hidden />
            {t("إعدادات الأتمتة", "Automation settings")}
          </LinkButton>
        }
      />

      {overview.missed.length ? (
        <Notice tone="danger" title={t("المهمة الصباحية ما اشتغلت اليوم", "The morning job didn't run today")}>
          <span data-testid="jobs-heartbeat">{t(`ما نجح اليوم لحد هسه: ${overview.missed.map((job) => JOB_LABELS[job].ar).join("، ")}.`, `Not succeeded yet today: ${overview.missed.map((job) => JOB_LABELS[job].en).join(", ")}.`)}</span>
        </Notice>
      ) : null}
      {!overview.settings.enabled ? (
        <Notice tone="info" title={t("الأتمتة متوقفة", "Automation is off")}>
          {t("ما يشتغل شي تلقائياً لحد ما تشغّلها من الإعدادات.", "Nothing runs automatically until you turn it on in Settings.")}
        </Notice>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {JOBS.map((job: Job) => {
          const today = overview.runs.find((run) => run.runKey === todayKeys.get(job));
          const on = overview.settings.enabled && overview.settings.jobs[job];

          return (
            <SectionCard key={job} title={t(JOB_LABELS[job].ar, JOB_LABELS[job].en)} icon={<PlayCircle size={14} aria-hidden />} testId={`jobs-today-${job}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1 text-sm">
                  <p className="flex flex-wrap items-center gap-2">
                    <Badge tone={on ? "success" : "neutral"}>{on ? t("مفعّلة", "On") : t("متوقفة", "Off")}</Badge>
                    {today ? (
                      <Badge tone={STATUS_TONE[today.status] ?? "neutral"}>
                        {t("اليوم:", "Today:")} {today.status} · {t(`محاولة ${today.attempts}/${MAX_ATTEMPTS}`, `attempt ${today.attempts}/${MAX_ATTEMPTS}`)}
                      </Badge>
                    ) : (
                      <Badge tone="neutral">{t("ما اشتغلت اليوم", "Not run today")}</Badge>
                    )}
                  </p>
                  {today?.status === "FAILED" ? (
                    <p className="text-xs leading-6 text-ink-3">
                      {today.nextAttemptAt
                        ? t(`إعادة تلقائية بعد ${formatDateTime(today.nextAttemptAt, lang)}`, `Automatic retry after ${formatDateTime(today.nextAttemptAt, lang)}`)
                        : t("خلصت المحاولات لليوم؛ تنعاد بكرة الصبح.", "Out of attempts for today; it runs again tomorrow morning.")}
                    </p>
                  ) : null}
                </div>
                {/* Nothing to press while it runs, after it succeeded, or once it is out of attempts. */}
                {isOwner && on && today?.status !== "SUCCEEDED" && today?.status !== "RUNNING" && !(today && today.attempts >= MAX_ATTEMPTS && today.status === "FAILED") ? (
                  <ActionForm action={runNowAction}>
                    <input type="hidden" name="job" value={job} />
                    <SubmitButton size="sm" variant="secondary" pendingLabel={t("جاري…", "Running…")}>
                      <RotateCcw size={15} aria-hidden />
                      {today?.status === "FAILED" ? t("إعادة المحاولة هسه", "Retry now") : t("شغّل هسه", "Run now")}
                    </SubmitButton>
                  </ActionForm>
                ) : null}
              </div>
            </SectionCard>
          );
        })}
      </div>

      <SectionCard title={t("آخر التشغيلات", "Recent runs")} icon={<History size={14} aria-hidden />} testId="jobs-runs">
        {overview.runs.length ? (
          <ul className="divide-y divide-line">
            {overview.runs.map((run) => (
              <li key={run.id} className="space-y-1 py-3 text-sm" data-testid="jobs-run">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-ink">{JOB_LABELS[run.job as Job] ? t(JOB_LABELS[run.job as Job].ar, JOB_LABELS[run.job as Job].en) : run.job}</span>
                  <span className="nums text-ink-3">{run.runKey.split(":")[1]}</span>
                  <Badge tone={STATUS_TONE[run.status] ?? "neutral"}>{run.status}</Badge>
                  <Badge tone="neutral">
                    {t(`محاولات ${run.attempts}`, `${run.attempts} attempts`)} · {run.trigger}
                  </Badge>
                </p>
                <p className="nums text-xs leading-6 text-ink-3">
                  {formatDateTime(run.startedAt, lang)}
                  {run.finishedAt ? ` → ${formatDateTime(run.finishedAt, lang)}` : ""}
                  {statsLine(run.stats) ? ` · ${statsLine(run.stats)}` : ""}
                </p>
                {run.errorLog.length || run.error ? (
                  <ul className="space-y-0.5 text-xs leading-6 text-danger" dir="ltr">
                    {(run.errorLog.length ? run.errorLog : [{ attempt: run.attempts, at: run.finishedAt ?? run.startedAt, error: run.error ?? "" }]).map((entry) => (
                      <li key={`${entry.attempt}-${entry.at}`} className="flex gap-2">
                        <AlertTriangle size={12} className="mt-1.5 shrink-0" aria-hidden />
                        <span className="break-all">
                          #{entry.attempt} · {entry.error}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyLine>{t("ما اشتغلت أي مهمة بعد.", "No runs yet.")}</EmptyLine>
        )}
      </SectionCard>

      <SectionCard title={t("رسائل ما وصلت", "Messages that didn't arrive")} icon={<Inbox size={14} aria-hidden />} testId="jobs-outbox">
        {overview.outbox.length ? (
          <ul className="divide-y divide-line">
            {overview.outbox.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm" data-testid="jobs-outbox-row">
                <div className="space-y-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="nums font-semibold text-ink">#{row.id}</span>
                    <Badge tone="neutral">{row.template}</Badge>
                    <Badge tone={row.final ? "danger" : "warning"}>
                      {row.final ? t("فشلت نهائياً", "Failed for good") : row.status} · {t(`محاولات ${row.attempts}/${MAX_ATTEMPTS}`, `${row.attempts}/${MAX_ATTEMPTS} attempts`)}
                    </Badge>
                  </p>
                  <p className="nums text-xs text-ink-3">
                    {formatDateTime(row.createdAt, lang)}
                    {row.nextAttemptAt && !row.final ? ` · ${t("المحاولة الجاية", "next")} ${formatDateTime(row.nextAttemptAt, lang)}` : ""}
                  </p>
                </div>
                {isOwner ? (
                  <ActionForm action={retryOutboxAction}>
                    <input type="hidden" name="outboxId" value={row.id} />
                    <SubmitButton size="sm" variant="secondary" pendingLabel={t("جاري…", "Retrying…")}>
                      <RotateCcw size={15} aria-hidden />
                      {t("إعادة المحاولة", "Retry")}
                    </SubmitButton>
                  </ActionForm>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyLine>{t("كل الرسائل وصلت.", "Every message arrived.")}</EmptyLine>
        )}
      </SectionCard>
    </div>
  );
}
