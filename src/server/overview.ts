import { cache } from "react";

import { isOpen } from "@/src/lib/order-status";
import {
  deriveAccountState,
  pickPrimarySubscription,
} from "@/src/lib/subscription-state";
import { listOrdersForUser } from "@/src/server/orders";
import { listSubscriptionsForUser } from "@/src/server/subscriptions";

/** Everything the dashboard hero / personalized strips need. */
export const getCustomerOverview = cache(async (userId: number) => {
  const [subscriptions, orders] = await Promise.all([
    listSubscriptionsForUser(userId),
    listOrdersForUser(userId),
  ]);

  const primary = pickPrimarySubscription(subscriptions);
  const openOrders = orders.filter((order) => isOpen(order.status));
  const state = deriveAccountState(primary, openOrders.length > 0);

  return { subscriptions, orders, primary, openOrders, state };
});
