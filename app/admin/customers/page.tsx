import type { Metadata } from "next";
import Link from "next/link";
import { Search, UsersRound } from "lucide-react";

import { SectionError } from "@/app/components/admin/dashboard/DashboardUI";
import { Forbidden } from "@/app/components/admin/Forbidden";
import { Badge, StatusBadge } from "@/app/ui/Badge";
import { DataTable } from "@/app/ui/DataTable";
import { Pagination, paginate } from "@/app/ui/Pagination";
import { EmptyState } from "@/app/ui/States";
import { LinkTabs } from "@/app/ui/Tabs";
import { SUBSCRIPTION_FILTERS, parseCustomerQuery, type CustomerFilter, type CustomerStatus } from "@/src/lib/customers";
import { formatDate, translator, type Lang } from "@/src/lib/i18n";
import { ORDER_STATUS_LABELS, normalizeOrderStatus } from "@/src/lib/order-status";
import { ROLE_LABELS, hasPermission } from "@/src/lib/roles";
import { SUBSCRIPTION_STATE_LABELS } from "@/src/lib/subscription-state";
import { requireStaffPage } from "@/src/server/auth";
import { listCustomers } from "@/src/server/customers";
import { getI18n } from "@/src/server/i18n";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "العملاء" };

function customerStatusLabel(status: CustomerStatus, lang: Lang) {
  return status === "NONE" ? translator(lang)("بدون اشتراك", "No subscription") : SUBSCRIPTION_STATE_LABELS[status][lang];
}

/**
 * Customers — find a customer fast. Search covers name, phone, email and
 * IDs (customer; subscription / order where the role may see them); filters
 * come from deriveSubscriptionState. Subscription and order columns are
 * only loaded for roles with those permissions.
 */
