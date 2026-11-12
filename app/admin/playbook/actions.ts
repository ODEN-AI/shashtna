"use server";

import { revalidatePath } from "next/cache";

import type { ActionFormState } from "@/app/ui/ActionForm";
import { assertStaff, getSessionUser } from "@/src/server/auth";
import { savePlaybookEntry } from "@/src/server/playbook";

/** Admin → Playbook: add or edit an entry. Owner/admin only; the service checks again. */
export async function savePlaybookAction(_prev: ActionFormState, formData: FormData): Promise<ActionFormState> {
  try {
    if (!(await getSessionUser())) return { ok: false, code: "UNAUTHENTICATED", message: "انتهت جلسة تسجيل الدخول. يرجى تسجيل الدخول مرة أخرى." };

    const staff = await assertStaff("support").catch(() => null);

    if (!staff) return { ok: false, code: "FORBIDDEN", message: "ما عندك صلاحية." };

    const rawId = String(formData.get("id") ?? "").trim();
    const id = rawId ? Number(rawId) : null;

    if (rawId && (!Number.isInteger(id) || id! <= 0)) return { ok: false, message: "طلب غير صالح." };

    const result = await savePlaybookEntry({ id: staff.id, role: staff.role }, id, {
      kind: formData.get("kind"),
      service: formData.get("service"),
      title: formData.get("title"),
      keywords: formData.get("keywords"),
      content: formData.get("content"),
      sortOrder: formData.get("sortOrder"),
      isActive: formData.get("isActive"),
    });

    if (!result.ok) return { ok: false, code: result.status === 403 ? "FORBIDDEN" : undefined, message: result.error };

    revalidatePath("/admin/playbook");

    return { ok: true, message: id ? "انحفظ التعديل." : "انضاف للدليل." };
  } catch (error) {
    console.error("PLAYBOOK_ACTION_ERROR:", error instanceof Error ? error.message : error);

    return { ok: false, message: "تعذر الحفظ. جرّب مرة ثانية." };
  }
}
