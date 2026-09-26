import { cancelOrderByCustomer, getOrderForUser } from "@/src/server/orders";
import { mobileOrderDetail } from "@/src/server/mobile";
import { fail, ok, positiveInt, withMobileUser } from "@/src/server/mobile-api";

export const dynamic = "force-dynamic";

export const POST = withMobileUser<{ id: string }>(async ({ user, params }) => {
  const id = positiveInt(params.id);

  if (!id) {
    return fail(404, "NOT_FOUND", "الطلب غير موجود.");
  }

  const result = await cancelOrderByCustomer(user.id, id);

  if (!result.ok) {
    return fail(400, "CANNOT_CANCEL", result.error);
  }

  const order = await getOrderForUser(user.id, id);

  return ok({ order: order ? await mobileOrderDetail(order) : null, message: "تم إلغاء الطلب." });
});
