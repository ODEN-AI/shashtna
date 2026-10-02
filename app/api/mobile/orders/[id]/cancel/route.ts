import { fail, ok, positiveInt, withMobileUser } from "@/src/server/mobile/http";
import { ownOrderDetail } from "@/src/server/mobile/shape";
import { cancelOrderByCustomer } from "@/src/server/orders";

export const dynamic = "force-dynamic";

/** Customer cancellation (the order service decides whether the order can still be cancelled). */
export const POST = withMobileUser<{ id: string }>(async ({ user, params }) => {
  const id = positiveInt(params.id);
  if (!id) return fail(404, "NOT_FOUND", "الطلب غير موجود.");

  const result = await cancelOrderByCustomer(user.id, id);
  if (!result.ok) return fail(400, "CANNOT_CANCEL", result.error);

  return ok({ order: await ownOrderDetail(user.id, id), message: "تم إلغاء الطلب." });
});
