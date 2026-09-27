import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { StatusBadge } from "@/app/ui/Badge";
import { buttonClass } from "@/app/ui/Button";
import { formatDate } from "@/src/lib/i18n";
import { ORDER_STATUS_LABELS, orderRef } from "@/src/lib/order-status";
import type { SessionUser } from "@/src/server/auth";
import { getI18n } from "@/src/server/i18n";
import { getCustomerOverview } from "@/src/server/overview";

/**
 * Signed-in customer strip at the top of the homepage: the account's real
 * subscription state (same derivation as the dashboard), its expiry /
 * renewal context and one contextual action. Nothing is shown that the
 * account doesn't have.
 */
export async function HomeCustomerStrip({ user }: { user: SessionUser }) {
  const [{ t, isAr, lang }, overview] = await Promise.all([getI18n(), getCustomerOverview(user.id)]);
  const { state, primary, openOrders } = overview;

  let status: { key: string; label: string };
  let message: string;
  let action: { href: string; label: string; urgent?: boolean };
  let context: string | null = null;

  if ((state === "ACTIVE" || state === "EXPIRING") && primary) {
    status = { key: state, label: state === "ACTIVE" ? t("نشط", "Active") : t("ينتهي قريبًا", "Expiring") };
    message = isAr
      ? `اشتراكك «${primary.packageName}» — باقي ${primary.daysRemaining} ${primary.daysRemaining === 1 ? "يوم" : "يوم"}`
      : `${primary.packageName} — ${primary.daysRemaining} day${primary.daysRemaining === 1 ? "" : "s"} left`;
    context = t(`ينتهي في ${formatDate(primary.expiryDate, lang)}`, `Ends ${formatDate(primary.expiryDate, lang)}`);
    action = state === "EXPIRING"
      ? { href: `/checkout?renew=${primary.id}`, label: t("جدّد الآن", "Renew now"), urgent: true }
      : { href: `/subscriptions/${primary.id}`, label: t("إدارة الاشتراك", "Manage") };
  } else if (state === "PENDING" && openOrders[0]) {
    const order = openOrders[0];
    status = { key: order.status, label: isAr ? ORDER_STATUS_LABELS[order.status].ar : ORDER_STATUS_LABELS[order.status].en };
    message = isAr ? `طلبك ${orderRef(order.id)} قيد المتابعة` : `Order ${order.number} is in progress`;
    action = { href: `/orders/${order.id}`, label: t("تتبّع الطلب", "Track order") };
  } else if (state === "EXPIRED" && primary) {
    status = { key: "EXPIRED", label: t("منتهي", "Expired") };
    message = isAr ? `اشتراكك «${primary.packageName}» منتهي` : `${primary.packageName} has expired`;
    context = t(`انتهى في ${formatDate(primary.expiryDate, lang)}`, `Ended ${formatDate(primary.expiryDate, lang)}`);
    action = { href: `/checkout?renew=${primary.id}`, label: t("إعادة التفعيل", "Reactivate"), urgent: true };
  } else {
    status = { key: "NONE", label: t("بدون اشتراك", "No plan") };
    message = t(`هلا ${user.name.split(" ")[0]} — اختار باقتك وابدأ`, `Hi ${user.name.split(" ")[0]} — pick a plan to get started`);
    action = { href: "/plans", label: t("اختر باقة", "Choose a plan") };
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-4 sm:px-6 lg:px-8">
      <div className="glass-soft flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3 sm:px-5">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <StatusBadge status={status.key} label={status.label} />
          <p className="min-w-0 truncate text-sm font-semibold text-ink">{message}</p>
          {context ? <p className="nums text-xs text-ink-3">{context}</p> : null}
        </div>
        <Link href={action.href} className={buttonClass(action.urgent ? "primary" : "secondary", "sm")}>
          {action.label}
          <ArrowLeft size={15} className="ltr:rotate-180" aria-hidden />
        </Link>
      </div>
    </div>
  );
}
