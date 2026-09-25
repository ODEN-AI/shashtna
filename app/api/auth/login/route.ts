import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { createAuthToken } from "@/src/lib/mobile-auth";
import { setSessionCookie } from "@/src/lib/session";
import { db } from "@/src/prisma/db";

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

    const user = await db.orm.public.User.first({ phone });

    if (!user) {
      return NextResponse.json(
        { message: "رقم الهاتف أو كلمة المرور غير صحيحة" },
        { status: 401 },
      );
    }

    const passwordValid = await bcrypt.compare(
      password,
      user.passwordHash,
    );

    if (!passwordValid) {
      return NextResponse.json(
        { message: "رقم الهاتف أو كلمة المرور غير صحيحة" },
        { status: 401 },
      );
    }

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
