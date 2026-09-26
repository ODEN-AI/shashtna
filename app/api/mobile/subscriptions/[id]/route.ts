import { listEntityActivity } from "@/src/server/activity";
import { listMobileOrders, shapeSubscription } from "@/src/server/mobile";
import { fail, ok, positiveInt, withMobileUser } from "@/src/server/mobile-api";
import { getSubscriptionForUser, listReceiptsForUser } from "@/src/server/subscriptions";

export const dynamic = "force-dynamic";

/** One subscription with its history: orders, receipts and timeline. */
export const GET = withMobileUser<{ id: string }>(async ({ user, params }) => {
  const id = positiveInt(params.id);
  const subscription = id ? await getSubscriptionForUser(user.id, id) : null;

  if (!subscription) {
    return fail(404, "NOT_FOUND", "الاشتراك غير موجود.");
  }

  const [orders, receipts, events] = await Promise.all([
    listMobileOrders(user.id),
    listReceiptsForUser(user.id),
    listEntityActivity("SUBSCRIPTION", subscription.id, { customerVisibleOnly: true }),
  ]);

  return ok({
    subscription: shapeSubscription(subscription),
    orders: orders.filter((order) => order.subscriptionId === subscription.id),
    receipts: receipts
      .filter((receipt) => receipt.subscriptionId === subscription.id)
      .map((receipt) => ({
        id: receipt.id,
        receiptNumber: receipt.receiptNumber,
        serviceName: receipt.serviceName,
        price: receipt.price,
        durationLabel: receipt.durationLabel,
        status: receipt.status,
        createdAt: String(receipt.createdAt),
      })),
    events: events.map((event) => ({ id: event.id, summary: event.summary, createdAt: String(event.createdAt) })),
  });
});
