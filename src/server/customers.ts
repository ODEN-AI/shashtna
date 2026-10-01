import { customerStatus, matchesCustomerFilter, parseCustomerSearch, type CustomerQuery, type CustomerStatus } from "@/src/lib/customers";
import { loadSection } from "@/src/lib/dashboard-section";
import { addDays, startOfDay } from "@/src/lib/business-time";
import { inRange, parseInstant } from "@/src/lib/finance";
import { isOpen, isUnpaid, formatOrderNumber } from "@/src/lib/order-status";
import { hasPermission, isStaffRole, normalizeRole, type Permission } from "@/src/lib/roles";
import { deriveSubscriptionState } from "@/src/lib/subscription-state";
import { db } from "@/src/prisma/db";
import { renewalWindow } from "@/src/server/admin-queues";
import { maskedPassword } from "@/src/server/credentials";
import { listOrdersForUser } from "@/src/server/orders";
import { proofUploadTimes } from "@/src/server/payment-proofs";
import { listReceiptsForUser, listSubscriptionsForUser } from "@/src/server/subscriptions";
import { listTicketsForUser } from "@/src/server/tickets";

/**
 * Customer 360 data. Composes the existing systems (users, subscriptions
 * with deriveSubscriptionState, orders, receipts, tickets, the audit log)
 * into a staff view. Each section loads only with its permission and
 * reports failure separately from "empty". Subscription passwords are
 * dropped here, before anything is rendered; revealing one is only ever the
 * existing audited endpoint.
 */

const RECENT_DAYS = 30;

// ------------------------------------------------------------------ index

export async function listCustomers(role: string, query: CustomerQuery) {
  const can = (permission: Permission) => hasPermission(role, permission);
  const search = parseCustomerSearch(query.q);

  const [users, subscriptions, orders] = await Promise.all([
    loadSection(true, "CUSTOMERS", async () => await db.orm.public.User.select("id", "name", "phone", "email", "role", "createdAt").orderBy((user) => user.id.desc()).all()),
    loadSection(can("subscriptions"), "CUSTOMER_SUBS", async () => await db.orm.public.Subscription.select("id", "userId", "status", "expiryDate").all()),
    loadSection(can("orders"), "CUSTOMER_ORDERS", async () => await db.orm.public.SubscriptionRequest.select("id", "userId", "status", "createdAt").orderBy((order) => order.id.desc()).all()),
  ]);

  if (!users?.ok) return { ok: false as const, can };

  const recentFrom = addDays(startOfDay(new Date()), -(RECENT_DAYS - 1));
  const subsByUser = new Map<number, { id: number; state: ReturnType<typeof deriveSubscriptionState>; expiryDate: string }[]>();
  if (subscriptions?.ok) {
    for (const sub of subscriptions.data) {
      const list = subsByUser.get(sub.userId) ?? [];
      list.push({ id: sub.id, state: deriveSubscriptionState({ status: sub.status, expiryDate: String(sub.expiryDate) }), expiryDate: String(sub.expiryDate) });
      subsByUser.set(sub.userId, list);
    }
  }
  const latestOrder = new Map<number, { id: number; number: string; status: string }>();
  const ordersCount = new Map<number, number>();
  if (orders?.ok) {
    for (const order of orders.data) {
      if (!latestOrder.has(order.userId)) latestOrder.set(order.userId, { id: order.id, number: formatOrderNumber(order.id), status: order.status });
      ordersCount.set(order.userId, (ordersCount.get(order.userId) ?? 0) + 1);
    }
  }

  // Numeric / order-number search can also point at a subscription or an order (only where the role may see them).
  const idMatches = new Set<number>();
  if (search.numeric !== null) {
    idMatches.add(search.numeric);
    if (subscriptions?.ok) subscriptions.data.filter((sub) => sub.id === search.numeric).forEach((sub) => idMatches.add(sub.userId));
    if (orders?.ok) orders.data.filter((order) => order.id === search.numeric).forEach((order) => idMatches.add(order.userId));
  }
  if (search.orderId !== null && orders?.ok) orders.data.filter((order) => order.id === search.orderId).forEach((order) => idMatches.add(order.userId));

  const rows = users.data
    .map((user) => {
      const subs = subsByUser.get(user.id) ?? [];
      const live = subs.filter((sub) => sub.state !== "SUSPENDED").map((sub) => sub.expiryDate).sort();
      const upcoming = subs.filter((sub) => sub.state === "ACTIVE" || sub.state === "EXPIRING").map((sub) => sub.expiryDate).sort()[0] ?? null;

      return {
        id: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: normalizeRole(user.role),
        staff: isStaffRole(normalizeRole(user.role)),
        createdAt: String(user.createdAt),
        recent: inRange(parseInstant(String(user.createdAt)), { start: recentFrom, end: new Date(8.64e15) }),
        subscriptions: subscriptions?.ok ? { total: subs.length, active: subs.filter((sub) => sub.state === "ACTIVE" || sub.state === "EXPIRING").length, status: customerStatus(subs.map((sub) => sub.state)) as CustomerStatus, nextExpiry: upcoming ?? live[live.length - 1] ?? null } : null,
        latestOrder: orders?.ok ? (latestOrder.get(user.id) ?? null) : null,
        orders: orders?.ok ? (ordersCount.get(user.id) ?? 0) : null,
      };
    })
    .filter((row) => {
      if (!search.text) return true;
      if (search.orderId !== null) return idMatches.has(row.id);
      // Digits are an id, and (from 4 digits) also part of a phone number.
      if (search.numeric !== null) return idMatches.has(row.id) || (search.text.replace("#", "").length >= 4 && !search.text.startsWith("#") && row.phone.includes(search.text));
      return row.name.toLowerCase().includes(search.text) || row.phone.includes(search.text) || String(row.email ?? "").toLowerCase().includes(search.text);
    })
    .filter((row) => matchesCustomerFilter(query.filter, { staff: row.staff, status: row.subscriptions?.status ?? null, recent: row.recent }));

  return { ok: true as const, can, rows, subscriptionsFailed: subscriptions?.ok === false, ordersFailed: orders?.ok === false };
}

