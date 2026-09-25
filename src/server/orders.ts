import { db } from "@/src/prisma/db";
import {
  ORDER_STATUS_LABELS,
  UNPAID_STORED_STATUSES,
  canTransition,
  formatOrderNumber,
  isUnpaid,
  normalizeOrderStatus,
  type OrderStatus,
} from "@/src/lib/order-status";
import { logActivity } from "@/src/server/activity";
import { notify } from "@/src/server/notifications";
import { normalizeServiceType } from "@/src/server/catalog";

export const REQUEST_TYPES = ["NEW", "RENEW", "UPGRADE", "DEVICE_PURCHASE"] as const;
export type RequestType = (typeof REQUEST_TYPES)[number];

export const CONTACT_METHODS = [
  "PENDING",
  "TELEGRAM",
  "FACEBOOK",
  "WHATSAPP",
  "PHONE",
] as const;
export type ContactMethod = (typeof CONTACT_METHODS)[number];

type OrderRow = Awaited<
  ReturnType<typeof db.orm.public.SubscriptionRequest.first>
> & {};

export type Order = ReturnType<typeof serializeOrder>;

export function serializeOrder(row: NonNullable<OrderRow>, options: { staff?: boolean } = {}) {
  return {
    id: row.id,
    number: formatOrderNumber(row.id),
    userId: row.userId,
    requestType: String(row.requestType ?? "NEW").toUpperCase(),
    serviceType: String(row.serviceType ?? "IPTV").toUpperCase(),
    serviceName: row.serviceName,
    planSlug: row.planSlug,
    price: row.price,
    durationMonths: row.durationMonths,
    durationLabel: row.durationLabel,
    bonusYears: row.bonusYears,
    deviceId: row.deviceId,
    deviceName: row.deviceName,
    devicePrice: row.devicePrice,
    contactMethod: String(row.contactMethod ?? "PENDING").toUpperCase(),
    paymentMethod: row.paymentMethod,
    paymentReference: row.paymentReference,
    customerNote: row.customerNote,
    adminNote: options.staff ? row.adminNote : null,
    status: normalizeOrderStatus(row.status),
    storedStatus: row.status,
    subscriptionId: row.subscriptionId,
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
  };
}

export type CreateOrderInput = {
  requestType: unknown;
  planSlug?: unknown;
  deviceId?: unknown;
  subscriptionId?: unknown;
  contactMethod?: unknown;
  paymentMethod?: unknown;
  customerNote?: unknown;
};

export type CreateOrderResult =
  | { ok: true; order: Order; alreadyExists: boolean }
  | { ok: false; status: number; error: string };

function fail(status: number, error: string): CreateOrderResult {
  return { ok: false, status, error };
}

function cleanText(value: unknown, max: number) {
  const text = String(value ?? "").trim();

  return text ? text.slice(0, max) : null;
}

function positiveInt(value: unknown) {
  const number = Number(value);

  return Number.isInteger(number) && number > 0 ? number : null;
}

/**
 * Creates (or, for a repeated submission, updates) a customer order.
 *
 * Business rules are the ones the site used before the redesign:
 * - VIP new subscriptions need a compatible, active VIP device; the price is
 *   plan + device.
 * - Device purchases are orders of type DEVICE_PURCHASE.
 * - A repeated unpaid order for the same plan and type updates the existing
 *   order instead of creating a duplicate.
 */
