import { claimsOtherUser, fail, FORBIDDEN_MESSAGE, ok, withMobileUser } from "@/src/server/mobile/http";
import { shapeSubscription } from "@/src/server/mobile/shape";
import { listSubscriptionsForUser } from "@/src/server/subscriptions";

export const dynamic = "force-dynamic";

/**
 * The customer's subscriptions (both app generations read this list). IPTV
 * login details are never in the list — only on GET /subscriptions/{id}.
 */
export const GET = withMobileUser(async ({ request, user }) => {
  if (claimsOtherUser(new URL(request.url).searchParams.get("userId"), user.id)) {
    return fail(403, "FORBIDDEN", FORBIDDEN_MESSAGE);
  }

  const subscriptions = await listSubscriptionsForUser(user.id);

  return ok({ subscriptions: subscriptions.map((subscription) => shapeSubscription(subscription)) });
});
