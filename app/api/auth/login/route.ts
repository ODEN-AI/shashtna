import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { clientAddress } from "@/src/lib/login-throttle";
import { createAuthToken } from "@/src/lib/mobile-auth";
import { setSessionCookie } from "@/src/lib/session";
import { db } from "@/src/prisma/db";
import { clearThrottle, recordThrottleFailure, throttleKeys, throttleRetryAfter } from "@/src/server/login-throttle";

// Compared against when the phone has no account, so both failure paths
// take the same bcrypt time (no account enumeration by timing).
const DUMMY_HASH = "$2b$12$IXWGyOmoxnvVpnx2NUmuCeX4.V3WTemMkeN1WyHuVLnLMyu6AwXBm";

function throttled(retryAfter: number) {
  return NextResponse.json(
    { message: `محاولات دخول كثيرة. حاول مرة أخرى بعد ${Math.ceil(retryAfter / 60)} دقيقة.`, code: "RATE_LIMITED", retryAfter },
    { status: 429, headers: { "Retry-After": String(retryAfter), "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const phone = String(body.phone ?? "").trim();
    const password = String(body.password ?? "");

    if (!phone || !password) {
      return NextResponse.json(
        { message: "يرجى إدخال رقم الهاتف وكلمة المرور" },
        { status: 400 },
      );
    }

    // Throttle before checking anything, for every phone number alike
    // (existing or not, staff or customer), so a lock reveals nothing.
    const keys = throttleKeys(phone, clientAddress(request.headers));
    const retryAfter = await throttleRetryAfter(keys);

    if (retryAfter) {
      return throttled(retryAfter);
    }

    const user = await db.orm.public.User.first({ phone });
    const passwordValid = await bcrypt.compare(
      password,
      user?.passwordHash ?? DUMMY_HASH,
    );

    if (!user || !passwordValid) {
      await recordThrottleFailure(keys);

      return NextResponse.json(
        { message: "رقم الهاتف أو كلمة المرور غير صحيحة" },
        { status: 401 },
      );
    }

    await clearThrottle(keys);

    const session = createAuthToken(user.id, user.role);

    const response = NextResponse.json(
      {
        message: "تم تسجيل الدخول بنجاح",
        token: session.token,
        expiresAt: session.expiresAt,
        user: {
          id: user.id,
          name: user.name,
          phone: user.phone,
          role: user.role,
        },
        // Backward-compatible top-level fields for the current website client.
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role,
      },
      { status: 200 },
    );

    setSessionCookie(response, session.token, session.expiresAt);

    return response;
  } catch (error) {
    console.error("LOGIN_ERROR:", error);

    return NextResponse.json(
      { message: "حدث خطأ أثناء تسجيل الدخول" },
      { status: 500 },
    );
  }
}
