"use server";

import { revalidatePath } from "next/cache";

import { assertCustomer } from "@/src/server/auth";
import { closeCustomerChat, sendCustomerMessage } from "@/src/server/chat";

export type ChatActionState = { ok: boolean; message: string; code?: string } | null;

function unauthenticated(error: unknown) {
  return error instanceof Error && error.message === "UNAUTHENTICATED";
}

/** My Shashtna → Assistant: send a message; the agent replies (or the team, after a handover). */
export async function sendChatAction(_prev: ChatActionState, formData: FormData): Promise<ChatActionState> {
  try {
    const user = await assertCustomer();
    const result = await sendCustomerMessage({ id: user.id, role: user.role }, formData.get("message"));

    revalidatePath("/support/chat");

    return result.ok ? { ok: true, message: "" } : { ok: false, message: result.error, code: result.code };
  } catch (error) {
    if (unauthenticated(error)) return { ok: false, code: "UNAUTHENTICATED", message: "انتهت جلسة تسجيل الدخول. سجّل دخولك مرة ثانية." };

    console.error("CHAT_SEND_ERROR:", error instanceof Error ? error.message : error);

    return { ok: false, message: "ما وصلت رسالتك. جرّب مرة ثانية." };
  }
}

/** Start over: closes the current conversation. */
export async function closeChatAction(): Promise<void> {
  try {
    const user = await assertCustomer();

    await closeCustomerChat({ id: user.id, role: user.role });
  } catch (error) {
    console.error("CHAT_CLOSE_ERROR:", error instanceof Error ? error.message : error);
  }

  revalidatePath("/support/chat");
}
