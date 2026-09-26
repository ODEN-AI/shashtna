import { shapeSubscription } from "@/src/server/mobile";
import { ok, withMobileUser } from "@/src/server/mobile-api";
import { listSubscriptionsForUser } from "@/src/server/subscriptions";

export const dynamic = "force-dynamic";

export const GET = withMobileUser(async ({ user }) => {
  const subscriptions = await listSubscriptionsForUser(user.id);

  return ok({ subscriptions: subscriptions.map(shapeSubscription) });
});
