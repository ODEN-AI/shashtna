"use server";

import { revalidatePath } from "next/cache";

import { assertStaff, getSessionUser } from "@/src/server/auth";
import { adjust, awardMissing, reverseOrder, setAccountStatus } from "@/src/server/loyalty";
import { updateOrderStatus } from "@/src/server/orders";

/**
 * Admin → Shashtna Points actions. Approving or rejecting a reward order,
 * correcting a balance and suspending an account are OWNER-only; each check
 * runs here and again in the service it calls.
 */

export type LoyaltyState = { ok: boolean; message: string; code?: string } | null;

async function owner() {
  const user = await getSessionUser();

  if (!user) throw new Error("UNAUTHENTICATED");

  // "customers" is held by every role that may see a balance; the owner check is what matters.
  const staff = await assertStaff("customers").catch(() => null);

  if (!staff || String(staff.role).toUpperCase() !== "OWNER") throw new Error("FORBIDDEN");

  return staff;
}

function fail(error: unknown, fallback: string): LoyaltyState {
  if (error instanceof Error && error.message === "UNAUTHENTICATED") {
    return { ok: false, code: "UNAUTHENTICATED", message: "انتهت جلسة تسجيل الدخول. يرجى تسجيل الدخول مرة أخرى." };
  }

  if (error instanceof Error && error.message === "FORBIDDEN") {
    return { ok: false, code: "FORBIDDEN", message: "هذا الإجراء للمالك فقط." };
  }

  console.error("LOYALTY_ACTION_ERROR:", error);
  return { ok: false, message: fallback };
}

function id(value: FormDataEntryValue | null) {
  const number = Number(value);

  return Number.isInteger(number) && number > 0 ? number : null;
}

function refresh(userId?: number | null) {
  revalidatePath("/admin/loyalty");
  revalidatePath("/admin/orders");
  if (userId) revalidatePath(`/admin/customers/${userId}`);
}

/** Owner approves a reward order: SUBMITTED → PAID (no proof). Staff then activate it as a renewal. */
export async function approveRewardAction(_prev: LoyaltyState, formData: FormData): Promise<LoyaltyState> {
  try {
    const staff = await owner();
    const orderId = id(formData.get("orderId"));

    if (!orderId) return { ok: false, message: "الطلب غير صحيح." };

    const result = await updateOrderStatus(staff, orderId, "PAID", { adminNote: "موافقة المالك على مكافأة النقاط" });

    if (!result.ok) return { ok: false, message: result.error };

    refresh();
    revalidatePath(`/admin/orders/${orderId}`);
    return { ok: true, message: "تمت الموافقة. الطلب جاهز للتفعيل كتجديد." };
  } catch (error) {
    return fail(error, "تعذر حفظ الموافقة.");
  }
}

/** Owner rejects a reward order; the customer's points come back automatically. */
export async function rejectRewardAction(_prev: LoyaltyState, formData: FormData): Promise<LoyaltyState> {
  try {
    const staff = await owner();
    const orderId = id(formData.get("orderId"));

    if (!orderId) return { ok: false, message: "الطلب غير صحيح." };

    const result = await updateOrderStatus(staff, orderId, "REJECTED", { adminNote: String(formData.get("note") ?? "").trim().slice(0, 500) || null });

    if (!result.ok) return { ok: false, message: result.error };

    refresh();
    revalidatePath(`/admin/orders/${orderId}`);
    return { ok: true, message: "تم رفض الطلب ورجعت النقاط للعميل." };
  } catch (error) {
    return fail(error, "تعذر رفض الطلب.");
  }
}

export async function adjustPointsAction(_prev: LoyaltyState, formData: FormData): Promise<LoyaltyState> {
  try {
    const staff = await owner();
    const userId = id(formData.get("userId"));

    if (!userId) return { ok: false, message: "العميل غير صحيح." };

    const result = await adjust(staff, userId, formData.get("points"), formData.get("reason"));

    if (!result.ok) return { ok: false, message: result.error };

    refresh(userId);
    return { ok: true, message: "تم تسجيل التعديل." };
  } catch (error) {
    return fail(error, "تعذر تعديل النقاط.");
  }
}

export async function reverseOrderPointsAction(_prev: LoyaltyState, formData: FormData): Promise<LoyaltyState> {
  try {
    const staff = await owner();
    const orderId = id(formData.get("orderId"));

    if (!orderId) return { ok: false, message: "الطلب غير صحيح." };

    const result = await reverseOrder(staff, orderId, formData.get("reason"));

    if (!result.ok) return { ok: false, message: result.error };

    refresh();
    revalidatePath(`/admin/orders/${orderId}`);
    return { ok: true, message: `تم سحب ${-result.points} نقطة.` };
  } catch (error) {
    return fail(error, "تعذر سحب النقاط.");
  }
}

export async function setPointsStatusAction(_prev: LoyaltyState, formData: FormData): Promise<LoyaltyState> {
  try {
    const staff = await owner();
    const userId = id(formData.get("userId"));

    if (!userId) return { ok: false, message: "العميل غير صحيح." };

    const result = await setAccountStatus(staff, userId, formData.get("status"));

    if (!result.ok) return { ok: false, message: result.error };

    refresh(userId);
    return { ok: true, message: "تم تحديث حالة حساب النقاط." };
  } catch (error) {
    return fail(error, "تعذر تحديث الحالة.");
  }
}

/** Owner retries the awards that failed (idempotent per order). */
export async function awardMissingAction(): Promise<LoyaltyState> {
  try {
    const staff = await owner();
    const result = await awardMissing(staff);

    if (!result.ok) return { ok: false, message: result.error };

    refresh();
    return { ok: true, message: result.orders ? `تم احتساب ${result.points} نقطة لـ ${result.orders} طلب.` : "ماكو نقاط ناقصة." };
  } catch (error) {
    return fail(error, "تعذر احتساب النقاط الناقصة.");
  }
}