export async function createOrder(
  userId: number,
  input: CreateOrderInput,
): Promise<CreateOrderResult> {
  const requestType = String(input.requestType ?? "").trim().toUpperCase();

  if (!(REQUEST_TYPES as readonly string[]).includes(requestType)) {
    return fail(400, "نوع الطلب غير صحيح.");
  }

  const contactMethod = String(input.contactMethod ?? "PENDING").trim().toUpperCase();

  if (!(CONTACT_METHODS as readonly string[]).includes(contactMethod)) {
    return fail(400, "طريقة التواصل غير صحيحة.");
  }

  const paymentMethod = cleanText(input.paymentMethod, 80);
  const customerNote = cleanText(input.customerNote, 500);

  const user = await db.orm.public.User.first({ id: userId });

  if (!user) {
    return fail(404, "المستخدم غير موجود.");
  }

  const common = {
    contactMethod,
    ...(paymentMethod !== null ? { paymentMethod } : {}),
    ...(customerNote !== null ? { customerNote } : {}),
  };

  // ------------------------------------------------------------------
  // Device purchase
  // ------------------------------------------------------------------
  if (requestType === "DEVICE_PURCHASE") {
    const deviceId = positiveInt(input.deviceId);
    const device = deviceId
      ? await db.orm.public.Device.first({ id: deviceId, isActive: true })
      : null;

    if (!device) {
      return fail(404, "الجهاز غير موجود أو غير متاح حاليًا.");
    }

    return saveOrder(userId, {
      planSlug: `device:${device.slug}`,
      requestType: "DEVICE_PURCHASE",
      serviceType: "DEVICE",
      serviceName: device.name,
      price: device.price,
      durationMonths: 0,
      durationLabel: "Device",
      deviceId: String(device.id),
      deviceName: device.name,
      devicePrice: device.price,
      subscriptionId: null,
      ...common,
    });
  }

  // ------------------------------------------------------------------
  // Plan orders: NEW / RENEW / UPGRADE
  // ------------------------------------------------------------------
  const planSlug = String(input.planSlug ?? "").trim();

  if (!planSlug) {
    return fail(400, "اختر الباقة أولًا.");
  }

  const plan = await db.orm.public.Package.first({ slug: planSlug, isActive: true });

  if (!plan) {
    return fail(400, "الباقة المحددة غير موجودة أو غير متاحة حاليًا.");
  }

  const serviceType = normalizeServiceType(plan.serviceType);

  let subscriptionId: number | null = null;

  if (requestType === "RENEW" || requestType === "UPGRADE") {
    const requested = positiveInt(input.subscriptionId);

    if (requested) {
      const subscription = await db.orm.public.Subscription.first({
        id: requested,
        userId,
      });

      if (!subscription) {
        return fail(404, "الاشتراك المحدد غير موجود.");
      }

      if (
        requestType === "RENEW" &&
        normalizeServiceType(subscription.serviceType) !== serviceType
      ) {
        return fail(400, "باقة التجديد يجب أن تكون من نفس نوع الخدمة.");
      }

      subscriptionId = subscription.id;
    } else if (requestType === "UPGRADE") {
      return fail(400, "حدد الاشتراك المراد ترقيته.");
    }
  }

  let deviceFields: {
    deviceId: string | null;
    deviceName: string | null;
    devicePrice: number | null;
  } = { deviceId: null, deviceName: null, devicePrice: null };

  const needsDevice =
    serviceType === "VIP" && (requestType === "NEW" || requestType === "UPGRADE");

  if (needsDevice) {
    const deviceId = positiveInt(input.deviceId);
    const device = deviceId
      ? await db.orm.public.Device.first({ id: deviceId, isActive: true })
      : null;

    if (!device) {
      return fail(400, "اختر جهاز VIP متوافق مع الباقة.");
    }

    if (normalizeServiceType(device.serviceType) !== "VIP") {
      return fail(400, "الجهاز المحدد ليس جهاز VIP.");
    }

    const compatible = await db.orm.public.PackageDevice.first({
      packageId: plan.id,
      deviceId: device.id,
    });

    if (!compatible) {
      return fail(400, "هذا الجهاز غير متوافق مع الباقة المحددة.");
    }

    deviceFields = {
      deviceId: String(device.id),
      deviceName: device.name,
      devicePrice: device.price,
    };
  }

  return saveOrder(userId, {
    planSlug,
    requestType,
    serviceType,
    serviceName: plan.name,
    price: plan.price + (deviceFields.devicePrice ?? 0),
    durationMonths: plan.durationMonths,
    durationLabel: plan.durationLabel,
    subscriptionId,
    ...deviceFields,
    ...common,
  });
}

type OrderFields = {
  planSlug: string;
  requestType: string;
  serviceType: string;
  serviceName: string;
  price: number;
  durationMonths: number;
  durationLabel: string;
  deviceId: string | null;
  deviceName: string | null;
  devicePrice: number | null;
  subscriptionId: number | null;
  contactMethod: string;
  paymentMethod?: string;
  customerNote?: string;
};

