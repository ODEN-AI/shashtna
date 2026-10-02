import { NextResponse } from "next/server";

import { setSessionCookie } from "@/src/lib/session";
import { passwordSignIn } from "@/src/server/customer-auth";

function throttled(retryAfter: number) {
  return NextResponse.json(
    { message: `محاولات دخول كثيرة. حاول مرة أخرى بعد ${Math.ceil(retryAfter / 60)} دقيقة.`, code: "RATE_LIMITED", retryAfter },
    { status: 429, headers: { "Retry-After": String(retryAfter), "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await passwordSignIn(body.phone, body.password, request.headers);

    if (!result.ok && result.reason === "MISSING") {
      return NextResponse.json(
        { message: "يرجى إدخال رقم الهاتف وكلمة المرور" },
        { status: 400 },
      );
    }

    if (!result.ok && result.reason === "RATE_LIMITED") {
      return throttled(result.retryAfter);
    }

    if (!result.ok) {
      return NextResponse.json(
        { message: "رقم الهاتف أو كلمة المرور غير صحيحة" },
        { status: 401 },
      );
    }

    const { user, session } = result;

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
