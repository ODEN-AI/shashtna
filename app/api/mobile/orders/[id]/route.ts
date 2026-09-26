import { getOrderForUser } from "@/src/server/orders";
import { mobileOrderDetail } from "@/src/server/mobile";
import { fail, ok, positiveInt, withMobileUser } from "@/src/server/mobile-api";

export const dynamic = "force-dynamic";

export const GET = withMobileUser<{ id: string }>(async ({ user, params }) => {
  const id = positiveInt(params.id);
  const order = id ? await getOrderForUser(user.id, id) : null;

  return order ? ok({ order: await mobileOrderDetail(order) }) : fail(404, "NOT_FOUND", "الطلب غير موجود.");
});
