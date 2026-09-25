import type { Metadata } from "next";

import { Forbidden } from "@/app/components/admin/Forbidden";
import { OrdersTable } from "@/app/components/admin/OrdersTable";
import { Input } from "@/app/ui/Field";
import { PageHeader } from "@/app/ui/Page";
import { Pagination, paginate } from "@/app/ui/Pagination";
import { EmptyState } from "@/app/ui/States";
import { LinkTabs } from "@/app/ui/Tabs";
import { isUnpaid } from "@/src/lib/order-status";
import { listOrdersAdmin } from "@/src/server/admin-data";
import { countOrders } from "@/src/server/admin-queues";
import { requireStaffPage } from "@/src/server/auth";
import { getI18n } from "@/src/server/i18n";
import { proofUploadTimes } from "@/src/server/payment-proofs";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "الطلبات" };

const FILTERS: Record<string, string[] | undefined> = {
  unpaid: ["SUBMITTED", "AWAITING_PAYMENT", "PENDING"],
  activation: ["PAID", "FULFILLING"],
  completed: ["COMPLETED", "ACCEPTED"],
  closed: ["CANCELLED", "REJECTED"],
  all: undefined,
};

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; type?: string; page?: string }>;
}) {
  const params = await searchParams;
  const { allowed } = await requireStaffPage("/admin/orders", "orders");

  if (!allowed) {
    return <Forbidden />;
  }

  const { t } = await getI18n();
  const status = params.status && params.status in FILTERS ? params.status : "unpaid";
  const type = ["NEW", "RENEW", "UPGRADE", "DEVICE_PURCHASE"].includes(String(params.type)) ? params.type : undefined;
  const orders = await listOrdersAdmin({ statuses: FILTERS[status], type, q: params.q });
  const { items, page, pageCount, total } = paginate(orders, params.page, 25);
  const proofs = await proofUploadTimes(items.map((order) => order.id));
  const counts = await Promise.all(
    Object.entries(FILTERS).map(async ([key, statuses]) => [key, await countOrders(statuses)] as const),
  );
  const countMap = Object.fromEntries(counts);
  const query = (next: Record<string, string | undefined>) => {
    const search = new URLSearchParams();
    const merged = { status, q: params.q, type, ...next };

    for (const [key, value] of Object.entries(merged)) {
      if (value) search.set(key, value);
    }

    return `/admin/orders?${search.toString()}`;
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("الطلبات", "Orders")} description={t(`${total} طلب مطابق`, `${total} matching orders`)} />

      <LinkTabs
        label={t("حالة الطلب", "Order status")}
        active={status}
        tabs={[
          { key: "unpaid", href: query({ status: "unpaid", page: undefined }), label: t("جديدة / بانتظار الدفع", "New / unpaid"), count: countMap.unpaid },
          { key: "activation", href: query({ status: "activation", page: undefined }), label: t("للتفعيل", "To activate"), count: countMap.activation },
          { key: "completed", href: query({ status: "completed", page: undefined }), label: t("مكتملة", "Completed"), count: countMap.completed },
          { key: "closed", href: query({ status: "closed", page: undefined }), label: t("ملغية / مرفوضة", "Cancelled / rejected"), count: countMap.closed },
          { key: "all", href: query({ status: "all", page: undefined }), label: t("الكل", "All"), count: countMap.all },
        ]}
      />

      <form className="flex flex-wrap gap-2" role="search">
        <input type="hidden" name="status" value={status} />
        <Input name="q" defaultValue={params.q ?? ""} placeholder={t("رقم الطلب، اسم العميل أو هاتفه", "Order number, customer name or phone")} className="h-10 max-w-sm py-0" aria-label={t("بحث", "Search")} />
        <select
          name="type"
          defaultValue={type ?? ""}
          className="h-10 rounded-xl border border-line-strong bg-surface-2 px-3 text-sm text-ink"
          aria-label={t("النوع", "Type")}
        >
          <option value="">{t("كل الأنواع", "All types")}</option>
          <option value="NEW">{t("جديد", "New")}</option>
          <option value="RENEW">{t("تجديد", "Renewal")}</option>
          <option value="UPGRADE">{t("ترقية", "Upgrade")}</option>
          <option value="DEVICE_PURCHASE">{t("شراء جهاز", "Device")}</option>
        </select>
        <button type="submit" className="h-10 rounded-xl bg-brand px-4 text-sm font-semibold text-white">
          {t("بحث", "Search")}
        </button>
      </form>

      {items.length ? (
        <>
          <OrdersTable
            orders={items.map((order) => ({
              id: order.id,
              number: order.number,
              status: order.status,
              requestType: order.requestType,
              serviceName: order.serviceName,
              price: order.price,
              createdAt: order.createdAt,
              contactMethod: order.contactMethod,
              customer: order.customer,
              hasProof: proofs.has(order.id) && isUnpaid(order.status),
            }))}
          />
          <Pagination page={page} pageCount={pageCount} basePath="/admin/orders" params={{ status, q: params.q, type }} lang={t("ar", "en") as "ar" | "en"} />
        </>
      ) : (
        <EmptyState title={t("ماكو طلبات هنا", "No orders here")} description={t("جرّب فلتر أو بحث ثاني.", "Try another filter or search.")} />
      )}
    </div>
  );
}
