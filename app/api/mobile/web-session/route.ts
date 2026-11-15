import { createHandoffCode } from "@/src/lib/app-handoff";
import { isStaffRole } from "@/src/lib/roles";
import { fail, ok, withMobileUser } from "@/src/server/mobile/http";

export const dynamic = "force-dynamic";

/**
 * POST /api/mobile/web-session — a one-time code (60 s) the app POSTs to
 * /app/handoff to open website pages already signed in (docs/app-handoff.md).
 * Customers only: staff keep their own console sessions. The code is never logged.
 */
export const POST = withMobileUser(async ({ row }) => {
  if (isStaffRole(row.role)) return fail(403, "FORBIDDEN", "حسابات الموظفين تستخدم لوحة التحكم.");

  return ok(createHandoffCode(row.id));
});
