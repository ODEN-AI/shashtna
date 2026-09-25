import type { Metadata } from "next";
import Link from "next/link";

import { Forbidden } from "@/app/components/admin/Forbidden";
import { StatusBadge } from "@/app/ui/Badge";
import { Input } from "@/app/ui/Field";
import { PageHeader } from "@/app/ui/Page";
import { Pagination, paginate } from "@/app/ui/Pagination";
import { EmptyState } from "@/app/ui/States";
import { LinkTabs } from "@/app/ui/Tabs";
import { formatDateTime } from "@/src/lib/i18n";
import { getAllSupportTickets } from "@/src/lib/support-store";
import { requireStaffPage } from "@/src/server/auth";
import { getI18n } from "@/src/server/i18n";
import { TICKET_CATEGORIES, TICKET_STATUS_LABELS } from "@/src/server/tickets";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "تذاكر الدعم" };

export default async function AdminSupportPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; q?: string; category?: string; page?: string }>;
}) {
  const params = await searchParams;
  const { allowed } = await requireStaffPage("/admin/support", "support");

  if (!allowed) {
    return <Forbidden />;
  }

  const { t, lang } = await getI18n();
  const all = await getAllSupportTickets();
  const filter = ["waiting", "open", "closed", "all"].includes(String(params.filter)) ? params.filter! : "waiting";
  const q = params.q?.trim().toLowerCase() ?? "";

  const matches = (ticket: (typeof all)[number]) =>
    filter === "waiting"
      ? ticket.status !== "CLOSED" && ticket.lastSender === "CUSTOMER"
      : filter === "open"
        ? ticket.status !== "CLOSED"
        : filter === "closed"
          ? ticket.status === "CLOSED"
          : true;

  const rows = all
    .filter(matches)
    .filter((ticket) => !params.category || ticket.category === params.category)
    .filter(
      (ticket) =>
        !q ||
        ticket.subject.toLowerCase().includes(q) ||
        ticket.userName.toLowerCase().includes(q) ||
        ticket.userPhone.includes(q) ||
        ticket.id.toLowerCase().includes(q),
    );
  const { items, page, pageCount } = paginate(rows, params.page, 25);
  const tab = (key: string) => `/admin/support?${new URLSearchParams({ filter: key, ...(q ? { q } : {}) }).toString()}`;

  return (
    <div className="space-y-6">
      <PageHeader title={t("تذاكر الدعم", "Support tickets")} />
      <LinkTabs
        label={t("الفلتر", "Filter")}
        active={filter}
        tabs={[
          { key: "waiting", href: tab("waiting"), label: t("بانتظار ردنا", "Waiting on us"), count: all.filter((ticket) => ticket.status !== "CLOSED" && ticket.lastSender === "CUSTOMER").length },
          { key: "open", href: tab("open"), label: t("المفتوحة", "Open"), count: all.filter((ticket) => ticket.status !== "CLOSED").length },
          { key: "closed", href: tab("closed"), label: t("المغلقة", "Closed") },
          { key: "all", href: tab("all"), label: t("الكل", "All"), count: all.length },
        ]}
      />
      <form role="search" className="flex flex-wrap gap-2">
        <input type="hidden" name="filter" value={filter} />
        <Input name="q" defaultValue={params.q ?? ""} placeholder={t("العنوان، العميل، الهاتف أو رقم التذكرة", "Subject, customer, phone or ticket ID")} className="h-10 max-w-sm py-0" aria-label={t("بحث", "Search")} />
        <select name="category" defaultValue={params.category ?? ""} className="h-10 rounded-xl border border-line-strong bg-surface-2 px-3 text-sm text-ink" aria-label={t("النوع", "Category")}>
          <option value="">{t("كل الأنواع", "All categories")}</option>
          {TICKET_CATEGORIES.map((category) => (
            <option key={category.value} value={category.value}>
              {category[lang]}
            </option>
          ))}
        </select>
        <button type="submit" className="h-10 rounded-xl bg-brand px-4 text-sm font-semibold text-white">{t("بحث", "Search")}</button>
      </form>

      {items.length ? (
        <ul className="space-y-3">
          {items.map((ticket) => (
            <li key={ticket.id}>
              <Link
                href={`/admin/support/${encodeURIComponent(ticket.id)}`}
                className="surface flex flex-col gap-3 rounded-card p-5 transition hover:border-brand/50 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate font-bold text-ink">{ticket.subject}</p>
                  <p className="mt-1 text-xs text-ink-3">
                    {ticket.userName} · <span className="nums" dir="ltr">{ticket.userPhone}</span> ·{" "}
                    {TICKET_CATEGORIES.find((category) => category.value === ticket.category)?.[lang] ?? ticket.category} ·{" "}
                    <span className="nums">{formatDateTime(ticket.updatedAt, lang)}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {ticket.lastSender === "CUSTOMER" && ticket.status !== "CLOSED" ? (
                    <span className="text-xs font-semibold text-warning">{t("بانتظار رد", "Needs reply")}</span>
                  ) : null}
                  <StatusBadge status={ticket.status} label={TICKET_STATUS_LABELS[ticket.status]?.[lang] ?? ticket.status} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title={t("ماكو تذاكر هنا", "No tickets here")} />
      )}
      <Pagination page={page} pageCount={pageCount} basePath="/admin/support" params={{ filter, q: params.q, category: params.category }} lang={lang} />
    </div>
  );
}
