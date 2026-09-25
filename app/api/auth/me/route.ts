import { NextResponse } from "next/server";

import { requireUser } from "@/src/lib/session";
import { db, ensureDatabaseConnection } from "@/src/prisma/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const auth = requireUser(request);

    if (!auth.ok) {
      return auth.response;
    }

    await ensureDatabaseConnection();

    const user = await db.orm.public.User.first({ id: auth.userId });

    if (!user) {
      return NextResponse.json(
        { success: false, message: "الحساب غير موجود." },
        { status: 401 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        user: {
          id: user.id,
          name: user.name,
          phone: user.phone,
          role: user.role,
        },
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    console.error("AUTH_ME_ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "تعذر التحقق من جلسة الحساب.",
      },
      { status: 500 },
    );
  }
}
