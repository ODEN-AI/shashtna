import { NextResponse } from "next/server";
import { requireAdmin } from "@/src/lib/session";
import {
  db,
  ensureDatabaseConnection,
} from "@/src/prisma/db";

export async function POST(
  request: Request
) {
  try {
    const admin = await requireAdmin(request);

    if (!admin.ok) {
      return admin.response;
    }

    await ensureDatabaseConnection();

    const body = await request.json();

    const mac =
      String(body.mac ?? "").trim();

    const username =
      String(body.username ?? "").trim();

    const password =
      String(body.password ?? "").trim();

    const deviceId =
      String(
        body.deviceId ?? ""
      ).trim();

    const serviceType =
      String(
        body.serviceType ?? ""
      ).trim().toUpperCase();

    if (
      serviceType === "VIP"
    ) {
      if (!deviceId) {
        return NextResponse.json(
          {
            message:
              "يرجى إدخال Device ID أو Serial Number.",
          },
          { status: 400 }
        );
      }

      const subscription =
        await db.orm.public.Subscription.first(
          {
            deviceId,
            serviceType: "VIP",
          }
        );

      if (!subscription) {
        return NextResponse.json(
          {
            message:
              "لم يتم العثور على اشتراك VIP مطابق.",
          },
          { status: 404 }
        );
      }

      const user =
        await db.orm.public.User.first(
          {
            id:
              subscription.userId,
          }
        );

      return NextResponse.json(
        {
          subscription: {
            id:
              subscription.id,

            serviceType:
              subscription.serviceType,

            username:
              subscription.username,

            password:
              subscription.password,

            macAddress:
              subscription.macAddress,

            deviceId:
              subscription.deviceId,

            status:
              subscription.status,

            packageName:
              subscription.packageName,

            startDate:
              subscription.startDate,

            expiryDate:
              subscription.expiryDate,

            connections:
              subscription.connections,

            maxConnections:
              subscription.maxConnections,
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
    }

    if (!mac && !username) {
      return NextResponse.json(
        {
          message:
            "يرجى إدخال MAC Address أو Username.",
        },
        { status: 400 }
      );
    }

    let subscription = null;

    if (mac) {
      subscription =
        await db.orm.public.Subscription.first(
          {
            macAddress: mac,
            serviceType: "IPTV",
          }
        );
    } else {
      if (!password) {
        return NextResponse.json(
          {
            message:
              "يرجى إدخال كلمة المرور مع Username.",
          },
          { status: 400 }
        );
      }

      subscription =
        await db.orm.public.Subscription.first(
          {
            username,
            password,
            serviceType: "IPTV",
          }
        );
    }

    if (!subscription) {
      return NextResponse.json(
        {
          message:
            "لم يتم العثور على اشتراك IPTV مطابق.",
        },
        { status: 404 }
      );
    }

    const user =
      await db.orm.public.User.first({
        id:
          subscription.userId,
      });

    return NextResponse.json(
      {
        subscription: {
          id:
            subscription.id,

          serviceType:
            subscription.serviceType,

          username:
            subscription.username,

          password:
            subscription.password,

          macAddress:
            subscription.macAddress,

          deviceId:
            subscription.deviceId,

          status:
            subscription.status,

          packageName:
            subscription.packageName,

          startDate:
            subscription.startDate,

          expiryDate:
            subscription.expiryDate,

          connections:
            subscription.connections,

          maxConnections:
            subscription.maxConnections,
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
    console.error(
      "SUBSCRIPTION_LOOKUP_ERROR:",
      error
    );

    return NextResponse.json(
      {
        message:
          "حدث خطأ أثناء البحث عن الاشتراك.",
      },
      { status: 500 }
    );
  }
}