import { fail, ok, readJson, withMobileUser } from "@/src/server/mobile/http";
import { listMobileOrders, ownOrderDetail } from "@/src/server/mobile/shape";
import { createOrder } from "@/src/server/orders";
import { MANUAL_TRANSFER_METHOD } from "@/src/server/settings";

export const dynamic = "force-dynamic";

/** The customer's own orders, newest first. */
export const GET = withMobileUser(async ({ user }) => ok({ orders: await listMobileOrders(user.id) }));

/**
 * Creates the order with the website's order service: same validation,
 * price and device read from the catalogue, VIP compatibility, duplicate
 * protection and state machine. No price, total or status from the client is
 * read. The order appears in Admin → Operations like a website order.
 */
export const POST = withMobileUser(async ({ request, user }) => {
  const body = await readJson(request);
  const result = await createOrder(user.id, {
    requestType: body.requestType,
    planSlug: body.planSlug,
    deviceId: body.deviceId,
    subscriptionId: body.subscriptionId,
    // As on the website checkout: the contact method chosen for this order (createOrder
    // accepts only supported methods), else the saved preference; manual transfer.
    contactMethod: body.contactMethod || user.preferredContact || "PENDING",
    paymentMethod: MANUAL_TRANSFER_METHOD,
    customerNote: body.customerNote,
  });

  if (!result.ok) {
    return fail(result.status, "ORDER_REJECTED", result.error);
  }

  return ok(
    { order: await ownOrderDetail(user.id, result.order.id), alreadyExists: result.alreadyExists },
    { status: result.alreadyExists ? 200 : 201 },
  );
});
