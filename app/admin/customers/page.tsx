import type { Metadata } from "next";
import Link from "next/link";

import { Forbidden } from "@/app/components/admin/Forbidden";
import { Badge } from "@/app/ui/Badge";
import { DataTable } from "@/app/ui/DataTable";
import { Input } from "@/app/ui/Field";
import { PageHeader } from "@/app/ui/Page";
import { Pagination, paginate } from "@/app/ui/Pagination";
import { EmptyState } from "@/app/ui/States";
import { LinkTabs } from "@/app/ui/Tabs";
import { formatDate } from "@/src/lib/i18n";
import { ROLE_LABELS, isStaffRole } from "@/src/lib/roles";
import { deriveSubscriptionState } from "@/src/lib/subscription-state";
import { db } from "@/src/prisma/db";
import { requireStaffPage } from "@/src/server/auth";
import { getI18n } from "@/src/server/i18n";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "العملاء" };

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; view?: string; page?: string }>;
}) {
  const params = await searchParams;
  const { allowed } = await requireStaffPage("/admin/customers", "customers");

  if (!allowed) {
    return <Forbidden />;
  }

  const { t, lang } = await getI18n();
  const [users, subscriptions, orderCounts] = await Promise.all([
    db.orm.public.User.orderBy((user) => user.id.desc()).all(),
    db.orm.public.Subscription.select("userId", "status", "expiryDate").all(),
    db.orm.public.SubscriptionRequest.groupBy("userId").aggregate((aggregate) => ({ orders: aggregate.count() })),
  ]);

  const ordersByUser = new Map(orderCounts.map((row) => [row.userId, row.orders]));
  const subsByUser = new Map<number, { total: number; active: number }>();

  for (const subscription of subscriptions) {
    const entry = subsByUser.get(subscription.userId) ?? { total: 0, active: 0 };
    entry.total += 1;

    const state = deriveSubscriptionState(subscription);

    if (state === "ACTIVE" || state === "EXPIRING") {
      entry.active += 1;
    }

    subsByUser.set(subscription.userId, entry);
  }

  const q = params.q?.trim().toLowerCase() ?? "";
  const view = ["active", "none", "staff"].includes(String(params.view)) ? params.view! : "all";

  const rows = users
    .map((user) => ({
      ...user,
      subs: subsByUser.get(user.id) ?? { total: 0, active: 0 },
      orders: ordersByUser.get(user.id) ?? 0,
      staff: isStaffRole(user.role),
    }))
    .filter((user) => !q || user.name.toLowerCase().includes(q) || user.phone.includes(q) || String(user.email ?? "").toLowerCase().includes(q))
    .filter((user) =>
      view === "active" ? user.subs.active > 0 : view === "none" ? user.subs.total === 0 && !user.staff : view === "staff" ? user.staff : true,
    );

  const { items, page, pageCount } = paginate(rows, params.page, 25);
  const tab = (key: string) => `/admin/customers?${new URLSearchParams({ ...(q ? { q } : {}), view: key }).toString()}`;

  return (
    <div className="space-y-6">
      <PageHeader title={t("العملاء", "Customers")} description={t(`${rows.length} نتيجة`, `${rows.length} results`)} />
      <LinkTabs
        label={t("الفلتر", "Filter")}
        active={view}
        tabs={[
          { key: "all", href: tab("all"), label: t("الكل", "All") },
          { key: "active", href: tab("active"), label: t("لديهم اشتراك فعال", "With an active plan") },
          { key: "none", href: tab("none"), label: t("بدون اشتراك", "No subscription") },
          { key: "staff", href: tab("staff"), label: t("فريق العمل", "Staff") },
        ]}
      />
      <form role="search" className="flex gap-2">
        <input type="hidden" name="view" value={view} />
        <Input name="q" defaultValue={params.q ?? ""} placeholder={t("الاسم، الهاتف أو البريد", "Name, phone or email")} className="h-10 max-w-sm py-0" aria-label={t("بحث", "Search")} />
        <button type="submit" className="h-10 rounded-xl bg-brand px-4 text-sm font-semibold text-white">{t("بحث", "Search")}</button>
      </form>

      <DataTable
        caption={t("العملاء", "Customers")}
        rows={items}
        rowKey={(user) => user.id}
        empty={<EmptyState title={t("ماكو نتائج", "No results")} />}
        columns={[
          {
            key: "name",
            header: t("العميل", "Customer"),
            cell: (user) => (
              <Link href={`/admin/customers/${user.id}`} className="font-bold text-ink hover:text-brand-ink">
                {user.name}
                {user.staff ? <Badge tone="brand" className="ms-2">{ROLE_LABELS[user.role]?.[lang] ?? user.role}</Badge> : null}
              </Link>
            ),
          },
          { key: "phone", header: t("الهاتف", "Phone"), cell: (user) => <span className="nums" dir="ltr">{user.phone}</span> },
          {
            key: "subs",
            header: t("الاشتراكات", "Subscriptions"),
            cell: (user) => (
              <span className="nums">
                {user.subs.active}/{user.subs.total}
                <span className="ms-1 text-xs text-ink-3">{t("فعال", "active")}</span>
              </span>
            ),
          },
          { key: "orders", header: t("الطلبات", "Orders"), cell: (user) => <span className="nums">{user.orders}</span>, hideOnMobile: true },
          { key: "joined", header: t("انضم", "Joined"), cell: (user) => <span className="nums text-xs">{formatDate(String(user.createdAt), lang)}</span>, hideOnMobile: true },
        ]}
      />
      <Pagination page={page} pageCount={pageCount} basePath="/admin/customers" params={{ q: params.q, view }} lang={lang} />
    </div>
  );
}
