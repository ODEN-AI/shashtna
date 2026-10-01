"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { parseBusinessDay } from "@/src/lib/business-time";
import { INTEL_PAGES } from "@/src/lib/intelligence";
import { generateIntelligenceReport } from "@/src/server/analyst";
import { getSessionUser } from "@/src/server/auth";
import { getLang } from "@/src/server/i18n";
import { parseIntelSelection } from "@/src/server/intelligence";

/**
 * Intelligence analyst action. Requires "insights" or "finance" (checked
 * on the server); the report only contains the sections the signed-in role
 * may see, and generation is written to the audit log
 * (INTELLIGENCE_REPORT_GENERATED). Reading charts and filters is not audited.
 */

export type IntelState = { ok: boolean; message: string; code?: string } | null;

export async function generateIntelligenceReportAction(_: IntelState, formData: FormData): Promise<IntelState> {
  let id: number;

  try {
    const user = await getSessionUser();

    if (!user) return { ok: false, code: "UNAUTHENTICATED", message: "انتهت جلسة تسجيل الدخول. يرجى تسجيل الدخول مرة أخرى." };
    if (!user.isStaff || !INTEL_PAGES.analyst(user.role)) return { ok: false, code: "FORBIDDEN", message: "ليس لديك صلاحية لتنفيذ هذا الإجراء." };

    const period = String(formData.get("period") ?? "");
    const from = String(formData.get("from") ?? "") || undefined;
    const to = String(formData.get("to") ?? "") || undefined;

    if (period === "custom" && (!parseBusinessDay(from ?? "") || !parseBusinessDay(to ?? "") || String(from) > String(to))) {
      return { ok: false, message: "اختر تاريخ البداية والنهاية للفترة المخصصة (البداية قبل النهاية)." };
    }

    ({ id } = await generateIntelligenceReport(parseIntelSelection({ period, from, to }), { id: user.id, role: user.role }, await getLang()));
    revalidatePath("/admin/intelligence");
    revalidatePath("/admin/intelligence/analyst");
  } catch (error) {
    console.error("INTELLIGENCE_ACTION_ERROR:", error);
    return { ok: false, message: "تعذر إنشاء التقرير." };
  }

  redirect(`/admin/intelligence/analyst/${id}`);
}
