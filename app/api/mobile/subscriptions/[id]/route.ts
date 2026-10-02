import { listEntityActivity } from "@/src/server/activity";
import { fail, ok, positiveInt, withMobileUser } from "@/src/server/mobile/http";
import { listMobileOrders, shapeSubscription } from "@/src/server/mobile/shape";
import { getSubscriptionForUser, listReceiptsForUser } from "@/src/server/subscriptions";

export const dynamic = "force-dynamic";

/**
 * One of the customer's subscriptions with its orders, receipts and timeline.
 * Like the website's subscription page, this is the one place the owner sees
 * the IPTV login details (another customer's id answers 404).
 */
export const GET = withMobileUser<{ id: string }>(async ({ user, params }) => {
  const id = positiveInt(params.id);
  const subscription = id ? await getSubscriptionForUser(user.id, id) : null;

  if (!subscription) return fail(404, "NOT_FOUND", "الاشتراك غير موجود.");

  const [orders, receipts, events] = await Promise.all([
    listMobileOrders(user.id),
    listReceiptsForUser(user.id),
    listEntityActivity("SUBSCRIPTION", subscription.id, { customerVisibleOnly: true }),
  ]);

  return ok({
    subscription: shapeSubscription(subscription, { credentials: true }),
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
