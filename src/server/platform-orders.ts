import { randomInt } from "node:crypto";

import { db } from "@/src/prisma/db";
import { businessDay } from "@/src/lib/business-time";
import { normalizeServiceType } from "@/src/lib/catalogue";
import { deliveryRenews, normalizeDelivery, parseDeliveryEmail, type DeliveryKind } from "@/src/lib/groups";
import { isOpen, normalizeOrderStatus, orderRef } from "@/src/lib/order-status";
import { hasPermission } from "@/src/lib/roles";
import { addMonthsClamped } from "@/src/lib/subscription-duration";
import { logActivity } from "@/src/server/activity";
import { snapshotForOrder } from "@/src/server/costs";
import { awardForOrder } from "@/src/server/loyalty";
import { notify } from "@/src/server/notifications";
import { completeOrderWithSubscription } from "@/src/server/orders";

/**
 * Fulfilling a digital platform order (staff with the "subscriptions"
 * permission, like IPTV activation):
 * - CODE: staff enter the code; the order completes (no subscription, no
 *   receipt: a code is one-off). The code is stored on the order, shown to the
 *   owning customer, masked for staff, and every staff reveal is audited.
 * - ACCOUNT: staff enter the ready account (e-mail + password).
 * - CUSTOMER_EMAIL: activated on the e-mail the customer gave at checkout.
 * Account deliveries create (NEW) or extend (RENEW, same group only) a DIGITAL
 * subscription; its password is masked and revealed like IPTV credentials.
 */

type Actor = { id: number; role: string };
type Fail = { ok: false; status: number; error: string };

function fail(status: number, error: string): Fail {
  return { ok: false, status, error };
}

function receiptNumber() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");

  return `SHASHTNA-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}-${randomInt(1000, 10000)}`;
}

/** The order with its package and group, when it is a digital platform order. */
export async function platformOrder(orderId: number) {
  const order = await db.orm.public.SubscriptionRequest.first({ id: orderId });

  if (!order || normalizeServiceType(order.serviceType) !== "DIGITAL") return null;

  const pkg = await db.orm.public.Package.first({ slug: order.planSlug });
  const group = pkg?.groupId ? await db.orm.public.PackageGroup.first({ id: pkg.groupId }) : null;

  return { order, pkg, group, delivery: normalizeDelivery(group?.delivery) as DeliveryKind };
}

export type FulfilInput = { code?: unknown; accountEmail?: unknown; password?: unknown };

