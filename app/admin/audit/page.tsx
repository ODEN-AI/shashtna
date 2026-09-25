import type { Metadata } from "next";
import Link from "next/link";

import { Forbidden } from "@/app/components/admin/Forbidden";
import { Badge } from "@/app/ui/Badge";
import { DataTable } from "@/app/ui/DataTable";
import { PageHeader } from "@/app/ui/Page";
import { Pagination, paginate } from "@/app/ui/Pagination";
import { EmptyState } from "@/app/ui/States";
import { formatDateTime } from "@/src/lib/i18n";
import { db } from "@/src/prisma/db";
import { customersById } from "@/src/server/admin-data";
import { requireStaffPage } from "@/src/server/auth";
import { getI18n } from "@/src/server/i18n";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "سجل التدقيق" };

const ENTITY_TYPES = ["ORDER", "SUBSCRIPTION", "TICKET", "ANNOUNCEMENT", "INCIDENT", "SETTING", "STAFF", "USER", "LEAD", "PASSWORD_RESET", "NOTIFICATION"];

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ type?: string; staff?: string; page?: string }> }) {
  const params = await searchParams;
  const { allowed } = await requireStaffPage("/admin/audit", "audit");

  if (!allowed) {
    return <Forbidden />;
  }

  const { t, lang } = await getI18n();
  let query = db.orm.public.ActivityEvent.orderBy((event) => event.id.desc());

  if (params.type && ENTITY_TYPES.includes(params.type)) {
    query = query.where({ entityType: params.type });
  }

  if (params.staff === "1") {
    query = query.where((event) => event.actorRole.neq("CUSTOMER"));
  }

  const events = await query.limit(1000).all();
  const people = await customersById(events.flatMap((event) => [event.actorUserId ?? 0, event.userId ?? 0]));
  const { items, page, pageCount } = paginate(events, params.page, 40);

  return (
    <div className="space-y-6">
      <PageHeader title={t("سجل التدقيق", "Audit log")} description={t("كل إجراء مهم يسجَّل مع من نفذه ومتى (آخر 1000 حدث).", "Every important action with who did it and when (last 1,000 events).")} />
      <form className="flex flex-wrap gap-2">
        <select name="type" defaultValue={params.type ?? ""} className="h-10 rounded-xl border border-line-strong bg-surface-2 px-3 text-sm text-ink" aria-label={t("النوع", "Type")}>
          <option value="">{t("كل الأنواع", "All types")}</option>
          {ENTITY_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
        </select>
        <label className="flex h-10 items-center gap-2 rounded-xl border border-line-strong bg-surface-2 px-3 text-sm text-ink-2">
          <input type="checkbox" name="staff" value="1" defaultChecked={params.staff === "1"} className="accent-[#2f6bff]" />
          {t("إجراءات الفريق فقط", "Staff actions only")}
        </label>
        <button type="submit" className="h-10 rounded-xl bg-brand px-4 text-sm font-semibold text-white">{t("تصفية", "Filter")}</button>
      </form>
      <DataTable
        caption={t("سجل التدقيق", "Audit log")}
        rows={items}
        rowKey={(event) => event.id}
        empty={<EmptyState title={t("ماكو أحداث", "No events")} />}
        columns={[
          { key: "time", header: t("الوقت", "Time"), cell: (event) => <span className="nums text-xs">{formatDateTime(event.createdAt, lang)}</span> },
          {
            key: "actor",
            header: t("المنفّذ", "Actor"),
            cell: (event) =>
              event.actorUserId ? (
                <span>
                  {people.get(event.actorUserId)?.name ?? `#${event.actorUserId}`}
                  {event.actorRole ? <Badge className="ms-1">{event.actorRole}</Badge> : null}
                </span>
              ) : (
                <span className="text-ink-3">{t("النظام / زائر", "System / visitor")}</span>
              ),
          },
          { key: "summary", header: t("الإجراء", "Action"), cell: (event) => <span className="text-ink">{event.summary}</span> },
          {
            key: "customer",
            header: t("العميل", "Customer"),
            hideOnMobile: true,
            cell: (event) =>
              event.userId ? (
                <Link href={`/admin/customers/${event.userId}`} className="hover:text-ink">
                  {people.get(event.userId)?.name ?? `#${event.userId}`}
                </Link>
              ) : (
                "—"
              ),
          },
          { key: "type", header: t("النوع", "Type"), hideOnMobile: true, cell: (event) => <Badge>{event.entityType}</Badge> },
        ]}
      />
      <Pagination page={page} pageCount={pageCount} basePath="/admin/audit" params={{ type: params.type, staff: params.staff }} lang={lang} />
    </div>
  );
}
