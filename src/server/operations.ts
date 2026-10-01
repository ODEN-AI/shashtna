import { loadSection } from "@/src/lib/dashboard-section";
import { matchesSearch, oldestFirst, sinceStart, withinSince, type OperationsQuery, type OperationsQueue } from "@/src/lib/operations";
import { allowedTransitions, UNPAID_STORED_STATUSES, type OrderStatus } from "@/src/lib/order-status";
import { hasPermission, type Permission } from "@/src/lib/roles";
import { daysRemaining, deriveSubscriptionState } from "@/src/lib/subscription-state";
import { getAllSupportTickets } from "@/src/lib/support-store";
import { db } from "@/src/prisma/db";
import { customersById, listOrdersAdmin } from "@/src/server/admin-data";
import { listRenewalsDue } from "@/src/server/admin-queues";
import { proofUploadTimes } from "@/src/server/payment-proofs";
import { whatsappLink } from "@/src/server/settings";

/**
 * Operations Center data. Every lane reuses the existing queue code
 * (listOrdersAdmin, proofUploadTimes, listRenewalsDue, the support store,
 * ServiceLead) and is loaded on the server only when the role holds the
 * lane's permission AND the current view needs it. Lanes report success or
 * failure separately (failed ≠ empty). Items are ordered by how long they
 * have been waiting; no priority score is invented.
 */

const OPEN_LEAD_STATUSES = ["NEW", "CONTACTED"];

type OrderLike = Awaited<ReturnType<typeof listOrdersAdmin>>[number];

function orderSearchFields(order: OrderLike) {
  return [order.number, order.id, order.customer?.name, order.customer?.phone, order.serviceName, order.paymentReference];
}

/** Unpaid orders, split into "proof uploaded → verify" and "waiting for contact/payment". */
async function unpaidLanes(query: OperationsQuery) {
  const unpaid = await listOrdersAdmin({ statuses: UNPAID_STORED_STATUSES });
  const proofs = await proofUploadTimes(unpaid.map((order) => order.id));
  const start = sinceStart(query.since);
  const visible = unpaid.filter((order) => matchesSearch(query.q, orderSearchFields(order)));
  const item = (order: OrderLike, since: string) => ({
    id: order.id,
    number: order.number,
    customerId: order.customer?.id ?? null,
    customerName: order.customer?.name ?? null,
    serviceName: order.serviceName,
    requestType: order.requestType,
    price: order.price,
    status: order.status,
    paymentReference: order.paymentReference,
    createdAt: order.createdAt,
    since,
    transitions: allowedTransitions(order.status) as OrderStatus[],
  });

  return {
    payments: oldestFirst(visible.filter((order) => proofs.has(order.id)).map((order) => item(order, proofs.get(order.id)!)).filter((entry) => withinSince(entry.since, start))),
    orders: oldestFirst(visible.filter((order) => !proofs.has(order.id)).map((order) => item(order, order.createdAt)).filter((entry) => withinSince(entry.since, start))),
  };
}

async function activationLane(query: OperationsQuery) {
  const start = sinceStart(query.since);
  const ready = await listOrdersAdmin({ statuses: ["PAID", "FULFILLING"] });

  return oldestFirst(
    ready
      .filter((order) => matchesSearch(query.q, orderSearchFields(order)))
      // Waiting since it was confirmed paid (its last update).
      .map((order) => ({ id: order.id, number: order.number, customerId: order.customer?.id ?? null, customerName: order.customer?.name ?? null, serviceName: order.serviceName, requestType: order.requestType, status: order.status, since: order.updatedAt }))
      .filter((entry) => withinSince(entry.since, start)),
  );
}

