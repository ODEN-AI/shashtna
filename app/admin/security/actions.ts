"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { SESSION_COOKIE } from "@/src/lib/mobile-auth";
import { cleanDeviceLabel } from "@/src/lib/console-api";
import { getSessionUser } from "@/src/server/auth";
import { renameDevice, revokeDevice } from "@/src/server/console-devices";
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

const deviceId = (formData: FormData) => {
  const value = Number(formData.get("deviceId"));
  return Number.isSafeInteger(value) && value > 0 ? value : 0;
};

async function staffActor() {
  const user = await getSessionUser();
  if (!user) return { error: { ok: false, code: "UNAUTHENTICATED", message: "انتهت جلسة تسجيل الدخول. يرجى تسجيل الدخول مرة أخرى." } satisfies SecurityState };
  if (!user.isStaff) return { error: { ok: false, code: "FORBIDDEN", message: "ليس لديك صلاحية لتنفيذ هذا الإجراء." } satisfies SecurityState };

  return { user };
}

/**
 * Rename a Console device. The owner, or staff with the "staff" permission
 * (checked in renameDevice). A no-op rename writes no audit row.
 */
export async function renameConsoleDeviceAction(_: SecurityState, formData: FormData): Promise<SecurityState> {
  try {
    const { user, error } = await staffActor();
    if (!user) return error;

    const label = cleanDeviceLabel(formData.get("label"));
    if (!label) return { ok: false, message: "اكتب اسمًا للجهاز (حتى 60 حرفًا)." };

    const result = await renameDevice(user, deviceId(formData), label);
    if (!result.ok) return { ok: false, message: "الجهاز غير موجود." };

    revalidatePath("/admin/security");
    revalidatePath("/admin/system/security");
    return { ok: true, message: result.changed ? "تم تغيير اسم الجهاز." : "لم يتغير شيء." };
  } catch (error) {
    console.error("CONSOLE_DEVICE_RENAME_ERROR:", error instanceof Error ? error.message : error);
    return { ok: false, message: "تعذر تغيير اسم الجهاز. حاول مرة أخرى." };
  }
}

/** Revoke a Console device (permanent). The owner, or the "staff" permission. Audited. */
export async function revokeConsoleDeviceAction(_: SecurityState, formData: FormData): Promise<SecurityState> {
  try {
    const { user, error } = await staffActor();
    if (!user) return error;

    const result = await revokeDevice(user, deviceId(formData));
    if (!result.ok) return { ok: false, message: "الجهاز غير موجود." };

    revalidatePath("/admin/security");
    revalidatePath("/admin/system/security");
    return { ok: true, message: result.changed ? "تم إلغاء الجهاز. لن يتمكن من الدخول مرة أخرى." : "الجهاز ملغى مسبقًا." };
  } catch (error) {
    console.error("CONSOLE_DEVICE_REVOKE_ERROR:", error instanceof Error ? error.message : error);
    return { ok: false, message: "تعذر إلغاء الجهاز. حاول مرة أخرى." };
  }
}
