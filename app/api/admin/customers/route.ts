import { NextResponse } from "next/server";
import { db } from "@/src/prisma/db";

export async function GET() {
  try {
    const users = await db.orm.public.User.all();

    const customers = users.map((user) => ({
      id: user.id,
      name: user.name,
      phone: user.phone,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    }));

    return NextResponse.json({
      success: true,
      customers,
    });
  } catch (error) {
    console.error("GET /api/admin/customers error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "حدث خطأ أثناء جلب العملاء",
      },
      { status: 500 }
    );
  }
}