import { fail, ok, readJson, withMobileUser } from "@/src/server/mobile/http";
import { mobileLoyalty } from "@/src/server/mobile/loyalty";
import { ownOrderDetail } from "@/src/server/mobile/shape";
import { redeemReward } from "@/src/server/loyalty";

export const dynamic = "force-dynamic";

/**
 * Spend points on a free IPTV renewal: `{ reward: "3m" | "6m", subscriptionId }`.
 * Every rule is checked by `redeemReward`; the customer comes from the token,
 * and a subscription of another customer answers 404.
 */
export const POST = withMobileUser(async ({ request, user }) => {
  const body = await readJson(request);
  const result = await redeemReward(user.id, body.reward, body.subscriptionId);

  if (!result.ok) {
    return fail(result.status, result.status === 404 ? "NOT_FOUND" : result.status === 400 ? "INVALID" : result.status === 409 ? "CANNOT_REDEEM" : "SERVER_ERROR", result.error);
  }

  return ok(
    { order: await ownOrderDetail(user.id, result.orderId), loyalty: await mobileLoyalty(user.id), message: "استلمنا طلب مكافأتك. فريقنا يراجعه ويفعّله." },
    { status: 201 },
  );
});
