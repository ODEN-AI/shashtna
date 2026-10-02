import { ORDER_STATUS_LABELS, REQUEST_TYPE_LABELS, isOpen, type OrderStatus } from "@/src/lib/order-status";
import { journeySteps, needsPayment, orderStage } from "@/src/lib/order-journey";
import { audienceMatches, mediaOf, type Viewer } from "@/src/lib/promotions";
import { safeHref } from "@/src/lib/safe-href";
import { SUBSCRIPTION_STATE_LABELS } from "@/src/lib/subscription-state";
import type { SupportTicket } from "@/src/lib/support-store";
import { listEntityActivity } from "@/src/server/activity";
import { getActiveIncidents, getLiveAnnouncements } from "@/src/server/content";
import { parseDestination } from "@/src/server/mobile/destinations";
import { getOrderForUser, listOrdersForUser, type Order } from "@/src/server/orders";
import { proofUploadTimes } from "@/src/server/payment-proofs";
import { getSettings, manualTransferDetails, safeExternalUrl, whatsappLink } from "@/src/server/settings";
import type { CustomerSubscription } from "@/src/server/subscriptions";
import { TICKET_STATUS_LABELS } from "@/src/server/tickets";

/**
 * Response shapes of the app contract (/api/mobile/*), built only from the
 * services the website itself uses. Nothing here decides prices, statuses
 * or permissions; it only shapes data for phones.
 */

