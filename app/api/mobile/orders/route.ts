import { createOrder, getOrderForUser } from "@/src/server/orders";
import { listMobileOrders, mobileOrderDetail } from "@/src/server/mobile";
import { fail, ok, readJson, withMobileUser } from "@/src/server/mobile-api";

export const dynamic = "force-dynamic";

export const GET = withMobileUser(async ({ user }) => ok({ orders: await listMobileOrders(user.id) }));

/**
 * Creates an order with the website's order service: same validation,
 * pricing from the database, VIP device compatibility and duplicate-order
 * protection. The client never sends a price.
 */
export const POST = withMobileUser(async ({ request, user }) => {
  const body = await readJson(request);
  const result = await createOrder(user.id, {
    requestType: body.requestType,
    planSlug: body.planSlug,
    deviceId: body.deviceId,
    subscriptionId: body.subscriptionId,
    customerNote: body.customerNote,
  });

  if (!result.ok) {
    return fail(result.status, "ORDER_REJECTED", result.error);
  }

  const order = await getOrderForUser(user.id, result.order.id);

  return ok(
    { order: order ? await mobileOrderDetail(order) : null, alreadyExists: result.alreadyExists },
    { status: result.alreadyExists ? 200 : 201 },
  );
});
