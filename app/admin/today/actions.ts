"use server";

import { revalidatePath } from "next/cache";

import { REMINDERS, type Reminder } from "@/src/lib/automation";
import { isFullAccess } from "@/src/lib/system";
import { assertStaff, getSessionUser } from "@/src/server/auth";
import { markWhatsAppOpened, runJob } from "@/src/server/automation";

/**
 * Admin → Today actions. Both are OWNER-only; the services check again.
 */

export type TodayState = { ok: boolean; message: string; code?: string } | null;

async function owner() {
  const user = await getSessionUser();

  if (!user) throw new Error("UNAUTHENTICATED");

  const staff = await assertStaff("orders").catch(() => null);

  if (!staff || !isFullAccess(staff.role)) throw new Error("FORBIDDEN");

  return staff;
}

function fail(error: unknown, fallback: string): TodayState {
  if (error instanceof Error && error.message === "UNAUTHENTICATED") {
    return { ok: false, code: "UNAUTHENTICATED", message: "انتهت جلسة تسجيل الدخول. يرجى تسجيل الدخول مرة أخرى." };
  }

  if (error instanceof Error && error.message === "FORBIDDEN") {
    return { ok: false, code: "FORBIDDEN", message: "هذا الإجراء للمالك فقط." };
  }

  console.error("TODAY_ACTION_ERROR:", error);
  return { ok: false, message: fallback };
}

const REASONS: Record<string, string> = {
  NOT_PRODUCTION: "التشغيل بس على نسخة الإنتاج (أو قاعدة بيانات محلية).",
  AUTOMATION_OFF: "الأتمتة متوقفة. شغّلها من الإعدادات.",
  JOB_OFF: "قائمة اليوم الصباحية متوقفة من الإعدادات.",
  BUSY: "فيه تشغيل ثاني شغّال هسه.",
  DUPLICATE: "تم التشغيل اليوم.",
};

export async function runNowAction(): Promise<TodayState> {
  try {
    const staff = await owner();
    const result = await runJob("daily-digest", { trigger: "MANUAL", actor: staff });

    revalidatePath("/admin/today");

    if (!result.ok) return { ok: false, message: result.error };
    if (result.status === "SKIPPED") return { ok: false, message: REASONS[result.reason ?? ""] ?? "ما تم التشغيل." };
    if (result.status === "FAILED") return { ok: false, message: "فشل التشغيل. التفاصيل بسجل النشاط." };

    return { ok: true, message: result.stats?.dryRun ? "تم التشغيل التجريبي (ما انرسل إشعار)." : "تم التشغيل ووصلك الإشعار." };
  } catch (error) {
    return fail(error, "تعذر التشغيل.");
  }
}

/** Called as the owner opens a WhatsApp link; records it once so the row shows «أُرسلت». */
export async function markWhatsAppAction(subscriptionId: number, template: string): Promise<TodayState> {
  try {
    const staff = await owner();

    if (!Number.isInteger(subscriptionId) || !(REMINDERS as readonly string[]).includes(template)) return { ok: false, message: "طلب غير صالح." };

    const result = await markWhatsAppOpened(staff, subscriptionId, template as Reminder);

    revalidatePath("/admin/today");

    return result.ok ? { ok: true, message: "" } : { ok: false, message: result.error };
  } catch (error) {
    return fail(error, "تعذر تسجيل الرسالة.");
  }
}
