"use server";

import { revalidatePath } from "next/cache";

import { assertStaff, getSessionUser } from "@/src/server/auth";
import { fulfilPlatformOrder, revealDeliveryCode } from "@/src/server/platform-orders";

/** Digital platform fulfilment (the "subscriptions" permission, like IPTV activation). */

export type PlatformState = { ok: boolean; message: string; code?: string; value?: string } | null;

async function staff() {
  const user = await getSessionUser();

  if (!user) throw new Error("UNAUTHENTICATED");

  return assertStaff("subscriptions");
}

function fail(error: unknown, fallback: string): PlatformState {
  if (error instanceof Error && error.message === "UNAUTHENTICATED") {
    return { ok: false, code: "UNAUTHENTICATED", message: "انتهت جلسة تسجيل الدخول. يرجى تسجيل الدخول مرة أخرى." };
  }

  if (error instanceof Error && error.message === "FORBIDDEN") {
    return { ok: false, code: "FORBIDDEN", message: "ليس لديك صلاحية لتنفيذ هذا الإجراء." };
  }

  console.error("PLATFORM_ACTION_ERROR:", error instanceof Error ? error.message : error);
  return { ok: false, message: fallback };
}

export async function fulfilPlatformAction(_prev: PlatformState, formData: FormData): Promise<PlatformState> {
  try {
    const actor = await staff();
    const orderId = Number(formData.get("orderId"));
    const result = await fulfilPlatformOrder(actor, orderId, { code: formData.get("code"), accountEmail: formData.get("accountEmail"), password: formData.get("password") });

    if (!result.ok) return { ok: false, message: result.error };

    revalidatePath(`/admin/orders/${orderId}`);
    revalidatePath("/admin/orders");
    return { ok: true, message: "تم التسليم واكتمل الطلب. العميل وصله إشعار." };
  } catch (error) {
    return fail(error, "تعذر تسليم الطلب.");
  }
}

/** Shows a delivered code to staff once per click; every reveal is in the audit log. */
export async function revealCodeAction(_prev: PlatformState, formData: FormData): Promise<PlatformState> {
  try {
    const actor = await staff();
    const result = await revealDeliveryCode(actor, Number(formData.get("orderId")));

    if (!result.ok) return { ok: false, message: result.error };

    return { ok: true, message: "", value: result.code };
  } catch (error) {
    return fail(error, "تعذر عرض الكود.");
  }
}
