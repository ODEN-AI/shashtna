"use server";

import { revalidatePath } from "next/cache";

import { isFullAccess } from "@/src/lib/system";
import { assertStaff, getSessionUser } from "@/src/server/auth";
import { endDiscount, saveDiscount } from "@/src/server/discounts";

/**
 * Discount actions (Admin → Catalogue). Adding, changing or ending a discount
 * is full-access only (OWNER or legacy ADMIN); the service checks it again
 * and writes the audit event with before / after.
 */

export type DiscountState = { ok: boolean; message: string; code?: string } | null;

async function fullAccess() {
  const user = await getSessionUser();

  if (!user) throw new Error("UNAUTHENTICATED");

  const staff = await assertStaff("catalogue").catch(() => null);

  if (!staff || !isFullAccess(staff.role)) throw new Error("FORBIDDEN");

  return staff;
}

function fail(error: unknown, fallback: string): DiscountState {
  if (error instanceof Error && error.message === "UNAUTHENTICATED") {
    return { ok: false, code: "UNAUTHENTICATED", message: "انتهت جلسة تسجيل الدخول. يرجى تسجيل الدخول مرة أخرى." };
  }

  if (error instanceof Error && error.message === "FORBIDDEN") {
    return { ok: false, code: "FORBIDDEN", message: "إدارة الخصومات لصاحب الصلاحية الكاملة فقط." };
  }

  console.error("DISCOUNT_ACTION_ERROR:", error);
  return { ok: false, message: fallback };
}

function refresh(packageId: unknown) {
  revalidatePath("/admin/catalogue/discounts");
  if (Number(packageId) > 0) revalidatePath(`/admin/catalogue/packages/${Number(packageId)}`);
  revalidatePath("/plans", "layout");
  revalidatePath("/");
}

export async function saveDiscountAction(_prev: DiscountState, formData: FormData): Promise<DiscountState> {
  try {
    const staff = await fullAccess();
    const optionId = Number(formData.get("optionId"));
    const discountId = Number(formData.get("discountId")) || null;

    if (!Number.isInteger(optionId) || optionId <= 0) return { ok: false, message: "المدة غير صحيحة." };

    const result = await saveDiscount(
      staff,
      optionId,
      {
        kind: formData.get("kind"),
        value: formData.get("value"),
        startsAt: formData.get("startsAt"),
        endsAt: formData.get("endsAt"),
        appliesToRenewals: formData.get("appliesToRenewals"),
      },
      discountId,
    );

    if (!result.ok) return { ok: false, message: result.error };

    refresh(formData.get("packageId"));
    return { ok: true, message: discountId ? "تم تعديل الخصم." : "تمت إضافة الخصم." };
  } catch (error) {
    return fail(error, "تعذر حفظ الخصم.");
  }
}

export async function endDiscountAction(_prev: DiscountState, formData: FormData): Promise<DiscountState> {
  try {
    const staff = await fullAccess();
    const discountId = Number(formData.get("discountId"));

    if (!Number.isInteger(discountId) || discountId <= 0) return { ok: false, message: "الخصم غير صحيح." };

    const result = await endDiscount(staff, discountId);

    if (!result.ok) return { ok: false, message: result.error };

    refresh(formData.get("packageId"));
    return { ok: true, message: "تم إنهاء الخصم. الطلبات اللي استخدمته تبقى على سعرها." };
  } catch (error) {
    return fail(error, "تعذر إنهاء الخصم.");
  }
}
