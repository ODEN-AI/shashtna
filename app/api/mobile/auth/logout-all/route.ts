import { logActivity } from "@/src/server/activity";
import { ok, withMobileUser } from "@/src/server/mobile-api";
import { revokeSessions } from "@/src/server/sessions";

export const dynamic = "force-dynamic";

/** "Sign out on all devices": ends every website and app session of the account. */
export const POST = withMobileUser(async ({ user }) => {
  await revokeSessions(user.id);
  await logActivity({
    actor: { id: user.id, role: user.role },
    userId: user.id,
    entityType: "USER",
    entityId: user.id,
    action: "SESSIONS_REVOKED",
    summary: "تم تسجيل الخروج من كل الأجهزة",
    customerVisible: true,
  });

  return ok({ message: "تم تسجيل الخروج من كل الأجهزة." });
});
