import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import {
  db,
  ensureDatabaseConnection,
} from "@/src/prisma/db";
import { requireUser } from "@/src/lib/session";
import { revokeSessions } from "@/src/server/sessions";

export const dynamic = "force-dynamic";

export async function PUT(request: Request) {
  try {
    await ensureDatabaseConnection();

    const body = await request.json();

    const auth = requireUser(request, body.userId);

    if (!auth.ok) {
      return auth.response;
    }

    const userId = auth.userId;
    const name = String(body.name ?? "").trim();
    const currentPassword = String(
      body.currentPassword ?? "",
    );
    const newPassword = String(body.newPassword ?? "");

    if (!Number.isInteger(userId) || userId <= 0) {
      return NextResponse.json(
        {
          message: "بيانات الحساب غير صحيحة.",
        },
        { status: 400 },
      );
    }

    if (!name) {
      return NextResponse.json(
        {
          message: "الاسم مطلوب.",
        },
        { status: 400 },
      );
    }

    if (newPassword && newPassword.length < 6) {
      return NextResponse.json(
        {
          message:
            "كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل.",
        },
        { status: 400 },
      );
    }

    if (newPassword && !currentPassword) {
      return NextResponse.json(
        {
          message: "اكتب كلمة المرور الحالية.",
        },
        { status: 400 },
      );
    }

    const user =
      await db.orm.public.User.first({
        id: userId,
      });

    if (!user) {
      return NextResponse.json(
        {
          message: "الحساب غير موجود.",
        },
        { status: 404 },
      );
    }

    let passwordHash = user.passwordHash;

    if (newPassword) {
      const passwordValid =
        await bcrypt.compare(
          currentPassword,
          user.passwordHash,
        );

      if (!passwordValid) {
        return NextResponse.json(
          {
            message:
              "كلمة المرور الحالية غير صحيحة.",
          },
          { status: 401 },
        );
      }

      passwordHash =
        await bcrypt.hash(
          newPassword,
          12,
        );
    }

    const updatedUser =
      await db.orm.public.User
        .where({
          id: userId,
        })
        .update({
          name,
          passwordHash,
        });

    // A new password ends the account's sessions.
    if (newPassword) {
      await revokeSessions(userId);
    }

    if (!updatedUser) {
      return NextResponse.json(
        {
          success: false,
          message:
            "تعذر تحديث بيانات الحساب.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message:
        "تم تحديث بيانات الحساب بنجاح.",
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        phone: updatedUser.phone,
        role: updatedUser.role,
      },
    });
  } catch (error) {
    console.error(
      "ACCOUNT_PROFILE_UPDATE_ERROR:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "حدث خطأ أثناء تحديث بيانات الحساب.",
      },
      { status: 500 },
    );
  }
}