export async function fulfilPlatformOrder(actor: Actor, orderId: number, input: FulfilInput): Promise<{ ok: true; subscriptionId: number | null } | Fail> {
  if (!hasPermission(actor.role, "subscriptions")) return fail(403, "تسليم طلبات المنصات يحتاج صلاحية الاشتراكات.");

  const found = await platformOrder(orderId);

  if (!found || !found.pkg || !found.group) return fail(404, "طلب المنصة غير موجود.");

  const { order, pkg, group, delivery } = found;

  if (!isOpen(order.status)) return fail(400, "هذا الطلب تمت معالجته مسبقاً.");

  // ------------------------------------------------------------- CODE (one-off)
  if (delivery === "CODE") {
    const code = String(input.code ?? "").trim().slice(0, 300);

    if (code.length < 3) return fail(400, "اكتب الكود أو بطاقة الهدية.");

    const cost = await snapshotForOrder(order);
    const now = new Date().toISOString();

    await db.orm.public.SubscriptionRequest.where({ id: orderId }).update({ status: "COMPLETED", deliveryCode: code, ...cost, updatedAt: now });

    await logActivity({ actor, userId: order.userId, entityType: "ORDER", entityId: orderId, action: "ORDER_COMPLETED", summary: `الطلب ${orderRef(orderId)}: تم تسليم الكود`, customerVisible: true });
    await notify({
      userId: order.userId,
      type: "PLATFORM_DELIVERED",
      title: `كود ${group.name} جاهز`,
      body: `تم تسليم كود «${order.serviceName}». تلكاه بصفحة الطلب.`,
      link: `/orders/${orderId}`,
      dedupeKey: `platform-delivered:order:${orderId}`,
    });
    await awardForOrder(orderId, order.price);

    return { ok: true, subscriptionId: null };
  }

  // ------------------------------------------------------------- ACCOUNT / CUSTOMER_EMAIL
  const requestType = String(order.requestType).toUpperCase();
  const existing = requestType === "RENEW" && order.subscriptionId ? await db.orm.public.Subscription.first({ id: order.subscriptionId, userId: order.userId }) : null;

  if (requestType === "RENEW") {
    if (!deliveryRenews(delivery)) return fail(400, "هذي المنصة بكود: ما تتجدد.");

    const current = existing?.packageId ? await db.orm.public.Package.first({ id: existing.packageId }) : null;

    if (!existing || normalizeServiceType(existing.serviceType) !== "DIGITAL" || current?.groupId !== pkg.groupId) {
      return fail(400, "التجديد لازم يكون لاشتراك من نفس المنصة.");
    }
  }

  const accountEmail = delivery === "CUSTOMER_EMAIL" ? parseDeliveryEmail(order.deliveryEmail) : parseDeliveryEmail(input.accountEmail) ?? (existing ? parseDeliveryEmail(existing.accountEmail) : null);
  const password = String(input.password ?? "").trim().slice(0, 200) || null;

  if (!accountEmail) return fail(400, delivery === "CUSTOMER_EMAIL" ? "إيميل حساب العميل غير موجود على الطلب." : "اكتب إيميل الحساب الجاهز.");
  if (delivery === "ACCOUNT" && !existing && !password) return fail(400, "اكتب كلمة مرور الحساب الجاهز.");

  const months = order.durationMonths;
  const today = businessDay(new Date());
  const currentExpiry = existing ? String(existing.expiryDate).slice(0, 10) : null;
  const base = currentExpiry && currentExpiry >= today ? currentExpiry : today;
  const expiry = addMonthsClamped(base, months);

  if (!expiry) return fail(400, "تعذر حساب تاريخ الانتهاء.");

  const subscriptionId = await db.transaction(async (tx) => {
    const row = existing
      ? await tx.orm.public.Subscription.where({ id: existing.id }).update({
          status: "ACTIVE",
          expiryDate: expiry,
          packageName: order.serviceName,
          accountEmail,
          ...(password ? { password } : {}),
        })
      : await tx.orm.public.Subscription.create({
          userId: order.userId,
          serviceType: "DIGITAL",
          packageId: pkg.id,
          packageName: order.serviceName,
          accountEmail,
          password,
          status: "ACTIVE",
          startDate: today,
          expiryDate: expiry,
        });

    if (!row) throw new Error("PLATFORM_SUBSCRIPTION_NOT_SAVED");

    await tx.orm.public.Receipt.create({
      receiptNumber: receiptNumber(),
      userId: order.userId,
      orderId,
      subscriptionId: row.id,
      serviceType: "DIGITAL",
      serviceName: order.serviceName,
      price: order.price,
      durationMonths: months,
      durationLabel: order.durationLabel,
      bonusYears: 0,
      status: "PAID",
    });

    return row.id;
  });

  // Same completion as IPTV: cost snapshot, loyalty, activity and the customer's notification.
  await completeOrderWithSubscription(actor, orderId, subscriptionId, { price: order.price, durationMonths: months, durationLabel: order.durationLabel, bonusYears: 0 });

  return { ok: true, subscriptionId };
}

/** Staff reveal a delivered code (audited, like IPTV credentials). */
export async function revealDeliveryCode(actor: Actor, orderId: number): Promise<{ ok: true; code: string } | Fail> {
  if (!hasPermission(actor.role, "subscriptions")) return fail(403, "ليس لديك صلاحية لعرض الكود.");

  const order = await db.orm.public.SubscriptionRequest.first({ id: orderId });

  if (!order?.deliveryCode) return fail(404, "ماكو كود على هذا الطلب.");

  await logActivity({ actor, userId: order.userId, entityType: "ORDER", entityId: orderId, action: "ORDER_DELIVERY_CODE_REVEALED", summary: `عرض كود الطلب ${orderRef(orderId)}` });

  return { ok: true, code: order.deliveryCode };
}

/** The code for the customer who owns the order, once it is delivered (null otherwise). */
export async function ownDeliveryCode(userId: number, orderId: number) {
  const order = await db.orm.public.SubscriptionRequest.first({ id: orderId, userId });

  return order && normalizeOrderStatus(order.status) === "COMPLETED" ? (order.deliveryCode ?? null) : null;
}