/** Relative media paths (/uploads/...) become absolute for the app; only https otherwise. */
export function absoluteUrl(request: Request, value: string | null | undefined) {
  const text = String(safeHref(value) ?? "").trim();

  if (!text) return null;
  if (/^https:\/\//.test(text)) return text;
  if (text.startsWith("/") && !text.startsWith("//")) return `${new URL(request.url).origin}${text}`;
  return null;
}

// ------------------------------------------------------------------ content

type AnnouncementRow = Awaited<ReturnType<typeof getLiveAnnouncements>>[number];

/** The surface the app shares with the website: Admin → Ads & announcements targeted at ALL or WEBSITE. */
export const APP_SURFACE = "WEBSITE" as const;

export const GUEST_VIEWER: Viewer = { state: "GUEST", vip: false };

/**
 * One ad/announcement in the app's shape. Admin kinds AD (and any other
 * promotional kind) are offers; ANNOUNCEMENT and NEWS are announcements.
 * An internal CTA path becomes a typed destination, an https CTA an external
 * URL; nothing else is sent. `mediaType`/`videoUrl` are additive (newer
 * builds); imageUrl stays the image/poster for every build.
 */
export function serializeAnnouncement(request: Request, item: AnnouncementRow) {
  const cta = String(item.ctaUrl ?? "").trim();
  const destination = cta ? parseDestination(cta) : null;
  const kind = String(item.kind).toUpperCase();
  const media = mediaOf(item);

  return {
    id: item.id,
    kind: kind === "ANNOUNCEMENT" || kind === "NEWS" ? ("ANNOUNCEMENT" as const) : ("OFFER" as const),
    title: item.title,
    description: item.description,
    imageUrl: absoluteUrl(request, item.imageUrl),
    mediaType: media.type,
    videoUrl: media.videoUrl ? absoluteUrl(request, media.videoUrl) : null,
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

/** Live offers and announcements for a viewer (audience rules as on the website). */
export async function mobileContent(request: Request, viewer: Viewer = GUEST_VIEWER) {
  const items = (await getLiveAnnouncements(APP_SURFACE))
    .filter((item) => audienceMatches(item.audience, viewer))
    .map((item) => serializeAnnouncement(request, item));

  return {
    offers: items.filter((item) => item.kind === "OFFER"),
    announcements: items.filter((item) => item.kind === "ANNOUNCEMENT"),
  };
}

/** One live item (any audience: links from notifications must open), or null once ended/removed. */
export async function liveContentItem(request: Request, id: number) {
  const item = (await getLiveAnnouncements(APP_SURFACE)).find((row) => row.id === id);
  return item ? serializeAnnouncement(request, item) : null;
}

// ---------------------------------------------------------------- incidents

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

/** Published, unresolved incidents that concern the service (website-only incidents are left out). */
export async function activeIncidents() {
  return (await getActiveIncidents()).filter((incident) => incident.component !== "WEBSITE").map(serializeIncident);
}

// --------------------------------------------------------- settings: pay/help

export async function paymentDetails() {
  const settings = await getSettings();

  return {
    transfer: manualTransferDetails(settings),
    instructions: settings["payment.instructions"].trim() || null,
  };
}

/** Admin → Settings contact channels (WhatsApp included whenever configured). */
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

// ------------------------------------------------------------------- orders

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
    contactMethod: order.contactMethod,
    paymentMethod: order.paymentMethod,
    paymentReference: order.paymentReference,
    customerNote: order.customerNote,
    status: order.status,
    statusLabel: label?.ar ?? order.status,
    statusHint: label?.hintAr ?? "",
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

export type MobileOrder = ReturnType<typeof shapeOrder>;

export async function listMobileOrders(userId: number) {
  const orders = await listOrdersForUser(userId);
  const proofs = await proofUploadTimes(orders.map((order) => order.id));

  return orders.map((order) => shapeOrder(order, proofs.get(order.id) ?? null));
}

/** Order + journey, payment details (only while payment/review is relevant) and customer-visible timeline. */
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
    events: events.map((event) => ({ id: event.id, action: event.action, summary: event.summary, createdAt: String(event.createdAt) })),
  };
}

/** The customer's own order as a detail, or null (other customers' ids are indistinguishable from missing). */
export async function ownOrderDetail(userId: number, orderId: number | null) {
  const order = orderId ? await getOrderForUser(userId, orderId) : null;
  return order ? mobileOrderDetail(order) : null;
}

// ------------------------------------------------------------ subscriptions

/**
 * IPTV login details (username / password / MAC / device id) are sent only
 * by the subscription detail endpoint, like the website's subscription page.
 * Lists and the dashboard never carry them (the app caches lists on disk).
 * The flat credential keys older builds read are kept, always null in lists.
 */
export function shapeSubscription(subscription: CustomerSubscription, options: { credentials?: boolean } = {}) {
  const { username, password, macAddress, deviceId, ...rest } = subscription;
  const credentials = options.credentials ? { username, password, macAddress, deviceId } : null;

  return {
    ...rest,
    stateLabel: SUBSCRIPTION_STATE_LABELS[subscription.state].ar,
    canRenew: Boolean(subscription.packageSlug),
    credentials,
    username: credentials?.username ?? null,
    password: credentials?.password ?? null,
    macAddress: credentials?.macAddress ?? null,
    deviceId: credentials?.deviceId ?? null,
  };
}

// ------------------------------------------------------------------ support

/**
 * A ticket in the shape both app generations read: the full record older
 * builds use (messages, userName, …) plus the summary fields of the current
 * app. Staff names stay internal: customers see "Shashtna support".
 */
export function shapeTicket(ticket: SupportTicket) {
  const last = ticket.messages[ticket.messages.length - 1];

  return {
    id: ticket.id,
    userId: ticket.userId,
    userName: ticket.userName,
    userPhone: ticket.userPhone,
    subject: ticket.subject,
    category: ticket.category,
    status: ticket.status,
    statusLabel: TICKET_STATUS_LABELS[ticket.status]?.ar ?? ticket.status,
    lastSender: ticket.lastSender,
    lastMessage: last ? last.message.slice(0, 160) : null,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    context: ticket.context ?? null,
    messages: ticket.messages.map((message) => ({
      id: message.id,
      sender: message.sender,
      senderName: message.sender === "ADMIN" ? "دعم شاشتنا" : message.senderName,
      message: message.message,
      createdAt: message.createdAt,
    })),
  };
}

// ------------------------------------------------------------ notifications

export function shapeNotification(item: { id: number; type: string; title: string; body: string; link: string | null; readAt: string | null; createdAt: string }) {
  return {
    id: item.id,
    type: item.type,
    title: item.title,
    body: item.body,
    // Notifications have no image on the website's model.
    imageUrl: null,
    destination: parseDestination(item.link),
    readAt: item.readAt ? String(item.readAt) : null,
    createdAt: String(item.createdAt),
  };
}
