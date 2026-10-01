import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";

import { SystemHeader } from "@/app/components/admin/system/SystemUI";
import { SectionError } from "@/app/components/admin/dashboard/DashboardUI";
import { Forbidden } from "@/app/components/admin/Forbidden";
import { Badge } from "@/app/ui/Badge";
import { DataTable } from "@/app/ui/DataTable";
import { Select } from "@/app/ui/Field";
import { Pagination } from "@/app/ui/Pagination";
import { EmptyState } from "@/app/ui/States";
import { formatDateTime } from "@/src/lib/i18n";
import { hasPermission } from "@/src/lib/roles";
import { AUDIT_ENTITIES, AUDIT_PAGE, parseAuditQuery } from "@/src/lib/system";
import { requireStaffPage } from "@/src/server/auth";
import { getI18n } from "@/src/server/i18n";
import { listAudit } from "@/src/server/system";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "سجل التدقيق" };

/**
 * The audit log (ActivityEvent, written by logActivity) — read-only. Filters,
 * counting and paging run in SQL; the legacy ?type= and ?staff=1 parameters
 * keep working. Entries can't be edited or deleted from the console.
 */
export default async function AuditPage({ searchParams }: { searchParams: Promise<{ q?: string; entity?: string; type?: string; action?: string; actor?: string; staff?: string; since?: string; page?: string }> }) {
  const params = await searchParams;
  const { user, allowed } = await requireStaffPage("/admin/audit", "audit");

  if (!allowed) {
    return <Forbidden />;
  }

  const { t, lang } = await getI18n();
  const query = parseAuditQuery(params);
  const result = await listAudit(query);
  const pageParams = {
    q: query.q || undefined,
    entity: query.entity !== "all" ? query.entity : undefined,
    action: query.action !== "all" ? query.action : undefined,
    actor: typeof query.actor === "number" ? String(query.actor) : undefined,
    staff: query.actor === "staff" ? "1" : undefined,
    since: query.since !== "all" ? query.since : undefined,
  };

  return (
    <div className="space-y-5" data-testid="audit-page">
      <SystemHeader
        active="audit"
        t={t}
        can={(permission) => hasPermission(user.role, permission)}
        title={t("سجل التدقيق", "Audit log")}
        description={result?.ok ? <span data-testid="audit-count">{t(`${result.data.total} حدث`, `${result.data.total} events`)}</span> : t("كل إجراء مهم يسجَّل مع من نفذه ومتى.", "Every important action with who did it and when.")}
      />

      <form role="search" className="glass-soft grid gap-2 rounded-2xl p-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))_auto]" data-testid="audit-filters">
        {typeof query.actor === "number" ? <input type="hidden" name="actor" value={query.actor} /> : null}
        <label className="relative min-w-0">
          <span className="sr-only">{t("بحث في الوصف", "Search the summary")}</span>
          <Search size={15} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden />
          <input name="q" defaultValue={query.q} data-testid="audit-search" placeholder={t("ابحث في وصف الإجراء", "Search the action summary")} className="h-10 w-full rounded-xl border border-line bg-surface ps-9 pe-3 text-sm text-ink placeholder:text-ink-3 focus:border-brand focus:outline-none" />
        </label>
        <label className="min-w-0">
          <span className="sr-only">{t("النوع", "Entity")}</span>
          <Select name="entity" defaultValue={query.entity} className="py-2 text-sm" data-testid="audit-entity">
            <option value="all">{t("كل الأنواع", "All entities")}</option>
            {AUDIT_ENTITIES.map((entity) => <option key={entity} value={entity}>{entity}</option>)}
          </Select>
        </label>
        <label className="min-w-0">
          <span className="sr-only">{t("الإجراء", "Action")}</span>
          <Select name="action" defaultValue={query.action} className="py-2 text-sm" data-testid="audit-action">
            <option value="all">{t("كل الإجراءات", "All actions")}</option>
            {(result?.ok ? result.data.actions : []).map((action) => <option key={action} value={action}>{action}</option>)}
          </Select>
        </label>
        <label className="min-w-0">
          <span className="sr-only">{t("الفترة", "Period")}</span>
          <Select name="since" defaultValue={query.since} className="py-2 text-sm" data-testid="audit-since">
            <option value="all">{t("كل الوقت", "All time")}</option>
            <option value="24h">{t("آخر 24 ساعة", "Last 24 hours")}</option>
            <option value="7d">{t("آخر 7 أيام", "Last 7 days")}</option>
            <option value="30d">{t("آخر 30 يوم", "Last 30 days")}</option>
          </Select>
        </label>
        <button type="submit" className="h-10 rounded-xl bg-brand px-4 text-sm font-bold text-white hover:bg-brand-strong">{t("تصفية", "Filter")}</button>
        <label className="flex items-center gap-2 px-1 text-xs text-ink-2 sm:col-span-2 lg:col-span-5">
          <input type="checkbox" name="staff" value="1" defaultChecked={query.actor === "staff"} className="accent-brand" />
          {t("إجراءات الفريق فقط", "Staff actions only")}
          {typeof query.actor === "number" ? (
            <Link href="/admin/audit" className="ms-auto font-semibold text-brand-ink hover:underline" data-testid="audit-actor-clear">{t(`منفّذ #${query.actor} — إزالة`, `Actor #${query.actor} — clear`)}</Link>
          ) : null}
        </label>
      </form>

      {!result?.ok ? (
        <SectionError label={t("تعذر تحميل سجل التدقيق.", "Couldn't load the audit log.")} />
      ) : (
        <>
          <DataTable
            caption={t("سجل التدقيق", "Audit log")}
            rows={result.data.rows}
            rowKey={(event) => event.id}
            empty={<EmptyState title={t("ماكو أحداث مطابقة", "No matching events")} />}
            columns={[
              { key: "time", header: t("الوقت", "Time"), cell: (event) => <span className="nums whitespace-nowrap text-xs">{formatDateTime(event.createdAt, lang)}</span> },
              {
                key: "actor",
                header: t("المنفّذ", "Actor"),
                cell: (event) =>
                  event.actorUserId ? (
                    <Link href={`/admin/audit?actor=${event.actorUserId}`} className="hover:text-brand-ink" data-testid="audit-actor">
                      {event.actorName}
                      {event.actorRole ? <Badge className="ms-1">{event.actorRole}</Badge> : null}
                    </Link>
                  ) : (
                    <span className="text-ink-3">{t("النظام / زائر", "System / visitor")}</span>
                  ),
              },
              {
                key: "summary",
                header: t("الإجراء", "Action"),
                cell: (event) => (
                  <details className="group" data-testid="audit-row" data-action={event.action}>
                    <summary className="cursor-pointer list-none text-ink">
                      {event.summary}
                      <span className="nums block text-[11px] text-ink-3" dir="ltr">{event.action}{event.entityId ? ` · ${event.entityType} #${event.entityId}` : ""}</span>
                    </summary>
                    {event.details ? <pre className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-white/[0.03] p-2 text-[11px] leading-5 text-ink-2" dir="ltr" data-testid="audit-details">{event.details}</pre> : null}
                  </details>
                ),
              },
              {
                key: "customer",
                header: t("العميل", "Customer"),
                hideOnMobile: true,
                cell: (event) => (event.userId ? <Link href={`/admin/customers/${event.userId}`} className="hover:text-ink">{event.userName}</Link> : "—"),
              },
              { key: "type", header: t("النوع", "Type"), hideOnMobile: true, cell: (event) => <Badge>{event.entityType}</Badge> },
            ]}
          />
          <Pagination page={query.page} pageCount={Math.max(1, Math.ceil(result.data.total / AUDIT_PAGE))} basePath="/admin/audit" params={pageParams} lang={lang} />
        </>
      )}
    </div>
  );
}