// ------------------------------------------------------------------ Customer 360

/** Activity entity types each permission may see (audit sees everything). */
function activityTypes(can: (permission: Permission) => boolean) {
  return [
    can("orders") && "ORDER",
    can("orders") && "LEAD",
    can("subscriptions") && "SUBSCRIPTION",
    can("support") && "TICKET",
    can("support") && "NOTIFICATION",
    can("customers") && "USER",
    can("customers") && "PASSWORD_RESET",
  ].filter(Boolean) as string[];
}

export async function getCustomer360(role: string, customerId: number) {
  const can = (permission: Permission) => hasPermission(role, permission);
  const customer = await db.orm.public.User.select("id", "name", "phone", "email", "role", "createdAt", "preferredContact", "renewalReminders").where({ id: customerId }).first();

  if (!customer) return null;

  const [subscriptions, orders, receipts, tickets, activity, contacts] = await Promise.all([
    loadSection(can("subscriptions"), "C360_SUBSCRIPTIONS", async () =>
      // Map to a safe shape immediately: the stored password never leaves this function.
      (await listSubscriptionsForUser(customer.id)).map(({ password, ...sub }) => ({ ...sub, ...maskedPassword(password) })),
    ),
    loadSection(can("orders"), "C360_ORDERS", async () => {
      const list = await listOrdersForUser(customer.id);
      const proofs = await proofUploadTimes(list.filter((order) => isUnpaid(order.status)).map((order) => order.id));

      return list.map((order) => ({
        id: order.id,
        number: order.number,
        status: order.status,
        requestType: order.requestType,
        serviceName: order.serviceName,
        price: order.price,
        deviceName: order.deviceName,
        devicePrice: order.devicePrice,
        subscriptionId: order.subscriptionId,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        proofUploadedAt: proofs.get(order.id) ?? null,
      }));
    }),
    loadSection(can("orders"), "C360_RECEIPTS", async () => (await listReceiptsForUser(customer.id)).reduce((sum, receipt) => sum + receipt.price, 0)),
    loadSection(can("support"), "C360_TICKETS", async () =>
      (await listTicketsForUser(customer.id)).map((ticket) => ({ id: ticket.id, subject: ticket.subject, status: ticket.status, updatedAt: ticket.updatedAt, waitingOnTeam: ticket.status !== "CLOSED" && ticket.lastSender === "CUSTOMER" })),
    ),
    loadSection(can("audit") || activityTypes(can).length > 0, "C360_ACTIVITY", async () => {
      let scope = db.orm.public.ActivityEvent.where({ userId: customer.id });
      if (!can("audit")) scope = scope.where((event) => event.entityType.in(activityTypes(can)));

      return (await scope.orderBy((event) => event.id.desc()).limit(20).all()).map((event) => ({ id: event.id, entityType: event.entityType, entityId: event.entityId, action: event.action, summary: event.summary, createdAt: String(event.createdAt), actorRole: event.actorRole }));
    }),
    loadSection(can("subscriptions"), "C360_CONTACTS", async () => await db.orm.public.ActivityEvent.where({ userId: customer.id, action: "RENEWAL_CONTACTED" }).orderBy((event) => event.id.desc()).limit(50).all()),
  ]);

  // Renewal context: the existing renewal window (ending in 14 days / ended in the last 30) and states.
  const renewals =
    subscriptions === null
      ? null
      : subscriptions.ok
        ? (() => {
            const { from, to } = renewalWindow();
            const lastContact = new Map<string, string>();
            if (contacts?.ok) for (const event of contacts.data) if (event.entityId && !lastContact.has(event.entityId)) lastContact.set(event.entityId, String(event.createdAt));
            const openRenewal = new Map<number, { id: number; number: string; status: string }>();
            if (orders?.ok) for (const order of orders.data) if (order.subscriptionId && isOpen(order.status) && ["RENEW", "UPGRADE"].includes(order.requestType) && !openRenewal.has(order.subscriptionId)) openRenewal.set(order.subscriptionId, { id: order.id, number: order.number, status: order.status });

            return {
              ok: true as const,
              data: subscriptions.data
                .filter((sub) => {
                  // Same window and exclusion as listRenewalsDue().
                  const expiry = parseInstant(sub.expiryDate)?.getTime() ?? Number.NaN;
                  return sub.status.toUpperCase() !== "CANCELLED" && expiry >= Date.parse(from) && expiry <= Date.parse(to);
                })
                .map((sub) => ({ id: sub.id, packageName: sub.packageName, state: sub.state, daysRemaining: sub.daysRemaining, expiryDate: sub.expiryDate, lastContactAt: lastContact.get(String(sub.id)) ?? null, openRenewalOrder: openRenewal.get(sub.id) ?? null })),
            };
          })()
        : { ok: false as const };

  return {
    can,
    customer: { ...customer, role: normalizeRole(customer.role), createdAt: String(customer.createdAt), staff: isStaffRole(normalizeRole(customer.role)) },
    subscriptions,
    orders,
    receipts,
    tickets,
    activity,
    renewals,
  };
}

export type Customer360 = NonNullable<Awaited<ReturnType<typeof getCustomer360>>>;
