"use server";

import { revalidatePath } from "next/cache";

import { assertStaff, getSessionUser } from "@/src/server/auth";
import { addCreditPurchase } from "@/src/server/costs";
import { createSupplierSubscription } from "@/src/server/supplier-orders";
import { isFullAccess } from "@/src/lib/system";

/**
 * Owner-only actions for real costs: recording a panel credit purchase and a
 * subscription made through the supplier. The owner check runs here and again
 * in each service.
 */

export type CostState = { ok: boolean; message: string; code?: string } | null;

async function owner(permission: "finance" | "customers") {
  const user = await getSessionUser();

  if (!user) throw new Error("UNAUTHENTICATED");

  const staff = await assertStaff(permission).catch(() => null);

  if (!staff || !isFullAccess(staff.role)) throw new Error("FORBIDDEN");

  return staff;
}

function fail(error: unknown, fallback: string): CostState {
  if (error instanceof Error && error.message === "UNAUTHENTICATED") {
    return { ok: false, code: "UNAUTHENTICATED", message: "انتهت جلسة تسجيل الدخول. يرجى تسجيل الدخول مرة أخرى." };
  }

  if (error instanceof Error && error.message === "FORBIDDEN") {
    return { ok: false, code: "FORBIDDEN", message: "هذا الإجراء للمالك فقط." };
  }

  console.error("COST_ACTION_ERROR:", error);
  return { ok: false, message: fallback };
}

export async function addCreditPurchaseAction(_prev: CostState, formData: FormData): Promise<CostState> {
  try {
    const staff = await owner("finance");
    const result = await addCreditPurchase(staff, {
      purchasedOn: formData.get("purchasedOn"),
      creditUsd: formData.get("creditUsd"),
      iqdPaid: formData.get("iqdPaid"),
      note: formData.get("note"),
    });

    if (!result.ok) return { ok: false, message: result.error };

    revalidatePath("/admin/finance/credits");
    revalidatePath("/admin/finance");
    return { ok: true, message: "تم تسجيل شراء الرصيد. الطلبات اللي تكتمل من هسه تنحسب بالسعر الجديد." };
  } catch (error) {
    return fail(error, "تعذر تسجيل شراء الرصيد.");
  }
}

export async function createSupplierSubscriptionAction(_prev: CostState, formData: FormData): Promise<CostState> {
  try {
    const staff = await owner("customers");
    const userId = Number(formData.get("userId"));

    if (!Number.isInteger(userId) || userId <= 0) return { ok: false, message: "العميل غير صحيح." };

    const result = await createSupplierSubscription(staff, userId, Object.fromEntries(["months", "price", "supplierShare", "subscriptionId", "username", "password", "macAddress"].map((key) => [key, formData.get(key)])));

    if (!result.ok) return { ok: false, message: result.error };

    revalidatePath(`/admin/customers/${userId}`);
    revalidatePath("/admin/finance");
    return { ok: true, message: "تم تسجيل الاشتراك عن طريق المورّد." };
  } catch (error) {
    return fail(error, "تعذر تسجيل اشتراك المورّد.");
  }
}
