import { BUSINESS_TIME_ZONE, resolveRange } from "@/src/lib/business-time";
import { loadSection as load } from "@/src/lib/dashboard-section";
import { inRange, parseInstant, percentChange } from "@/src/lib/finance";
import { hasPermission, isStaffRole, normalizeRole, type Permission } from "@/src/lib/roles";
import { deriveSubscriptionState } from "@/src/lib/subscription-state";
import { getAllSupportTickets } from "@/src/lib/support-store";
import { db } from "@/src/prisma/db";
import { customersById, listOrdersAdmin } from "@/src/server/admin-data";
import { getQueueCounts, listRenewalsDue } from "@/src/server/admin-queues";
import { getActiveIncidents } from "@/src/server/content";
import { getFinanceSnapshot } from "@/src/server/finance";
import { serializeOrder } from "@/src/server/orders";
import { proofUploadTimes } from "@/src/server/payment-proofs";
import { getSettings } from "@/src/server/settings";

/**
 * Console Home data. Every section is loaded on the server, only when the
 * signed-in role holds that section's permission (restricted data never
 * reaches the browser), and each one reports success or failure on its own
 * so a failed query renders as "unavailable", never as a misleading zero.
 * Everything reuses the existing queue, order, finance and activity code.
 */

const UNPAID = ["SUBMITTED", "AWAITING_PAYMENT", "PENDING"];

/** Orders created this business month vs the same elapsed part of last month. */
async function orderKpi() {
  const { current, previous } = resolveRange("month", new Date());
  const count = async (start: Date, end: Date) =>
    (
      await db.orm.public.SubscriptionRequest.where((order) => order.createdAt.gte(start.toISOString()))
        .where((order) => order.createdAt.lt(end.toISOString()))
        .aggregate((aggregate) => ({ count: aggregate.count() }))
    ).count;
  const [now, before] = await Promise.all([count(current.start, current.end), count(previous.start, previous.end)]);

  return { current: now, previous: before, change: percentChange(now, before) };
}

/** Customers (non-staff accounts): total, new this month (like-for-like), recent sign-ups. */
async function customerSnapshot() {
  const { current, previous } = resolveRange("month", new Date());
  const [users, recent] = await Promise.all([
    db.orm.public.User.select("role", "createdAt").all(),
    db.orm.public.User.select("id", "name", "role", "createdAt").orderBy((user) => user.id.desc()).limit(40).all(),
  ]);
  const customers = users.filter((user) => !isStaffRole(normalizeRole(user.role)));
  const joined = (range: typeof current) => customers.filter((user) => inRange(parseInstant(String(user.createdAt)), range)).length;
  const newNow = joined(current);
  const newBefore = joined(previous);

  return {
    total: customers.length,
    newThisMonth: newNow,
    newChange: percentChange(newNow, newBefore),
    // Name and join date only — no phone numbers on the dashboard.
    recent: recent
      .filter((user) => !isStaffRole(normalizeRole(user.role)))
      .slice(0, 5)
      .map((user) => ({ id: user.id, name: user.name, createdAt: String(user.createdAt) })),
  };
}

/** Subscription states right now (same rules as the rest of the admin). */
async function subscriptionSnapshot() {
  const rows = await db.orm.public.Subscription.select("status", "expiryDate").all();
  const states = rows.map((row) => deriveSubscriptionState({ status: row.status, expiryDate: String(row.expiryDate) }));

  return {
    active: states.filter((state) => state === "ACTIVE" || state === "EXPIRING").length,
    expiring: states.filter((state) => state === "EXPIRING").length,
  };
}

/** Unpaid orders whose customer already uploaded a transfer proof (to verify). */
async function proofsAwaitingReview() {
  const unpaid = await db.orm.public.SubscriptionRequest.where((order) => order.status.in(UNPAID)).select("id").all();

  return (await proofUploadTimes(unpaid.map((order) => order.id))).size;
}

