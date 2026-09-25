import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { StatusBadge } from "@/app/ui/Badge";
import { buttonClass } from "@/app/ui/Button";
import { ORDER_STATUS_LABELS, orderRef } from "@/src/lib/order-status";
import type { SessionUser } from "@/src/server/auth";
import { getI18n } from "@/src/server/i18n";
import { getCustomerOverview } from "@/src/server/overview";

/** Personalised strip shown to signed-in customers on public pages. */
export async function AccountStrip({ user }: { user: SessionUser }) {
  const [{ t, isAr }, overview] = await Promise.all([getI18n(), getCustomerOverview(user.id)]);
  const { state, primary, openOrders } = overview;

  let status: { key: string; label: string };
  let message: string;
  let action: { href: string; label: string };

  if ((state === "ACTIVE" || state === "EXPIRING") && primary) {
    status = { key: state, label: state === "ACTIVE" ? t("نشط", "Active") : t("ينتهي قريبًا", "Expiring") };
    message = isAr
      ? `اشتراكك «${primary.packageName}» — باقي ${primary.daysRemaining} ${primary.daysRemaining === 1 ? "يوم" : "يوم"}`
      : `${primary.packageName} — ${primary.daysRemaining} day${primary.daysRemaining === 1 ? "" : "s"} left`;
    action = state === "EXPIRING"
      ? { href: `/checkout?renew=${primary.id}`, label: t("جدّد الآن", "Renew now") }
      : { href: `/subscriptions/${primary.id}`, label: t("إدارة الاشتراك", "Manage") };
  } else if (state === "PENDING" && openOrders[0]) {
    const order = openOrders[0];
    status = { key: order.status, label: isAr ? ORDER_STATUS_LABELS[order.status].ar : ORDER_STATUS_LABELS[order.status].en };
    message = isAr ? `طلبك ${orderRef(order.id)} قيد المتابعة` : `Order ${order.number} is in progress`;
    action = { href: `/orders/${order.id}`, label: t("تتبّع الطلب", "Track order") };
  } else if (state === "EXPIRED" && primary) {
    status = { key: "EXPIRED", label: t("منتهي", "Expired") };
    message = isAr ? `اشتراكك «${primary.packageName}» منتهي` : `${primary.packageName} has expired`;
    action = { href: `/checkout?renew=${primary.id}`, label: t("إعادة التفعيل", "Reactivate") };
  } else {
    status = { key: "NONE", label: t("بدون اشتراك", "No plan") };
    message = t(`هلا ${user.name.split(" ")[0]} — اختار باقتك وابدأ`, `Hi ${user.name.split(" ")[0]} — pick a plan to get started`);
    action = { href: "/plans", label: t("اختر باقة", "Choose a plan") };
  }

  return (
    <div className="border-b border-line bg-surface/80">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <StatusBadge status={status.key} label={status.label} />
          <p className="truncate text-sm font-semibold text-ink">{message}</p>
        </div>
        <Link href={action.href} className={buttonClass("secondary", "sm")}>
          {action.label}
          <ArrowLeft size={15} className="ltr:rotate-180" aria-hidden />
        </Link>
      </div>
    </div>
  );
}