async function saveOrder(userId: number, fields: OrderFields): Promise<CreateOrderResult> {
  const candidates = await db.orm.public.SubscriptionRequest.where({
    userId,
    planSlug: fields.planSlug,
    requestType: fields.requestType,
  })
    .where((order) => order.status.in(UNPAID_STORED_STATUSES))
    .orderBy((order) => order.id.desc())
    .all();

  const existing = candidates.find(
    (order) => (order.subscriptionId ?? null) === fields.subscriptionId,
  );
  const now = new Date().toISOString();

  if (existing) {
    const updated = await db.orm.public.SubscriptionRequest.where({ id: existing.id }).update({
      ...fields,
      // Keep the contact choice the customer already made unless a new one
      // is given.
      contactMethod:
        fields.contactMethod === "PENDING" ? existing.contactMethod : fields.contactMethod,
      updatedAt: now,
    });

    if (!updated) {
      return fail(500, "تعذر تحديث الطلب.");
    }

    return { ok: true, order: serializeOrder(updated), alreadyExists: true };
  }

  const created = await db.orm.public.SubscriptionRequest.create({
    userId,
    status: "SUBMITTED",
    ...fields,
  });

  await logActivity({
    actor: { id: userId, role: "CUSTOMER" },
    userId,
    entityType: "ORDER",
    entityId: created.id,
    action: "ORDER_CREATED",
    summary: `تم إنشاء الطلب ${formatOrderNumber(created.id)} (${fields.serviceName})`,
    customerVisible: true,
  });

  return { ok: true, order: serializeOrder(created), alreadyExists: false };
}

export async function listOrdersForUser(userId: number) {
  const rows = await db.orm.public.SubscriptionRequest.where({ userId })
    .orderBy((order) => order.id.desc())
    .all();

  return rows.map((row) => serializeOrder(row));
}

export async function getOrderForUser(userId: number, orderId: number) {
  const row = await db.orm.public.SubscriptionRequest.first({ id: orderId, userId });

  return row ? serializeOrder(row) : null;
}

export async function getOrder(orderId: number) {
  const row = await db.orm.public.SubscriptionRequest.first({ id: orderId });

  return row ? serializeOrder(row, { staff: true }) : null;
}

/** Customer cancels an order that has not been paid yet. */
export async function cancelOrderByCustomer(userId: number, orderId: number) {
  const row = await db.orm.public.SubscriptionRequest.first({ id: orderId, userId });

  if (!row) {
    return { ok: false as const, error: "الطلب غير موجود." };
  }

  if (!isUnpaid(row.status)) {
    return {
      ok: false as const,
      error: "لا يمكن إلغاء الطلب بعد تأكيد الدفع. تواصل مع الدعم.",
    };
  }

  await db.orm.public.SubscriptionRequest.where({ id: orderId }).update({
    status: "CANCELLED",
    updatedAt: new Date().toISOString(),
  });

  await logActivity({
    actor: { id: userId, role: "CUSTOMER" },
    userId,
    entityType: "ORDER",
    entityId: orderId,
    action: "ORDER_CANCELLED",
    summary: `ألغى العميل الطلب ${formatOrderNumber(orderId)}`,
    customerVisible: true,
  });

  return { ok: true as const };
}

/** Customer records how they will pay / be contacted. */
export async function setOrderContact(
  userId: number,
  orderId: number,
  input: { contactMethod?: unknown; paymentMethod?: unknown; paymentReference?: unknown },
) {
  const row = await db.orm.public.SubscriptionRequest.first({ id: orderId, userId });

  if (!row || !isUnpaid(row.status)) {
    return { ok: false as const, error: "لا يمكن تعديل هذا الطلب." };
  }

  const contactMethod = String(input.contactMethod ?? row.contactMethod).trim().toUpperCase();

  if (!(CONTACT_METHODS as readonly string[]).includes(contactMethod)) {
    return { ok: false as const, error: "طريقة التواصل غير صحيحة." };
  }

  await db.orm.public.SubscriptionRequest.where({ id: orderId }).update({
    contactMethod,
    paymentMethod: cleanText(input.paymentMethod, 80) ?? row.paymentMethod,
    paymentReference: cleanText(input.paymentReference, 120) ?? row.paymentReference,
    updatedAt: new Date().toISOString(),
  });

  return { ok: true as const };
}