async function recentOrders(limit = 6) {
  const rows = await db.orm.public.SubscriptionRequest.orderBy((order) => order.id.desc()).limit(limit).all();
  const customers = await customersById(rows.map((row) => row.userId));

  return rows.map((row) => {
    const order = serializeOrder(row, { staff: true });

    return { id: order.id, number: order.number, status: order.status, serviceName: order.serviceName, price: order.price, createdAt: order.createdAt, customerName: customers.get(row.userId)?.name ?? null };
  });
}

async function recentActivity(limit = 8) {
  const events = await db.orm.public.ActivityEvent.orderBy((event) => event.id.desc()).limit(limit).all();
  const people = await customersById(events.map((event) => event.actorUserId ?? 0));

  return events.map((event) => ({
    id: event.id,
    action: event.action,
    entityType: event.entityType,
    summary: event.summary,
    createdAt: String(event.createdAt),
    actorName: event.actorUserId ? (people.get(event.actorUserId)?.name ?? null) : null,
    actorRole: event.actorRole,
  }));
}

async function expiringSoon() {
  const due = (await listRenewalsDue()).filter((item) => deriveSubscriptionState(item) === "EXPIRING");
  const customers = await customersById(due.map((item) => item.userId));

  return due.map((item) => ({ id: item.id, userId: item.userId, packageName: item.packageName, expiryDate: String(item.expiryDate), customerName: customers.get(item.userId)?.name ?? null }));
}

async function readyToActivate() {
  return (await listOrdersAdmin({ statuses: ["PAID", "FULFILLING"] })).map((order) => ({
    id: order.id,
    number: order.number,
    serviceName: order.serviceName,
    requestType: order.requestType,
    customerName: order.customer?.name ?? null,
  }));
}

async function waitingTickets() {
  return (await getAllSupportTickets())
    .filter((ticket) => ticket.status !== "CLOSED" && ticket.lastSender === "CUSTOMER")
    .map((ticket) => ({ id: ticket.id, subject: ticket.subject, userName: ticket.userName, updatedAt: ticket.updatedAt, status: ticket.status }));
}

async function setupAlerts() {
  const settings = await getSettings();

  return {
    missingWhatsapp: !settings["contact.whatsapp"],
    termsDraft: !settings.savedKeys.includes("legal.terms"),
    privacyDraft: !settings.savedKeys.includes("legal.privacy"),
    missingTransferNumber: !String(settings["payment.transferNumber"] ?? "").trim(),
  };
}

export async function getDashboard(role: string) {
  const can = (permission: Permission) => hasPermission(role, permission);

  const [queues, finance, orders, subscriptions, customers, proofs, latestOrders, ready, tickets, expiring, activity, incidents, setup] = await Promise.all([
    load(true, "QUEUES", () => getQueueCounts()),
    load(can("finance"), "FINANCE", () => getFinanceSnapshot({ period: "month", view: "day", from: null, to: null })),
    load(can("orders"), "ORDERS", orderKpi),
    load(can("subscriptions"), "SUBSCRIPTIONS", subscriptionSnapshot),
    load(can("customers"), "CUSTOMERS", customerSnapshot),
    load(can("orders"), "PROOFS", proofsAwaitingReview),
    load(can("orders"), "RECENT_ORDERS", () => recentOrders()),
    load(can("orders"), "READY", readyToActivate),
    load(can("support"), "TICKETS", waitingTickets),
    load(can("subscriptions"), "EXPIRING", expiringSoon),
    load(can("audit"), "ACTIVITY", () => recentActivity()),
    load(true, "INCIDENTS", () => getActiveIncidents()),
    load(can("settings"), "SETUP", setupAlerts),
  ]);

  return { can, queues, finance, orders, subscriptions, customers, proofs, latestOrders, ready, tickets, expiring, activity, incidents, setup, timeZone: BUSINESS_TIME_ZONE };
}

export type Dashboard = Awaited<ReturnType<typeof getDashboard>>;
