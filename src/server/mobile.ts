import { db } from "@/src/prisma/db";
import { parseDestination } from "@/src/lib/destinations";
import { ORDER_STATUS_LABELS, REQUEST_TYPE_LABELS, isOpen, type OrderStatus } from "@/src/lib/order-status";
import { journeySteps, needsPayment, orderStage } from "@/src/lib/order-journey";
import { deriveAccountState, pickPrimarySubscription, SUBSCRIPTION_STATE_LABELS } from "@/src/lib/subscription-state";
import { listCustomerActivity, listEntityActivity } from "@/src/server/activity";
import { getActivePackages } from "@/src/server/catalog";
import { getActiveIncidents, getLiveAnnouncements } from "@/src/server/content";
import { countUnreadNotifications, ensureRenewalReminders } from "@/src/server/notifications";
import { listOrdersForUser, type Order } from "@/src/server/orders";
import { proofUploadTimes } from "@/src/server/payment-proofs";
import { getSettings, manualTransferDetails, safeExternalUrl, whatsappLink } from "@/src/server/settings";
import { listSubscriptionsForUser, type CustomerSubscription } from "@/src/server/subscriptions";
import type { MobileUser } from "@/src/server/mobile-api";
import type { SupportTicket } from "@/src/lib/support-store";
import { TICKET_STATUS_LABELS } from "@/src/server/tickets";

/**
 * Response shapes for the mobile app. Everything is derived from the same
 * services the website uses (orders, subscriptions, content, settings); this
 * file only shapes the data for phones.
 */

type AnnouncementRow = Awaited<ReturnType<typeof getLiveAnnouncements>>[number];

