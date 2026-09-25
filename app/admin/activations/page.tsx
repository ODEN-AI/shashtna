import type { Metadata } from "next";

import { Forbidden } from "@/app/components/admin/Forbidden";
import { OrdersTable } from "@/app/components/admin/OrdersTable";
import { PageHeader } from "@/app/ui/Page";
import { EmptyState } from "@/app/ui/States";
import { listOrdersAdmin } from "@/src/server/admin-data";
import { requireStaffPage } from "@/src/server/auth";
import { getI18n } from "@/src/server/i18n";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "التفعيل" };

export default async function ActivationsPage() {
  const { allowed } = await requireStaffPage("/admin/activations", "orders");

  if (!allowed) {
    return <Forbidden />;
  }

  const { t } = await getI18n();
  const orders = await listOrdersAdmin({ statuses: ["PAID", "FULFILLING"] });

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("التفعيل", "Activations")}
        description={t(
          "طلبات تم دفعها وبانتظار إنشاء الاشتراك أو التجديد. افتح الطلب واضغط «إنشاء الاشتراك».",
          "Paid orders waiting for the subscription to be created or renewed. Open an order and choose “Create subscription”.",
        )}
      />
      {orders.length ? (
        <OrdersTable orders={orders.map((order) => ({ ...order, customer: order.customer }))} />
      ) : (
        <EmptyState title={t("ماكو طلبات بانتظار التفعيل", "Nothing waiting for activation")} description={t("الطلبات تظهر هنا بعد تحويلها إلى «تم الدفع».", "Orders appear here once marked Paid.")} />
      )}
    </div>
  );
}
