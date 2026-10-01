"use server";

import { cookies } from "next/headers";

import { SESSION_COOKIE } from "@/src/lib/mobile-auth";
import { getSessionUser } from "@/src/server/auth";
import { revokeStaffSessions } from "@/src/server/staff-sessions";

export type SecurityState = { ok: boolean; message: string; code?: string } | null;

/**
 * "Sign out of all devices" for the signed-in staff member: every existing
 * session (this browser, the installed console, other phones/PCs) stops
 * being accepted, and this browser's cookie is cleared.
 */
export async function signOutEverywhereAction(): Promise<SecurityState> {
  try {
    const user = await getSessionUser();

    if (!user) {
      return { ok: false, code: "UNAUTHENTICATED", message: "انتهت جلسة تسجيل الدخول. يرجى تسجيل الدخول مرة أخرى." };
    }

    if (!user.isStaff) {
      return { ok: false, code: "FORBIDDEN", message: "ليس لديك صلاحية لتنفيذ هذا الإجراء." };
    }

    await revokeStaffSessions(user.id, user, "SELF");
    (await cookies()).delete(SESSION_COOKIE);

    return { ok: true, message: "تم تسجيل الخروج من كل الأجهزة." };
  } catch (error) {
    console.error("SIGN_OUT_EVERYWHERE_ERROR:", error);
    return { ok: false, message: "تعذر تسجيل الخروج من كل الأجهزة. حاول مرة أخرى." };
  }
}
