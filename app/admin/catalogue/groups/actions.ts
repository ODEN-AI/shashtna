"use server";

import { revalidatePath } from "next/cache";

import { assertStaff, getSessionUser } from "@/src/server/auth";
import { saveGroup } from "@/src/server/groups";

/** Plan group actions (Admin → Catalogue → Groups): the "catalogue" permission, like packages. */

export type GroupState = { ok: boolean; message: string; code?: string } | null;

async function catalogueStaff() {
  const user = await getSessionUser();

  if (!user) throw new Error("UNAUTHENTICATED");

  return assertStaff("catalogue");
}

function fail(error: unknown, fallback: string): GroupState {
  if (error instanceof Error && error.message === "UNAUTHENTICATED") {
    return { ok: false, code: "UNAUTHENTICATED", message: "انتهت جلسة تسجيل الدخول. يرجى تسجيل الدخول مرة أخرى." };
  }

  if (error instanceof Error && error.message === "FORBIDDEN") {
    return { ok: false, code: "FORBIDDEN", message: "إدارة المجموعات تحتاج صلاحية الكتالوج." };
  }

  console.error("GROUP_ACTION_ERROR:", error);
  return { ok: false, message: fallback };
}

const FIELDS = ["name", "nameEn", "slug", "logoUrl", "description", "descriptionEn", "sortOrder", "isActive", "accent", "surface", "delivery"];

export async function saveGroupAction(_prev: GroupState, formData: FormData): Promise<GroupState> {
  try {
    const staff = await catalogueStaff();
    const groupId = Number(formData.get("groupId")) || null;
    const result = await saveGroup(staff, Object.fromEntries(FIELDS.map((key) => [key, formData.get(key)])), groupId);

    if (!result.ok) return { ok: false, message: result.error };

    revalidatePath("/admin/catalogue/groups");
    revalidatePath("/plans", "layout");
    return { ok: true, message: groupId ? "تم حفظ المجموعة." : "تمت إضافة المجموعة. أضف باقاتها من صفحة الباقات." };
  } catch (error) {
    return fail(error, "تعذر حفظ المجموعة.");
  }
}
