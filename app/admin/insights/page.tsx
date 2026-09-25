import type { Metadata } from "next";

import { Forbidden } from "@/app/components/admin/Forbidden";
import { Stat } from "@/app/ui/Card";
import { Card, CardHeader } from "@/app/ui/Card";
import { PageHeader } from "@/app/ui/Page";
import { formatPrice, toDate } from "@/src/lib/i18n";
import { ORDER_STATUS_LABELS, normalizeOrderStatus, type OrderStatus } from "@/src/lib/order-status";
import { isStaffRole } from "@/src/lib/roles";
import { deriveSubscriptionState } from "@/src/lib/subscription-state";
import { db } from "@/src/prisma/db";
import { requireStaffPage } from "@/src/server/auth";
import { getI18n } from "@/src/server/i18n";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "لوحة المؤشرات" };

export default async function InsightsPage() {
  const { allowed } = await requireStaffPage("/admin/insights", "insights");

  if (!allowed) {
    return <Forbidden />;
  }

  const { t, lang } = await getI18n();
  const [users, subscriptions, orders, receipts] = await Promise.all([
    db.orm.public.User.select("id", "role", "createdAt").all(),
    db.orm.public.Subscription.select("status", "expiryDate", "packageName", "serviceType").all(),
    db.orm.public.SubscriptionRequest.select("status", "createdAt").all(),
    db.orm.public.Receipt.select("price", "createdAt").all(),
  ]);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const inThisMonth = (value: string) => (toDate(value)?.getTime() ?? 0) >= monthStart;

  const customers = users.filter((user) => !isStaffRole(user.role));
  const states = subscriptions.map((subscription) => deriveSubscriptionState(subscription));
  const active = states.filter((state) => state === "ACTIVE").length;
  const expiring = states.filter((state) => state === "EXPIRING").length;
  const expired = states.filter((state) => state === "EXPIRED").length;

  const statusCounts = new Map<OrderStatus, number>();
  for (const order of orders) {
    const status = normalizeOrderStatus(order.status);
    statusCounts.set(status, (statusCounts.get(status) ?? 0) + 1);
  }

  const byPackage = new Map<string, number>();
  subscriptions.forEach((subscription, index) => {
    if (states[index] === "ACTIVE" || states[index] === "EXPIRING") {
      byPackage.set(subscription.packageName, (byPackage.get(subscription.packageName) ?? 0) + 1);
    }
  });

  const monthRevenue = receipts.filter((receipt) => inThisMonth(String(receipt.createdAt))).reduce((sum, receipt) => sum + receipt.price, 0);
  const totalRevenue = receipts.reduce((sum, receipt) => sum + receipt.price, 0);
  const renewalBase = active + expiring + expired;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("لوحة المؤشرات", "Dashboard")}
        description={t("أرقام حقيقية من قاعدة البيانات. الإيرادات محسوبة من الإيصالات الصادرة فقط.", "Real numbers from the database. Revenue is calculated from issued receipts only.")}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label={t("العملاء", "Customers")} value={customers.length} hint={t(`${customers.filter((user) => inThisMonth(String(user.createdAt))).length} جديد هذا الشهر`, `${customers.filter((user) => inThisMonth(String(user.createdAt))).length} new this month`)} />
        <Stat label={t("اشتراكات فعالة", "Active subscriptions")} value={active + expiring} hint={t(`${expiring} تنتهي خلال 7 أيام`, `${expiring} ending within 7 days`)} tone="success" />
        <Stat label={t("اشتراكات منتهية", "Expired subscriptions")} value={expired} tone={expired ? "danger" : "default"} hint={renewalBase ? t(`${Math.round((expired / renewalBase) * 100)}% من الكل`, `${Math.round((expired / renewalBase) * 100)}% of all`) : undefined} />
        <Stat label={t("إيرادات هذا الشهر", "Revenue this month")} value={formatPrice(monthRevenue, lang)} hint={t(`الإجمالي: ${formatPrice(totalRevenue, lang)}`, `All time: ${formatPrice(totalRevenue, lang)}`)} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="p-6">
          <CardHeader title={t("الطلبات حسب الحالة", "Orders by status")} />
          <ul className="mt-4 divide-y divide-line">
            {[...statusCounts.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([status, count]) => (
                <li key={status} className="flex items-center justify-between py-3 text-sm">
                  <span className="text-ink-2">{ORDER_STATUS_LABELS[status][lang]}</span>
                  <span className="nums font-bold text-ink">{count}</span>
                </li>
              ))}
            {!statusCounts.size ? <li className="py-3 text-sm text-ink-3">{t("ماكو طلبات.", "No orders.")}</li> : null}
          </ul>
        </Card>
        <Card className="p-6">
          <CardHeader title={t("الاشتراكات الفعالة حسب الباقة", "Active subscriptions by plan")} />
          <ul className="mt-4 divide-y divide-line">
            {[...byPackage.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([name, count]) => (
                <li key={name} className="flex items-center justify-between py-3 text-sm">
                  <span className="text-ink-2">{name}</span>
                  <span className="nums font-bold text-ink">{count}</span>
                </li>
              ))}
            {!byPackage.size ? <li className="py-3 text-sm text-ink-3">{t("ماكو اشتراكات فعالة.", "No active subscriptions.")}</li> : null}
          </ul>
        </Card>
      </div>
      <p className="text-xs text-ink-3">
        {t(
          "ملاحظة: عدد الاتصالات الحالية غير متوفر لأن النظام غير مرتبط بلوحة IPTV، لذلك لا يُعرض.",
          "Note: live connection counts aren't available because the system isn't connected to the IPTV panel, so they aren't shown.",
        )}
      </p>
    </div>
  );
}
