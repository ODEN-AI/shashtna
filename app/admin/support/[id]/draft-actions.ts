"use server";

import { isTicketId } from "@/src/lib/ai-core";
import { assertStaff, getSessionUser } from "@/src/server/auth";
import { runAgent } from "@/src/server/ai-core";

/**
 * Admin → ticket → «مسودة رد»: the Customer assistant drafts a reply to one
 * ticket. Support permission; runAgent re-checks the switch, the ticket and
 * every tool, and logs the run without the ticket text or any data. The
 * draft is only shown to staff: they edit it and send it themselves.
 */

export type DraftState = { ok: true; draft: string } | { ok: false; message: string; code?: string } | null;

export async function draftTicketReplyAction(_prev: DraftState, formData: FormData): Promise<DraftState> {
  const ticketId = String(formData.get("ticketId") ?? "");
  const note = String(formData.get("note") ?? "").replace(/\s+/g, " ").trim().slice(0, 300);

  try {
    if (!(await getSessionUser())) return { ok: false, code: "UNAUTHENTICATED", message: "انتهت جلسة تسجيل الدخول. يرجى تسجيل الدخول مرة أخرى." };

    const staff = await assertStaff("support").catch(() => null);

    if (!staff) return { ok: false, code: "FORBIDDEN", message: "المسودات لفريق الدعم." };
    if (!isTicketId(ticketId)) return { ok: false, message: "تذكرة غير صالحة." };

    const question = note ? `اكتب مسودة رد على هذه التذكرة. ملاحظة الموظف: ${note}` : "اكتب مسودة رد على هذه التذكرة.";
    const result = await runAgent({ id: staff.id, role: staff.role }, "customer", question, { scope: { ticketId } });

    if (!result.ok) return { ok: false, code: result.reason, message: result.error };
    if (!result.answer.trim() || result.stopped === "LIMIT") return { ok: false, message: "ما كدر المساعد يكتب مسودة كاملة. جرّب مرة ثانية." };

    return { ok: true, draft: result.answer.trim() };
  } catch (error) {
    console.error("TICKET_DRAFT_ERROR:", error instanceof Error ? error.message : error);

    return { ok: false, message: "صار خطأ. جرّب مرة ثانية." };
  }
}
