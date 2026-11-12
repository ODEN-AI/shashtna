"use server";

import { assertStaff, getSessionUser } from "@/src/server/auth";
import { runAgent } from "@/src/server/ai-core";

/**
 * Admin → Assistants. Any staff member the page lets in may ask;
 * runAgent then offers only the tools their role holds, checks the switch
 * and logs the run (never the question text or the data).
 */

export type AssistantState =
  | { ok: true; question: string; answer: string; tools: { tool: string; ok: boolean }[]; limited: boolean }
  | { ok: false; question: string; message: string; code?: string }
  | null;

export async function askAssistantAction(_prev: AssistantState, formData: FormData): Promise<AssistantState> {
  const question = String(formData.get("question") ?? "").slice(0, 2000);

  try {
    if (!(await getSessionUser())) return { ok: false, question, code: "UNAUTHENTICATED", message: "انتهت جلسة تسجيل الدخول. يرجى تسجيل الدخول مرة أخرى." };

    const staff = await assertStaff("insights").catch(() => null);

    if (!staff) return { ok: false, question, code: "FORBIDDEN", message: "المساعد مو متاح لدورك." };

    // The agent is checked by runAgent (known agent, and the role must hold at least one of its tools).
    const result = await runAgent({ id: staff.id, role: staff.role }, String(formData.get("agent") ?? "operations"), question);

    if (!result.ok) return { ok: false, question, code: result.reason, message: result.error };

    return { ok: true, question, answer: result.answer, tools: result.trace.map((call) => ({ tool: call.tool, ok: call.ok })), limited: result.stopped === "LIMIT" };
  } catch (error) {
    console.error("ASSISTANT_ACTION_ERROR:", error instanceof Error ? error.message : error);

    return { ok: false, question, message: "صار خطأ. جرّب مرة ثانية." };
  }
}
