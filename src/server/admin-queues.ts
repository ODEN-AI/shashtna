import { cache } from "react";

import { db } from "@/src/prisma/db";
import { getAllSupportTickets } from "@/src/lib/support-store";

const DAY = 24 * 60 * 60 * 1000;

/** Window for the "Renewals due" queue: ending within 14 days, or ended in the last 30. */
export function renewalWindow(now = Date.now()) {
  return {
    from: new Date(now - 30 * DAY).toISOString(),
    to: new Date(now + 14 * DAY).toISOString(),
  };
}

export async function countOrders(statuses?: string[]) {
  const scope = statuses
    ? db.orm.public.SubscriptionRequest.where((order) => order.status.in(statuses))
    : db.orm.public.SubscriptionRequest;
  const result = await scope.aggregate((aggregate) => ({ count: aggregate.count() }));

  return result.count;
}

export async function listRenewalsDue() {
  const { from, to } = renewalWindow();

  return db.orm.public.Subscription.where((subscription) => subscription.expiryDate.gte(from))
    .where((subscription) => subscription.expiryDate.lte(to))
    .where((subscription) => subscription.status.neq("CANCELLED"))
    .orderBy((subscription) => subscription.expiryDate.asc())
    .all();
}

/** Badge counts for the admin navigation and the Inbox. Real data only. */
export const getQueueCounts = cache(async () => {
  const { from, to } = renewalWindow();

  const [newOrders, activations, renewals, resets, leads, tickets] = await Promise.all([
    countOrders(["SUBMITTED", "AWAITING_PAYMENT", "PENDING"]),
    countOrders(["PAID", "FULFILLING"]),
    db.orm.public.Subscription.where((subscription) => subscription.expiryDate.gte(from))
      .where((subscription) => subscription.expiryDate.lte(to))
      .where((subscription) => subscription.status.neq("CANCELLED"))
      .aggregate((aggregate) => ({ count: aggregate.count() })),
    db.orm.public.PasswordReset.where({ status: "REQUESTED" }).aggregate((aggregate) => ({ count: aggregate.count() })),
    db.orm.public.ServiceLead.where({ status: "NEW" }).aggregate((aggregate) => ({ count: aggregate.count() })),
    getAllSupportTickets().catch(() => []),
  ]);

  return {
    orders: newOrders,
    activations,
    renewals: renewals.count,
    resets: resets.count,
    leads: leads.count,
    // Tickets waiting on the team: open and last message from the customer.
    tickets: tickets.filter((ticket) => ticket.status !== "CLOSED" && ticket.lastSender === "CUSTOMER").length,
  };
});
