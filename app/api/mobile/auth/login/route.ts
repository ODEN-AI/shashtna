import bcrypt from "bcryptjs";

import { createAuthToken } from "@/src/lib/mobile-auth";
import { db } from "@/src/prisma/db";
import { fail, ok, readJson, serializeMobileUser, withPublic } from "@/src/server/mobile-api";

export const dynamic = "force-dynamic";

// Compared against when the phone has no account, so both paths take the
// same time and a caller cannot tell which phone numbers are registered.
const DUMMY_HASH = "$2b$12$L9CsgEaPIX8FSN0AXluAmejKyB0JAiKHeAmGB8eNxo5lGUfpkKV7m";

/** Mobile sign-in: same accounts and passwords as the website. */
export const POST = withPublic(async ({ request }) => {
  const body = await readJson(request);
  const phone = String(body.phone ?? "").trim();
  const password = String(body.password ?? "");

  if (!phone || !password) {
    return fail(400, "VALIDATION", "يرجى إدخال رقم الهاتف وكلمة المرور.");
  }

  const user = await db.orm.public.User.first({ phone });
  const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);

  if (!user || !valid) {
    return fail(401, "INVALID_CREDENTIALS", "رقم الهاتف أو كلمة المرور غير صحيحة.");
  }

  const session = createAuthToken(user.id, user.role);

  return ok({ token: session.token, expiresAt: session.expiresAt, user: serializeMobileUser(user) });
});
