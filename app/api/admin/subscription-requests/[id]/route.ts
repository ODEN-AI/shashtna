import { NextResponse } from "next/server";
import { requireAdmin } from "@/src/lib/session";
import { db } from "@/src/prisma/db";

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
    const admin = await requireAdmin(httpRequest);

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
    const admin = await requireAdmin(request);

    if (!admin.ok) {
      return admin.response;
    }

    const { id } = await params;
    const requestId = Number(id);

    if (!Number.isInteger(requestId)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "رقم الطلب غير صحيح.",
        },
        { status: 400 }
      );
    }

    const body =
      (await request.json()) as {
        status?: string;
      };

    if (
      body.status !==
      "REJECTED"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "الحالة المطلوبة غير مسموحة.",
        },
        { status: 400 }
      );
    }

    const existingRequest =
      await db.orm.public.SubscriptionRequest.first(
        {
          id: requestId,
        }
      );

    if (!existingRequest) {
      return NextResponse.json(
        {
          success: false,
          message:
            "الطلب غير موجود.",
        },
        { status: 404 }
      );
    }

    if (
      existingRequest.status !==
      "PENDING"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "هذا الطلب تمت معالجته مسبقاً.",
        },
        { status: 400 }
      );
    }

    const updated =
      await db.orm.public.SubscriptionRequest
        .where({
          id: requestId,
        })
        .update({
          status:
            "REJECTED",
        });

    if (!updated) {
      return NextResponse.json(
        {
          success: false,
          message:
            "تعذر رفض الطلب.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      request: {
        id:
          updated.id,
        status:
          updated.status,
      },
    });
  } catch (error) {
    console.error(
      "Reject subscription request error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "حدث خطأ أثناء رفض الطلب.",
      },
      { status: 500 }
    );
  }
}