/** Staff moves an order through the state machine. */
export async function updateOrderStatus(
  actor: { id: number; role: string },
  orderId: number,
  target: OrderStatus,
  options: { adminNote?: string | null; paymentReference?: string | null } = {},
) {
  const row = await db.orm.public.SubscriptionRequest.first({ id: orderId });

  if (!row) {
    return { ok: false as const, error: "الطلب غير موجود." };
  }

  const current = normalizeOrderStatus(row.status);

  if (current !== target && !canTransition(current, target)) {
    return {
      ok: false as const,
      error: `لا يمكن نقل الطلب من «${ORDER_STATUS_LABELS[current].ar}» إلى «${ORDER_STATUS_LABELS[target].ar}».`,
    };
  }

  await db.orm.public.SubscriptionRequest.where({ id: orderId }).update({
    status: target,
    ...(options.adminNote !== undefined ? { adminNote: cleanText(options.adminNote, 1000) } : {}),
    ...(options.paymentReference
      ? { paymentReference: cleanText(options.paymentReference, 120) }
      : {}),
    updatedAt: new Date().toISOString(),
  });

  if (current !== target) {
    const label = ORDER_STATUS_LABELS[target];

    await logActivity({
      actor,
      userId: row.userId,
      entityType: "ORDER",
      entityId: orderId,
      action: `ORDER_${target}`,
      summary: `الطلب ${formatOrderNumber(orderId)}: ${label.ar}`,
      customerVisible: true,
    });

    await notify({
      userId: row.userId,
      type: "ORDER_STATUS",
      title: `تحديث الطلب ${formatOrderNumber(orderId)}`,
      body: `${label.ar} — ${label.hintAr}`,
      link: `/orders/${orderId}`,
    });
  }

  return { ok: true as const };
}

/**
 * Called after staff create or renew the subscription for an order: marks it
 * completed and links it to the subscription.
 */
export async function completeOrderWithSubscription(
  actor: { id: number; role: string },
  orderId: number,
  subscriptionId: number,
  fields: { price: number; durationMonths: number; durationLabel: string; bonusYears: number },
) {
  const row = await db.orm.public.SubscriptionRequest.first({ id: orderId });

  if (!row) {
    return null;
  }

  const updated = await db.orm.public.SubscriptionRequest.where({ id: orderId }).update({
    status: "COMPLETED",
    subscriptionId,
    ...fields,
    updatedAt: new Date().toISOString(),
  });

  const renewal = String(row.requestType).toUpperCase() === "RENEW";

  await logActivity({
    actor,
    userId: row.userId,
    entityType: "ORDER",
    entityId: orderId,
    action: "ORDER_COMPLETED",
    summary: `الطلب ${formatOrderNumber(orderId)}: مكتمل`,
    customerVisible: true,
  });

  await logActivity({
    actor,
    userId: row.userId,
    entityType: "SUBSCRIPTION",
    entityId: subscriptionId,
    action: renewal ? "SUBSCRIPTION_RENEWED" : "SUBSCRIPTION_CREATED",
    summary: renewal
      ? `تم تجديد الاشتراك (${fields.durationLabel}) من الطلب ${formatOrderNumber(orderId)}`
      : `تم تفعيل الاشتراك (${fields.durationLabel}) من الطلب ${formatOrderNumber(orderId)}`,
    customerVisible: true,
  });

  await notify({
    userId: row.userId,
    type: renewal ? "SUBSCRIPTION_RENEWED" : "SUBSCRIPTION_ACTIVATED",
    title: renewal ? "تم تجديد اشتراكك" : "اشتراكك جاهز",
    body: renewal
      ? `تم تجديد «${row.serviceName}» بنجاح.`
      : `تم تفعيل «${row.serviceName}». تفاصيل الاشتراك موجودة بحسابك.`,
    link: `/subscriptions/${subscriptionId}`,
  });

  return updated;
}
