import { deriveAccountState, pickPrimarySubscription } from "@/src/lib/subscription-state";
import { listCustomerActivity } from "@/src/server/activity";
import { getActivePackages } from "@/src/server/catalog";
import { countUnreadNotifications, ensureRenewalReminders } from "@/src/server/notifications";
import { getOrderForUser } from "@/src/server/orders";
import { listSubscriptionsForUser } from "@/src/server/subscriptions";
import type { MobileUser } from "@/src/server/mobile/http";
import { activeIncidents, listMobileOrders, mobileContent, mobileOrderDetail, shapeSubscription } from "@/src/server/mobile/shape";

type NextAction = { kind: string; title: string; body: string; orderId?: number; subscriptionId?: number };

/**
 * The app's home screen in one request, from the same records the website
 * dashboard reads: account state, featured subscription, the order to follow
 * (with payment details), next action, unread notifications, content for this
 * customer's audience and incidents. Counts are real counts; nothing is filled in.
 */
export async function mobileDashboard(request: Request, user: MobileUser, highlightOrderId: number | null) {
  const subscriptions = await listSubscriptionsForUser(user.id);

  // Same best-effort reminder refresh the website dashboard does.
  await ensureRenewalReminders(user.id, subscriptions, user.renewalReminders).catch(() => undefined);

  const primary = pickPrimarySubscription(subscriptions);
  const orders = await listMobileOrders(user.id);
  const openOrders = orders.filter((order) => order.isOpen);
  const accountState = deriveAccountState(primary, openOrders.length > 0);
  const viewer = { state: accountState, vip: String(primary?.serviceType ?? "").toUpperCase() === "VIP" };

  const [unread, content, incidents, activity, packages] = await Promise.all([
    countUnreadNotifications(user.id),
    mobileContent(request, viewer),
    activeIncidents(),
    listCustomerActivity(user.id, 5),
    getActivePackages(),
  ]);

  // As on the website: the order just placed (only if it is this customer's), else the newest open one.
  const highlighted = highlightOrderId ? orders.find((order) => order.id === highlightOrderId) : undefined;
  const currentOrder = highlighted ?? openOrders[0] ?? null;
  const rawOrder = currentOrder ? await getOrderForUser(user.id, currentOrder.id) : null;
  const trackedOrder = rawOrder ? await mobileOrderDetail(rawOrder) : null;

  let nextAction: NextAction | null = null;

  if (currentOrder?.needsPayment) {
    nextAction = {
      kind: "PAY_ORDER",
      title: "كمّل الدفع",
      body: `حوّل ${currentOrder.price.toLocaleString("en-US")} د.ع وارفع صورة إثبات الدفع حتى نفعّل طلبك.`,
      orderId: currentOrder.id,
    };
  } else if (currentOrder?.stage === "UNDER_REVIEW") {
    nextAction = { kind: "WAIT_REVIEW", title: "إثبات الدفع قيد المراجعة", body: "فريقنا يراجع التحويل. راح يوصلك إشعار أول ما يتأكد الدفع.", orderId: currentOrder.id };
  } else if (currentOrder?.stage === "PAID") {
    nextAction = { kind: "WAIT_ACTIVATION", title: "تم تأكيد الدفع", body: "اشتراكك بالدور للتفعيل. راح يوصلك إشعار أول ما يجهز.", orderId: currentOrder.id };
  } else if (primary && (primary.state === "EXPIRING" || primary.state === "EXPIRED")) {
    nextAction = {
      kind: "RENEW",
      title: primary.state === "EXPIRING" ? "اشتراكك ينتهي قريبًا" : "انتهى اشتراكك",
      body:
        primary.state === "EXPIRING"
          ? `باقي ${primary.daysRemaining} ${primary.daysRemaining === 1 ? "يوم" : "أيام"}. جدّد حتى تستمر المشاهدة بدون انقطاع.`
          : "جدّد اشتراكك حتى ترجع المشاهدة.",
      subscriptionId: primary.id,
    };
  } else if (!primary && !currentOrder) {
    nextAction = { kind: "CHOOSE_PLAN", title: "ابدأ اشتراكك", body: "اختار الباقة المناسبة إلك وكمّل الطلب بخطوات بسيطة." };
  }

  return {
    user,
    accountState,
    primarySubscription: primary ? shapeSubscription(primary) : null,
    subscriptionsCount: subscriptions.length,
    currentOrder: trackedOrder,
    openOrdersCount: openOrders.length,
    nextAction,
    unreadNotifications: unread,
    offers: content.offers.slice(0, 6),
    announcements: content.announcements.slice(0, 6),
    incidents,
    hasPackages: packages.length > 0,
    recentActivity: activity.map((event) => ({
      id: event.id,
      summary: event.summary,
      entityType: event.entityType,
      entityId: event.entityId,
      createdAt: String(event.createdAt),
    })),
    generatedAt: new Date().toISOString(),
  };
}
