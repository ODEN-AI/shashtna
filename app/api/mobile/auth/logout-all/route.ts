import { ok, withMobileUser } from "@/src/server/mobile/http";
import { revokeAppSessions } from "@/src/server/mobile/sessions";

export const dynamic = "force-dynamic";

/** "Sign out on all devices": every app session of the account ends, this one included. */
export const POST = withMobileUser(async ({ user }) => {
  await revokeAppSessions(user, "تم تسجيل الخروج من كل الأجهزة");

  return ok({ message: "تم تسجيل الخروج من كل الأجهزة." });
});