async function renewalLane(query: OperationsQuery) {
  const due = await listRenewalsDue();
  const [customers, contacted] = await Promise.all([
    customersById(due.map((item) => item.userId)),
    db.orm.public.ActivityEvent.where({ action: "RENEWAL_CONTACTED" }).orderBy((event) => event.id.desc()).limit(500).all(),
  ]);
  const lastContact = new Map<string, string>();
  for (const event of contacted) if (event.entityId && !lastContact.has(event.entityId)) lastContact.set(event.entityId, String(event.createdAt));

  const rows = due
    .map((subscription) => {
      const customer = customers.get(subscription.userId);
      const state = deriveSubscriptionState(subscription);
      const expiry = String(subscription.expiryDate);
      const message = customer
        ? `مرحبًا ${customer.name}، معك فريق شاشتنا. اشتراك «${subscription.packageName}» ${state === "EXPIRED" ? "انتهى" : `ينتهي بتاريخ ${expiry.slice(0, 10)}`}. تكدر تجدده من حسابك: https://shashtna.netlify.app/subscriptions/${subscription.id}`
        : "";

      return {
        id: subscription.id,
        userId: subscription.userId,
        customerName: customer?.name ?? null,
        packageName: subscription.packageName,
        expiryDate: expiry,
        state,
        daysLeft: daysRemaining(expiry),
        lastContactAt: lastContact.get(String(subscription.id)) ?? null,
        contactUrl: customer ? whatsappLink(customer.phone.replace(/^0/, "964"), message) : null,
        since: expiry,
      };
    })
    // The phone is matched against but never returned as a field.
    .filter((row) => matchesSearch(query.q, [row.customerName, row.packageName, row.id, customers.get(row.userId)?.phone]));

  // Existing states only (deriveSubscriptionState): ending soon vs already ended.
  return {
    ending: oldestFirst(rows.filter((row) => row.state !== "EXPIRED")),
    ended: oldestFirst(rows.filter((row) => row.state === "EXPIRED")).reverse(),
  };
}

async function supportLane(query: OperationsQuery) {
  const start = sinceStart(query.since);
  const tickets = (await getAllSupportTickets()).filter((ticket) => ticket.status !== "CLOSED");

  return oldestFirst(
    tickets
      .filter((ticket) => matchesSearch(query.q, [ticket.id, ticket.subject, ticket.userName, ticket.userPhone]))
      .map((ticket) => ({ id: ticket.id, subject: ticket.subject, customerName: ticket.userName, status: ticket.status, waitingOnTeam: ticket.lastSender === "CUSTOMER", since: ticket.updatedAt }))
      .filter((entry) => withinSince(entry.since, start)),
  ).sort((a, b) => Number(b.waitingOnTeam) - Number(a.waitingOnTeam));
}

async function leadLane(query: OperationsQuery) {
  const start = sinceStart(query.since);
  const leads = await db.orm.public.ServiceLead.where((lead) => lead.status.in(OPEN_LEAD_STATUSES)).orderBy((lead) => lead.id.asc()).limit(200).all();

  return leads
    .filter((lead) => matchesSearch(query.q, [lead.id, lead.name, lead.phone, lead.projectType, lead.details]))
    .map((lead) => ({ id: lead.id, name: lead.name, projectType: lead.projectType, budget: lead.budget, timeline: lead.timeline, details: lead.details, status: lead.status, adminNote: lead.adminNote, since: String(lead.createdAt) }))
    .filter((entry) => withinSince(entry.since, start));
}

/** The latest operational audit events the role may see (what happened after an action). */
async function recentOperations(can: (permission: Permission) => boolean) {
  const types = [can("orders") && "ORDER", can("orders") && "LEAD", can("subscriptions") && "SUBSCRIPTION", can("support") && "TICKET"].filter(Boolean) as string[];
  if (!types.length) return [];
  const events = await db.orm.public.ActivityEvent.where((event) => event.entityType.in(types)).orderBy((event) => event.id.desc()).limit(10).all();
  const people = await customersById(events.map((event) => event.actorUserId ?? 0));

  return events.map((event) => ({
    id: event.id,
    entityType: event.entityType,
    entityId: event.entityId,
    summary: event.summary,
    createdAt: String(event.createdAt),
    actorName: event.actorUserId ? (people.get(event.actorUserId)?.name ?? null) : null,
    actorRole: event.actorRole,
  }));
}

export async function getOperations(role: string, query: OperationsQuery) {
  const can = (permission: Permission) => hasPermission(role, permission);
  const needs = (queue: OperationsQueue) => query.queue === "overview" || query.queue === queue;

  const [unpaid, activations, renewals, support, leads, recent] = await Promise.all([
    loadSection(can("orders") && (needs("payments") || needs("orders")), "OPS_UNPAID", () => unpaidLanes(query)),
    loadSection(can("orders") && needs("activations"), "OPS_ACTIVATIONS", () => activationLane(query)),
    loadSection(can("subscriptions") && needs("renewals"), "OPS_RENEWALS", () => renewalLane(query)),
    loadSection(can("support") && needs("support"), "OPS_SUPPORT", () => supportLane(query)),
    loadSection(can("orders") && needs("leads"), "OPS_LEADS", () => leadLane(query)),
    loadSection(query.queue === "overview" && (can("orders") || can("subscriptions") || can("support")), "OPS_RECENT", () => recentOperations(can)),
  ]);

  return { can, query, unpaid, activations, renewals, support, leads, recent };
}

export type Operations = Awaited<ReturnType<typeof getOperations>>;
