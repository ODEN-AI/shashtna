import { fail, ok, positiveInt, withMobileUser } from "@/src/server/mobile/http";
import { ownOrderDetail } from "@/src/server/mobile/shape";

export const dynamic = "force-dynamic";

/** One of the customer's orders (another customer's id answers 404). */
export const GET = withMobileUser<{ id: string }>(async ({ user, params }) => {
  const order = await ownOrderDetail(user.id, positiveInt(params.id));

  return order ? ok({ order }) : fail(404, "NOT_FOUND", "الطلب غير موجود.");
});
