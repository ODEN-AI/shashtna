"use server";

import { revalidatePath } from "next/cache";

import type { ActionFormState } from "@/app/ui/ActionForm";
import { assertStaff, getSessionUser } from "@/src/server/auth";
import { setChatStatus, staffReply } from "@/src/server/chat";

async function staffOrFail() {
  if (!(await getSessionUser())) return { fail: { ok: false, code: "UNAUTHENTICATED", message: "انتهت جلسة تسجيل الدخول. يرجى تسجيل الدخول مرة أخرى." } as const };

  const staff = await assertStaff("support").catch(() => null);

  return staff ? { staff } : { fail: { ok: false, code: "FORBIDDEN", message: "المحادثات لفريق الدعم." } as const };
}

function chatId(formData: FormData) {
  const id = Number(formData.get("id"));

  return Number.isInteger(id) && id > 0 ? id : null;
}

/** Admin → Chats → one chat: the team replies; optionally hands the chat back to the assistant or closes it. */
export async function replyChatAction(_prev: ActionFormState, formData: FormData): Promise<ActionFormState> {
  try {
    const auth = await staffOrFail();

    if (auth.fail) return auth.fail;

    const id = chatId(formData);
    const after = String(formData.get("after") ?? "keep");

    if (!id || !["keep", "handBack", "close"].includes(after)) return { ok: false, message: "طلب غير صالح." };

    const result = await staffReply({ id: auth.staff.id, role: auth.staff.role }, id, formData.get("message"), after as "keep" | "handBack" | "close");

    if (!result.ok) return { ok: false, message: result.error };

    revalidatePath(`/admin/chats/${id}`);
    revalidatePath("/admin/chats");

    return { ok: true, message: "انرسل الرد." };
  } catch (error) {
    console.error("CHAT_REPLY_ERROR:", error instanceof Error ? error.message : error);

    return { ok: false, message: "تعذر الإرسال. جرّب مرة ثانية." };
  }
}

/** Take over, hand back to the assistant, or close — without a reply. */
export async function chatStatusAction(_prev: ActionFormState, formData: FormData): Promise<ActionFormState> {
  try {
    const auth = await staffOrFail();

    if (auth.fail) return auth.fail;

    const id = chatId(formData);
    const status = String(formData.get("status") ?? "");

    if (!id || !["AI", "HANDOVER", "CLOSED"].includes(status)) return { ok: false, message: "طلب غير صالح." };

    const result = await setChatStatus({ id: auth.staff.id, role: auth.staff.role }, id, status as "AI" | "HANDOVER" | "CLOSED");

    if (!result.ok) return { ok: false, message: result.error };

    revalidatePath(`/admin/chats/${id}`);
    revalidatePath("/admin/chats");

    return { ok: true, message: status === "AI" ? "رجعت للمساعد." : status === "CLOSED" ? "انغلقت المحادثة." : "استلمت المحادثة." };
  } catch (error) {
    console.error("CHAT_STATUS_ERROR:", error instanceof Error ? error.message : error);

    return { ok: false, message: "تعذر الحفظ. جرّب مرة ثانية." };
  }
}
