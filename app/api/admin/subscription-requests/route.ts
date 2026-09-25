import { NextResponse } from "next/server";
import { requireAdmin } from "@/src/lib/session";
import {
  db,
  ensureDatabaseConnection,
} from "@/src/prisma/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const admin = await requireAdmin(request, "orders");

    if (!admin.ok) {
      return admin.response;
    }

    await ensureDatabaseConnection();

    const requests =
      await db.orm.public.SubscriptionRequest.all();

    const customers =
      await Promise.all(
        requests.map(
          async (request) => {
            const user =
              await db.orm.public.User.first(
                {
                  id: request.userId,
                }
              );

            return {
              id: request.id,

              userId:
                request.userId,

              customerName:
                user?.name ?? "Unknown",

              customerPhone:
                user?.phone ?? "",

              customerEmail:
                user?.email ?? "",

              planSlug:
                request.planSlug,

              serviceType:
                request.serviceType,

              serviceName:
                request.serviceName,

              price:
                request.price,

              durationMonths:
                request.durationMonths,

              durationLabel:
                request.durationLabel,

              deviceId:
                request.deviceId,

              deviceName:
                request.deviceName,

              devicePrice:
                request.devicePrice,

              contactMethod:
                request.contactMethod,

              status:
                request.status,

              createdAt:
                request.createdAt,

              updatedAt:
                request.updatedAt,
            };
          }
        )
      );

    customers.sort(
      (a, b) =>
        new Date(
          b.createdAt
        ).getTime() -
        new Date(
          a.createdAt
        ).getTime()
    );

    return NextResponse.json({
      success: true,
      requests: customers,
    });
  } catch (error) {
    console.error(
      "Admin subscription requests error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "تعذر تحميل طلبات الاشتراك.",
        requests: [],
      },
      { status: 500 }
    );
  }
}