import { NextResponse } from "next/server";
import { db } from "@/src/prisma/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const mac = String(body.mac ?? "").trim();
    const username = String(body.username ?? "").trim();
    const password = String(body.password ?? "");

    if (!mac && !username) {
      return NextResponse.json(
        { message: "يرجى إدخال MAC Address أو Username" },
        { status: 400 }
      );
    }

    let subscription = null;

    if (mac) {
      subscription = await db.orm.public.Subscription.first({
        macAddress: mac,
      });
    } else {
      if (!password) {
        return NextResponse.json(
          { message: "يرجى إدخال كلمة المرور مع Username" },
          { status: 400 }
        );
      }

      subscription = await db.orm.public.Subscription.first({
        username,
        password,
      });
    }

    if (!subscription) {
      return NextResponse.json(
        { message: "لم يتم العثور على اشتراك مطابق" },
        { status: 404 }
      );
    }

    const user = await db.orm.public.User.first({
      id: subscription.userId,
    });

    return NextResponse.json(
      {
        subscription: {
          id: subscription.id,
          username: subscription.username,
          password: subscription.password,
          macAddress: subscription.macAddress,
          status: subscription.status,
          packageName: subscription.packageName,
          startDate: subscription.startDate,
          expiryDate: subscription.expiryDate,
          connections: subscription.connections,
          maxConnections: subscription.maxConnections,
        },
        customer: user
          ? {
              id: user.id,
              name: user.name,
              phone: user.phone,
              email: user.email,
            }
          : null,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("SUBSCRIPTION_LOOKUP_ERROR:", error);

    return NextResponse.json(
      { message: "حدث خطأ أثناء البحث عن الاشتراك" },
      { status: 500 }
    );
  }
}