export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; view?: string; page?: string }> }) {
  const params = await searchParams;
  const { user, allowed } = await requireStaffPage("/admin/customers", "customers");

  if (!allowed) {
    return <Forbidden />;
  }

  const { t, lang } = await getI18n();
  const requested = parseCustomerQuery(params);
  const canSubs = hasPermission(user.role, "subscriptions");
  const canOrders = hasPermission(user.role, "orders");
  // Subscription-based filters need subscription data; without the permission they fall back to "all".
  const filter: CustomerFilter = !canSubs && SUBSCRIPTION_FILTERS.includes(requested.filter) ? "all" : requested.filter;
  const result = await listCustomers(user.role, { ...requested, filter });

  if (!result.ok) {
    return (
      <div className="space-y-6">
        <h1 className="text-h2 font-bold text-ink">{t("العملاء", "Customers")}</h1>
        <SectionError label={t("تعذر تحميل العملاء. حدّث الصفحة.", "Couldn't load customers. Refresh the page.")} />
      </div>
    );
  }

  const { items, page, pageCount, total } = paginate(result.rows, requested.page, 25);
  const tab = (key: string) => `/admin/customers?${new URLSearchParams({ ...(requested.q ? { q: requested.q } : {}), view: key }).toString()}`;
  const tabs = [
    { key: "all", label: t("الكل", "All") },
    ...(canSubs
      ? [
          { key: "active", label: t("اشتراك فعّال", "Active plan") },
          { key: "expiring", label: t("تنتهي قريبًا", "Expiring soon") },
          { key: "expired", label: t("منتهية", "Expired") },
          { key: "none", label: t("بدون اشتراك", "No subscription") },
        ]
      : []),
    { key: "recent", label: t("جدد (30 يوم)", "New (30 days)") },
    { key: "staff", label: t("فريق العمل", "Staff") },
  ];

  return (
    <div className="space-y-5" data-testid="customers-index">
      <header>
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-brand-ink">
          <UsersRound size={14} aria-hidden /> Customer 360
        </p>
        <h1 className="mt-2 text-h2 font-bold text-ink">{t("العملاء", "Customers")}</h1>
        <p className="mt-1 text-sm text-ink-3" data-testid="customers-count">{t(`${total} نتيجة`, `${total} results`)}</p>
      </header>

      <LinkTabs label={t("الفلتر", "Filter")} active={filter} tabs={tabs.map((item) => ({ ...item, href: tab(item.key) }))} />

      <form role="search" className="glass-soft flex flex-wrap gap-2 rounded-2xl p-2" data-testid="customers-search-form">
        <input type="hidden" name="view" value={filter} />
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">{t("بحث", "Search")}</span>
          <Search size={15} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden />
          <input
            name="q"
            defaultValue={requested.q}
            data-testid="customers-search"
            placeholder={canOrders || canSubs ? t("الاسم، الهاتف، البريد، رقم العميل أو الطلب SH-…", "Name, phone, email, customer or order number SH-…") : t("الاسم، الهاتف، البريد أو رقم العميل", "Name, phone, email or customer number")}
            className="h-10 w-full rounded-xl border border-line bg-surface ps-9 pe-3 text-sm text-ink placeholder:text-ink-3 focus:border-brand focus:outline-none"
          />
        </label>
        <button type="submit" className="h-10 rounded-xl bg-brand px-4 text-sm font-bold text-white hover:bg-brand-strong">{t("بحث", "Search")}</button>
      </form>

      {result.subscriptionsFailed ? <SectionError label={t("تعذر تحميل بيانات الاشتراكات — الحالة غير معروضة.", "Couldn't load subscription data — status isn't shown.")} /> : null}
      {result.ordersFailed ? <SectionError label={t("تعذر تحميل بيانات الطلبات.", "Couldn't load order data.")} /> : null}

      <DataTable
        caption={t("العملاء", "Customers")}
        rows={items}
        rowKey={(row) => row.id}
        empty={<EmptyState title={t("ماكو نتائج", "No results")} description={t("جرّب بحث أو فلتر ثاني.", "Try another search or filter.")} />}
        columns={[
          {
            key: "name",
            header: t("العميل", "Customer"),
            cell: (row) => (
              <Link href={`/admin/customers/${row.id}`} className="font-bold text-ink hover:text-brand-ink" data-testid="customer-link">
                {row.name}
                <span className="nums ms-2 text-xs font-normal text-ink-3">#{row.id}</span>
                {row.staff ? <Badge tone="brand" className="ms-2">{ROLE_LABELS[row.role]?.[lang] ?? row.role}</Badge> : null}
              </Link>
            ),
          },
          {
            key: "contact",
            header: t("التواصل", "Contact"),
            cell: (row) => (
              <span className="block">
                <span className="nums block" dir="ltr">{row.phone}</span>
                {row.email ? <span className="block truncate text-xs text-ink-3">{row.email}</span> : null}
              </span>
            ),
          },
          ...(canSubs
            ? [
                {
                  key: "status",
                  header: t("الاشتراكات", "Subscriptions"),
                  cell: (row: (typeof items)[number]) =>
                    row.subscriptions ? (
                      <span className="flex flex-wrap items-center gap-2" data-testid="customer-status" data-status={row.subscriptions.status}>
                        <StatusBadge status={row.subscriptions.status} label={customerStatusLabel(row.subscriptions.status, lang)} />
                        <span className="nums text-xs text-ink-3">{row.subscriptions.active}/{row.subscriptions.total}</span>
                      </span>
                    ) : (
                      "—"
                    ),
                },
                {
                  key: "expiry",
                  header: t("الانتهاء القادم", "Next expiry"),
                  hideOnMobile: true,
                  cell: (row: (typeof items)[number]) => <span className="nums text-xs">{row.subscriptions?.nextExpiry ? formatDate(row.subscriptions.nextExpiry, lang) : "—"}</span>,
                },
              ]
            : []),
          ...(canOrders
            ? [
                {
                  key: "order",
                  header: t("آخر طلب", "Latest order"),
                  hideOnMobile: true,
                  cell: (row: (typeof items)[number]) =>
                    row.latestOrder ? (
                      <Link href={`/admin/orders/${row.latestOrder.id}`} className="flex flex-wrap items-center gap-2 hover:text-ink">
                        <span className="nums text-xs font-semibold">{row.latestOrder.number}</span>
                        <StatusBadge status={normalizeOrderStatus(row.latestOrder.status)} label={ORDER_STATUS_LABELS[normalizeOrderStatus(row.latestOrder.status)][lang]} />
                      </Link>
                    ) : (
                      <span className="text-xs text-ink-3">—</span>
                    ),
                },
              ]
            : []),
          { key: "joined", header: t("انضم", "Joined"), hideOnMobile: true, cell: (row) => <span className="nums text-xs">{formatDate(row.createdAt, lang)}</span> },
        ]}
      />
      <Pagination page={page} pageCount={pageCount} basePath="/admin/customers" params={{ q: requested.q || undefined, view: filter }} lang={lang} />
    </div>
  );
}
