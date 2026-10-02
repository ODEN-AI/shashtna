import { NextResponse } from "next/server";

import { setSessionCookie } from "@/src/lib/session";
import { registerCustomer } from "@/src/server/customer-auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const name = String(body.name ?? "").trim();
    const phone = String(body.phone ?? "").trim();
    const password = String(body.password ?? "");
    const confirmPassword = String(
      body.confirmPassword ?? ""
    );
    const terms = Boolean(body.terms);

    if (
      !name ||
      !phone ||
      !password ||
      !confirmPassword
    ) {
      return NextResponse.json(
        {
          message:
            "يرجى ملء جميع الحقول المطلوبة",
        },
        { status: 400 }
      );
    }

    if (!terms) {
      return NextResponse.json(
        {
          message:
            "يجب الموافقة على الشروط والأحكام",
        },
        { status: 400 }
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        {
          message:
            "كلمتا المرور غير متطابقتين",
        },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        {
          message:
            "كلمة المرور يجب أن تكون 6 أحرف على الأقل",
        },
        { status: 400 }
      );
    }

    const result = await registerCustomer({ name, phone, password });

    if (!result.ok) {
      return NextResponse.json(
        {
          message:
            "رقم الهاتف مستخدم مسبقًا",
        },
        { status: 409 }
      );
    }

    const { user, session } = result;

    const response = NextResponse.json(
      {
        message: "تم إنشاء الحساب بنجاح",
        user: {
          id: user.id,
          name: user.name,
          phone: user.phone,
          role: user.role,
          createdAt: user.createdAt,
        },
      },
      { status: 201 }
    );

    setSessionCookie(response, session.token, session.expiresAt);

    return response;
  } catch (error) {
    console.error("REGISTER_ERROR:", error);

    return NextResponse.json(
      {
        message:
          "حدث خطأ أثناء إنشاء الحساب",
      },
      { status: 500 }
    );
  }
}