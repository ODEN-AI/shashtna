import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, PackageSearch, ReceiptText } from "lucide-react";

import { StatusBadge } from "@/app/ui/Badge";
import { LinkButton } from "@/app/ui/Button";
import { DataTable } from "@/app/ui/DataTable";
import { PageHeader } from "@/app/ui/Page";
import { EmptyState } from "@/app/ui/States";
import { LinkTabs } from "@/app/ui/Tabs";
import { formatDate, formatPrice } from "@/src/lib/i18n";
import { ORDER_STATUS_LABELS, REQUEST_TYPE_LABELS } from "@/src/lib/order-status";
import { requireCustomer } from "@/src/server/auth";
import { getI18n } from "@/src/server/i18n";
import { listOrdersForUser } from "@/src/server/orders";
import { listReceiptsForUser } from "@/src/server/subscriptions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "الطلبات والإيصالات" };

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const user = await requireCustomer(tab ? `/orders?tab=${tab}` : "/orders");
  const [{ t, lang }, orders, receipts] = await Promise.all([
    getI18n(),
    listOrdersForUser(user.id),
    listReceiptsForUser(user.id),
  ]);
  const active = tab === "receipts" ? "receipts" : "orders";

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("الطلبات والإيصالات", "Orders & receipts")}
        description={t("كل طلباتك وحالتها، وإيصالات الدفع.", "All your orders, their status and payment receipts.")}
        actions={<LinkButton href="/plans">{t("طلب جديد", "New order")}</LinkButton>}
      />
      <LinkTabs
        label={t("الأقسام", "Sections")}
        active={active}
        tabs={[
          { key: "orders", href: "/orders", label: t("الطلبات", "Orders"), count: orders.length },
          { key: "receipts", href: "/orders?tab=receipts", label: t("الإيصالات", "Receipts"), count: receipts.length },
        ]}
      />

      {active === "orders" ? (
        <DataTable
          caption={t("الطلبات", "Orders")}
          rows={orders}
          rowKey={(order) => order.id}
          empty={
            <EmptyState
              icon={<PackageSearch size={22} aria-hidden />}
              title={t("ماكو طلبات بعد", "No orders yet")}
              description={t("أول ما ترسل طلب، راح يظهر هنا مع حالته.", "Once you place an order, it appears here with its status.")}
              action={<LinkButton href="/plans">{t("شوف الباقات", "See plans")}</LinkButton>}
            />
          }
          columns={[
            {
              key: "number",
              header: t("الطلب", "Order"),
              cell: (order) => (
                <Link href={`/orders/${order.id}`} className="font-bold text-ink hover:text-brand-ink">
                  <span className="nums">{order.number}</span>
                  <span className="block text-xs font-normal text-ink-3">{order.serviceName}</span>
                </Link>
              ),
            },
            {
              key: "type",
              header: t("النوع", "Type"),
              cell: (order) => REQUEST_TYPE_LABELS[order.requestType]?.[lang] ?? order.requestType,
              hideOnMobile: true,
            },
            { key: "date", header: t("التاريخ", "Date"), cell: (order) => <span className="nums">{formatDate(order.createdAt, lang)}</span> },
            { key: "price", header: t("المبلغ", "Amount"), cell: (order) => <span className="nums font-semibold text-ink">{formatPrice(order.price, lang)}</span> },
            {
              key: "status",
              header: t("الحالة", "Status"),
              cell: (order) => <StatusBadge status={order.status} label={ORDER_STATUS_LABELS[order.status][lang]} />,
            },
            {
              key: "open",
              header: <span className="sr-only">{t("فتح", "Open")}</span>,
              cell: (order) => (
                <Link href={`/orders/${order.id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-ink hover:text-ink">
                  {t("التفاصيل", "Details")}
                  <ChevronLeft size={15} className="ltr:rotate-180" aria-hidden />
                </Link>
              ),
            },
          ]}
        />
      ) : (
        <DataTable
          caption={t("الإيصالات", "Receipts")}
          rows={receipts}
          rowKey={(receipt) => receipt.id}
          empty={
            <EmptyState
              icon={<ReceiptText size={22} aria-hidden />}
              title={t("ماكو إيصالات بعد", "No receipts yet")}
              description={t("الإيصال يصدر بعد تفعيل الاشتراك أو التجديد.", "A receipt is issued once a subscription or renewal is activated.")}
            />
          }
          columns={[
            {
              key: "number",
              header: t("رقم الإيصال", "Receipt"),
              cell: (receipt) => (
                <Link href={`/receipts/${receipt.id}`} className="nums font-bold text-ink hover:text-brand-ink" dir="ltr">
                  {receipt.receiptNumber}
                </Link>
              ),
            },
            { key: "service", header: t("الخدمة", "Service"), cell: (receipt) => receipt.serviceName },
            { key: "date", header: t("التاريخ", "Date"), cell: (receipt) => <span className="nums">{formatDate(receipt.createdAt, lang)}</span> },
            { key: "price", header: t("المبلغ", "Amount"), cell: (receipt) => <span className="nums font-semibold text-ink">{formatPrice(receipt.price, lang)}</span> },
            {
              key: "open",
              header: <span className="sr-only">{t("فتح", "Open")}</span>,
              cell: (receipt) => (
                <Link href={`/receipts/${receipt.id}`} className="text-sm font-semibold text-brand-ink hover:text-ink">
                  {t("عرض", "View")}
                </Link>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
