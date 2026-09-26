import { NextResponse } from "next/server";

import { setSessionCookie } from "@/src/lib/session";
import { attemptLogin } from "@/src/server/login-guard";
import { issueSession } from "@/src/server/sessions";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await attemptLogin(body.phone, body.password);

    if (!result.ok) {
      return NextResponse.json({ message: result.message, code: result.code }, { status: result.status });
    }

    const { user } = result;
    const session = issueSession(user);

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