/** Relative media paths (/uploads/...) are made absolute for the app. */
export function absoluteUrl(request: Request, value: string | null | undefined) {
  const text = String(value ?? "").trim();

  if (!text) return null;
  if (/^https:\/\//.test(text)) return text;
  if (text.startsWith("/") && !text.startsWith("//")) return `${new URL(request.url).origin}${text}`;
  return null;
}

/**
 * Announcements carry a CTA that may be an internal path (turned into a typed
 * destination) or an https URL (opened in the browser). Nothing else is sent.
 */
export function serializeAnnouncement(request: Request, item: AnnouncementRow) {
  const cta = String(item.ctaUrl ?? "").trim();
  const destination = cta ? parseDestination(cta) : null;

  return {
    id: item.id,
    kind: item.kind === "ANNOUNCEMENT" ? ("ANNOUNCEMENT" as const) : ("OFFER" as const),
    title: item.title,
    description: item.description,
    imageUrl: absoluteUrl(request, item.imageUrl),
    style: item.style,
    placement: item.placement,
    priority: item.priority,
    startsAt: item.startsAt ? String(item.startsAt) : null,
    endsAt: item.endsAt ? String(item.endsAt) : null,
    updatedAt: String(item.updatedAt),
    cta: cta
      ? {
          label: item.ctaLabel || "التفاصيل",
          destination,
          externalUrl: destination ? null : /^https:\/\//.test(cta) ? cta : null,
        }
      : null,
  };
}

export async function mobileContent(request: Request) {
  const items = (await getLiveAnnouncements("MOBILE")).map((item) => serializeAnnouncement(request, item));

  return {
    offers: items.filter((item) => item.kind === "OFFER"),
    announcements: items.filter((item) => item.kind === "ANNOUNCEMENT"),
  };
}

export function serializeIncident(item: {
  id: number;
  title: string;
  message: string;
  status: string;
  component: string;
  startsAt: string;
  resolvedAt: string | null;
  updatedAt: string;
  upcoming?: boolean;
}) {
  return {
    id: item.id,
    title: item.title,
    message: item.message,
    status: item.resolvedAt ? "RESOLVED" : item.status,
    component: item.component,
    startsAt: String(item.startsAt),
    resolvedAt: item.resolvedAt ? String(item.resolvedAt) : null,
    updatedAt: String(item.updatedAt),
    upcoming: Boolean(item.upcoming),
  };
}

export async function activeIncidents() {
  return (await getActiveIncidents())
    .filter((incident) => incident.component !== "WEBSITE")
    .map(serializeIncident);
}

export async function paymentDetails() {
  const settings = await getSettings();
  const transfer = manualTransferDetails(settings);

  return {
    transfer,
    instructions: settings["payment.instructions"].trim() || null,
  };
}

export async function supportChannels() {
  const settings = await getSettings();

  return {
    hours: settings["support.hours"] || null,
    telegram: safeExternalUrl(settings["contact.telegram"]),
    whatsapp: whatsappLink(settings["contact.whatsapp"]),
    facebook: safeExternalUrl(settings["contact.facebook"]),
    phone: settings["contact.phone"] || null,
  };
}

// ------------------------------------------------------------------ orders

export function shapeOrder(order: Order, proofUploadedAt: string | null) {
  const stage = orderStage(order.status, Boolean(proofUploadedAt));
  const label = ORDER_STATUS_LABELS[order.status as OrderStatus];

  return {
    id: order.id,
    number: order.number,
    requestType: order.requestType,
    requestTypeLabel: REQUEST_TYPE_LABELS[order.requestType]?.ar ?? order.requestType,
    serviceType: order.serviceType,
    serviceName: order.serviceName,
    planSlug: order.planSlug,
    price: order.price,
    durationMonths: order.durationMonths,
    durationLabel: order.durationLabel,
    deviceName: order.deviceName,
    devicePrice: order.devicePrice,
    paymentMethod: order.paymentMethod,
    paymentReference: order.paymentReference,
    customerNote: order.customerNote,
    status: order.status,
    statusLabel: label.ar,
    statusHint: label.hintAr,
    stage,
    needsPayment: needsPayment(stage),
    isOpen: isOpen(order.status),
    canCancel: order.status === "SUBMITTED" || order.status === "AWAITING_PAYMENT",
    proofUploadedAt,
    subscriptionId: order.subscriptionId,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

export async function listMobileOrders(userId: number) {
  const orders = await listOrdersForUser(userId);
  const proofs = await proofUploadTimes(orders.map((order) => order.id));

  return orders.map((order) => shapeOrder(order, proofs.get(order.id) ?? null));
}

export async function mobileOrderDetail(order: Order) {
  const [proofs, events, payment] = await Promise.all([
    proofUploadTimes([order.id]),
    listEntityActivity("ORDER", order.id, { customerVisibleOnly: true }),
    paymentDetails(),
  ]);
  const shaped = shapeOrder(order, proofs.get(order.id) ?? null);

  return {
    ...shaped,
    journey: journeySteps(shaped.stage).map((step) => ({ key: step.key, label: step.ar, state: step.state })),
    payment: shaped.needsPayment || shaped.stage === "UNDER_REVIEW" ? payment : { transfer: null, instructions: null },
    events: events.map((event) => ({
      id: event.id,
      action: event.action,
      summary: event.summary,
      createdAt: String(event.createdAt),
    })),
  };
}

// ----------------------------------------------------------- subscriptions

export function shapeSubscription(subscription: CustomerSubscription) {
  return {
    ...subscription,
    stateLabel: SUBSCRIPTION_STATE_LABELS[subscription.state].ar,
    canRenew: Boolean(subscription.packageSlug),
  };
}

// --------------------------------------------------------------- dashboard

/**
 * Everything the home screen needs in one request: account state, the
 * featured subscription, the order that needs attention and its next
 * action, unread notifications, live offers/announcements and incidents.
 */
export async function mobileDashboard(request: Request, user: MobileUser) {
  const subscriptions = await listSubscriptionsForUser(user.id);

  await ensureRenewalReminders(user.id, subscriptions, user.renewalReminders).catch(() => undefined);

  const [orders, unread, content, incidents, activity, packages] = await Promise.all([
    listMobileOrders(user.id),
    countUnreadNotifications(user.id),
    mobileContent(request),
    activeIncidents(),
    listCustomerActivity(user.id, 5),
    getActivePackages(),
  ]);

  const primary = pickPrimarySubscription(subscriptions);
  const openOrders = orders.filter((order) => order.isOpen);
  const state = deriveAccountState(primary, openOrders.length > 0);
  const currentOrder = openOrders[0] ?? null;

  let nextAction: { kind: string; title: string; body: string; orderId?: number; subscriptionId?: number } | null = null;

  if (currentOrder?.needsPayment) {
    nextAction = {
      kind: "PAY_ORDER",
      title: "كمّل الدفع",
      body: `حوّل ${currentOrder.price.toLocaleString("en-US")} د.ع وارفع صورة إثبات الدفع حتى نفعّل طلبك.`,
      orderId: currentOrder.id,
    };
  } else if (currentOrder?.stage === "UNDER_REVIEW") {
    nextAction = {
      kind: "WAIT_REVIEW",
      title: "إثبات الدفع قيد المراجعة",
      body: "فريقنا يراجع التحويل. راح يوصلك إشعار أول ما يتأكد الدفع.",
      orderId: currentOrder.id,
    };
  } else if (currentOrder?.stage === "PAID") {
    nextAction = {
      kind: "WAIT_ACTIVATION",
      title: "تم تأكيد الدفع",
      body: "اشتراكك بالدور للتفعيل. راح يوصلك إشعار أول ما يجهز.",
      orderId: currentOrder.id,
    };
  } else if (primary && (primary.state === "EXPIRING" || primary.state === "EXPIRED")) {
    nextAction = {
      kind: "RENEW",
      title: primary.state === "EXPIRING" ? "اشتراكك ينتهي قريبًا" : "انتهى اشتراكك",
      body:
        primary.state === "EXPIRING"
          ? `باقي ${primary.daysRemaining} ${primary.daysRemaining === 1 ? "يوم" : "أيام"}. جدّد حتى تستمر المشاهدة بدون انقطاع.`
          : "جدّد اشتراكك حتى ترجع المشاهدة.",
      subscriptionId: primary.id,
    };
  } else if (!primary && !currentOrder) {
    nextAction = {
      kind: "CHOOSE_PLAN",
      title: "ابدأ اشتراكك",
      body: "اختار الباقة المناسبة إلك وكمّل الطلب بخطوات بسيطة.",
    };
  }

  return {
    user,
    accountState: state,
    primarySubscription: primary ? shapeSubscription(primary) : null,
    subscriptionsCount: subscriptions.length,
    currentOrder,
    openOrdersCount: openOrders.length,
    nextAction,
    unreadNotifications: unread,
    offers: content.offers.slice(0, 6),
    announcements: content.announcements.slice(0, 6),
    incidents,
    hasPackages: packages.length > 0,
    recentActivity: activity.map((event) => ({
      id: event.id,
      summary: event.summary,
      entityType: event.entityType,
      entityId: event.entityId,
      createdAt: String(event.createdAt),
    })),
    generatedAt: new Date().toISOString(),
  };
}

// ----------------------------------------------------------- notifications

export function shapeNotification(
  request: Request,
  item: { id: number; type: string; title: string; body: string; link: string | null; imageUrl: string | null; readAt: string | null; createdAt: string },
) {
  return {
    id: item.id,
    type: item.type,
    title: item.title,
    body: item.body,
    imageUrl: absoluteUrl(request, item.imageUrl),
    destination: parseDestination(item.link),
    readAt: item.readAt ? String(item.readAt) : null,
    createdAt: String(item.createdAt),
  };
}

export async function packageExists(slug: string) {
  return Boolean(await db.orm.public.Package.first({ slug, isActive: true }));
}

// ----------------------------------------------------------------- support

export function shapeTicket(ticket: SupportTicket, withMessages = false) {
  const last = ticket.messages[ticket.messages.length - 1];

  return {
    id: ticket.id,
    subject: ticket.subject,
    category: ticket.category,
    status: ticket.status,
    statusLabel: TICKET_STATUS_LABELS[ticket.status]?.ar ?? ticket.status,
    lastSender: ticket.lastSender,
    lastMessage: last ? last.message.slice(0, 160) : null,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    context: ticket.context ?? null,
    ...(withMessages
      ? {
          messages: ticket.messages.map((message) => ({
            id: message.id,
            sender: message.sender,
            // Staff names stay internal; customers see "Shashtna support".
            senderName: message.sender === "ADMIN" ? "دعم شاشتنا" : message.senderName,
            message: message.message,
            createdAt: message.createdAt,
          })),
        }
      : {}),
  };
}

