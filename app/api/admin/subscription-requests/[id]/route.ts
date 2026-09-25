import { NextResponse } from "next/server";
import { requireAdmin } from "@/src/lib/session";
import { db } from "@/src/prisma/db";
import {
  ORDER_STATUSES,
  type OrderStatus,
} from "@/src/lib/order-status";
import { updateOrderStatus } from "@/src/server/orders";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(
  httpRequest: Request,
  { params }: RouteContext
) {
  try {
    const admin = await requireAdmin(httpRequest, "orders");

    if (!admin.ok) {
      return admin.response;
    }

    const { id } = await params;
    const requestId = Number(id);

    if (!Number.isInteger(requestId)) {
      return NextResponse.json(
        {
          success: false,
          message: "رقم الطلب غير صحيح.",
        },
        { status: 400 }
      );
    }

    const request =
      await db.orm.public.SubscriptionRequest.first({
        id: requestId,
      });

    if (!request) {
      return NextResponse.json(
        {
          success: false,
          message: "الطلب غير موجود.",
        },
        { status: 404 }
      );
    }

    const user =
      await db.orm.public.User.first({
        id: request.userId,
      });

    return NextResponse.json({
      success: true,
      request: {
        id: request.id,
        userId: request.userId,
        customerName:
          user?.name ?? "Unknown",
        customerPhone:
          user?.phone ?? "",
        customerEmail:
          user?.email ?? "",
        planSlug:
          request.planSlug,
        serviceName:
          request.serviceName,

        requestType:
          request.requestType ??
          "NEW",

        price:
          request.price,

        durationMonths:
          request.durationMonths,

        durationLabel:
          request.durationLabel,

        contactMethod:
          request.contactMethod,

        status:
          request.status,

        createdAt:
          request.createdAt,

        updatedAt:
          request.updatedAt,
      },
    });
  } catch (error) {
    console.error(
      "Get subscription request error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "تعذر تحميل الطلب.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: RouteContext
) {
  try {
    const admin = await requireAdmin(request, "orders");

    if (!admin.ok) {
      return admin.response;
    }

    const { id } = await params;
    const requestId = Number(id);

    if (!Number.isInteger(requestId)) {
      return NextResponse.json(
        { success: false, message: "رقم الطلب غير صحيح." },
        { status: 400 }
      );
    }

    const body = (await request.json()) as {
      status?: string;
      adminNote?: string;
      paymentReference?: string;
    };

    const target = String(body.status ?? "").trim().toUpperCase();

    if (!(ORDER_STATUSES as readonly string[]).includes(target)) {
      return NextResponse.json(
        { success: false, message: "الحالة المطلوبة غير مسموحة." },
        { status: 400 }
      );
    }

    const result = await updateOrderStatus(
      admin.user,
      requestId,
      target as OrderStatus,
      {
        adminNote: body.adminNote,
        paymentReference: body.paymentReference,
      }
    );

    if (!result.ok) {
      return NextResponse.json(
        { success: false, message: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      request: { id: requestId, status: target },
    });
  } catch (error) {
    console.error("Update order status error:", error);

    return NextResponse.json(
      { success: false, message: "حدث خطأ أثناء تحديث الطلب." },
      { status: 500 }
    );
  }
}
