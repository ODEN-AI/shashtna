import { randomInt } from "node:crypto";

import { db } from "@/src/prisma/db";
import { businessDay } from "@/src/lib/business-time";
import { parseSupplierOrder } from "@/src/lib/costs";
import { orderRef } from "@/src/lib/order-status";
import { addMonthsClamped, formatDurationAr } from "@/src/lib/subscription-duration";
import { logActivity } from "@/src/server/activity";
import { notify } from "@/src/server/notifications";

/**
 * A subscription the supplier made from his own panel for a customer who came
 * through him (paid to the owner by chat). Recorded like any sale so profit,
 * expiry, renewals and support work: a COMPLETED IPTV order (channel
 * SUPPLIER, no credit cost, the supplier's share stored), its subscription
 * (new, or the customer's existing IPTV one extended) and a receipt. It earns
 * no loyalty points. Only for customers who already have an account (owner
 * decision, 2026-10-31).
 */

type Actor = { id: number; role: string };

export const SUPPLIER_SERVICE_NAME = "IPTV — عن طريق المورّد";

function receiptNumber() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");

  return `SHASHTNA-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}-${randomInt(1000, 10000)}`;
}

export type SupplierOrderResult = { ok: true; orderId: number; subscriptionId: number } | { ok: false; status: number; error: string };

export async function createSupplierSubscription(actor: Actor, userId: number, raw: Record<string, unknown>): Promise<SupplierOrderResult> {
  if (String(actor.role).toUpperCase() !== "OWNER") {
    return { ok: false, status: 403, error: "تسجيل اشتراك المورّد للمالك فقط." };
  }

  const parsed = parseSupplierOrder(raw);

  if (!parsed.ok) return { ok: false, status: 400, error: parsed.error };

  const input = parsed.value;
  const customer = await db.orm.public.User.first({ id: userId });

  if (!customer) return { ok: false, status: 404, error: "العميل غير موجود." };

  const existing = input.subscriptionId ? await db.orm.public.Subscription.first({ id: input.subscriptionId, userId }) : null;

  if (input.subscriptionId && (!existing || String(existing.serviceType ?? "IPTV").toUpperCase() !== "IPTV")) {
    return { ok: false, status: 404, error: "اشتراك IPTV المحدد غير موجود لهذا العميل." };
  }

  if (!existing && (await db.orm.public.Subscription.first({ username: input.username }))) {
    return { ok: false, status: 409, error: "اسم المستخدم مستعمل لاشتراك ثاني." };
  }

  const today = businessDay(new Date());
  const currentExpiry = existing ? String(existing.expiryDate).slice(0, 10) : null;
  // A renewal extends a subscription that is still running; otherwise it starts today.
  const base = currentExpiry && currentExpiry >= today ? currentExpiry : today;
  const expiry = addMonthsClamped(base, input.months);

  if (!expiry) return { ok: false, status: 400, error: "تعذر حساب تاريخ الانتهاء." };

  const label = formatDurationAr(input.months);
  const now = new Date().toISOString();

  const { orderId, subscriptionId } = await db.transaction(async (tx) => {
    const subscription = existing
      ? await tx.orm.public.Subscription.where({ id: existing.id }).update({ status: "ACTIVE", expiryDate: expiry, packageName: SUPPLIER_SERVICE_NAME })
      : await tx.orm.public.Subscription.create({
          userId,
          serviceType: "IPTV",
          username: input.username,
          password: input.password,
          macAddress: input.macAddress,
          status: "ACTIVE",
          packageName: SUPPLIER_SERVICE_NAME,
          startDate: today,
          expiryDate: expiry,
        });

    if (!subscription) throw new Error("SUPPLIER_SUBSCRIPTION_NOT_SAVED");

    const order = await tx.orm.public.SubscriptionRequest.create({
      userId,
      status: "COMPLETED",
      planSlug: "supplier:iptv",
      packageOptionId: null,
      serviceType: "IPTV",
      serviceName: SUPPLIER_SERVICE_NAME,
      requestType: existing ? "RENEW" : "NEW",
      price: input.price,
      durationMonths: input.months,
      durationLabel: label,
      bonusYears: 0,
      deviceId: null,
      deviceName: null,
      devicePrice: null,
      contactMethod: "PENDING",
      paymentMethod: "عن طريق المورّد",
      subscriptionId: subscription.id,
      channel: "SUPPLIER",
      supplierShareIqd: input.supplierShare,
      // The supplier spends his own panel credit: a known zero, not unknown.
      creditCostCents: 0,
      creditCostIqd: 0,
      creditPurchaseId: null,
      updatedAt: now,
    });

    await tx.orm.public.Receipt.create({
      receiptNumber: receiptNumber(),
      userId,
      orderId: order.id,
      subscriptionId: subscription.id,
      serviceType: "IPTV",
      serviceName: SUPPLIER_SERVICE_NAME,
      price: input.price,
      durationMonths: input.months,
      durationLabel: label,
      bonusYears: 0,
      status: "PAID",
    });

    return { orderId: order.id, subscriptionId: subscription.id };
  });

  await logActivity({
    actor,
    userId,
    entityType: "ORDER",
    entityId: orderId,
    action: "ORDER_COMPLETED",
    summary: `الطلب ${orderRef(orderId)}: اشتراك عن طريق المورّد (${label})`,
    details: `price ${input.price}, supplier share ${input.supplierShare}`,
    customerVisible: false,
  });

  await logActivity({
    actor,
    userId,
    entityType: "SUBSCRIPTION",
    entityId: subscriptionId,
    action: existing ? "SUBSCRIPTION_RENEWED" : "SUBSCRIPTION_CREATED",
    summary: existing ? `تم تجديد الاشتراك (${label})` : `تم تفعيل الاشتراك (${label})`,
    customerVisible: true,
  });

  await notify({
    userId,
    type: existing ? "SUBSCRIPTION_RENEWED" : "SUBSCRIPTION_ACTIVATED",
    title: existing ? "تم تجديد اشتراكك" : "اشتراكك جاهز",
    body: existing ? `تم تجديد اشتراك IPTV لمدة ${label}.` : `تم تفعيل اشتراك IPTV لمدة ${label}. تفاصيل الاشتراك موجودة بحسابك.`,
    link: `/subscriptions/${subscriptionId}`,
  });

  return { ok: true, orderId, subscriptionId };
}
