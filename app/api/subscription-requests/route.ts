import { NextResponse } from "next/server";
import { db } from "@/src/prisma/db";

const allowedPlans = {
  family: {
    name: "Family",
    price: 25000,
    durationMonths: 12,
    durationLabel: "1 Year",
  },
  star10: {
    name: "Star10",
    price: 20000,
    durationMonths: 12,
    durationLabel: "1 Year",
  },
  max: {
    name: "Max",
    price: 25000,
    durationMonths: 12,
    durationLabel: "1 Year",
  },
} as const;

type RequestBody = {
  userId?: number;
  planSlug?: string;
  contactMethod?: string;
};

export async function POST(request: Request) {
  try {
    const body =
      (await request.json()) as RequestBody;

    const userId = body.userId;
    const planSlug = body.planSlug;
    const contactMethod =
      body.contactMethod ?? "PENDING";

    if (!userId || !planSlug) {
      return NextResponse.json(
        {
          error:
            "بيانات الطلب غير مكتملة.",
        },
        { status: 400 }
      );
    }

    const plan =
      allowedPlans[
        planSlug as keyof typeof allowedPlans
      ];

    if (!plan) {
      return NextResponse.json(
        {
          error:
            "الباقة المحددة غير موجودة.",
        },
        { status: 400 }
      );
    }

    const user =
      await db.orm.public.User.first({
        id: userId,
      });

    if (!user) {
      return NextResponse.json(
        {
          error:
            "المستخدم غير موجود.",
        },
        { status: 404 }
      );
    }

    const existingRequest =
      await db.orm.public.SubscriptionRequest.first({
        userId,
        planSlug,
        status: "PENDING",
      });

    if (existingRequest) {
      if (
        contactMethod !== "PENDING" &&
        existingRequest.contactMethod !==
          contactMethod
      ) {
        const updated =
          await db.orm.public.SubscriptionRequest
            .where({
              id: existingRequest.id,
            })
            .update({
              contactMethod,
            });

        if (!updated) {
          return NextResponse.json(
            {
              error:
                "تعذر تحديث طلب الاشتراك.",
            },
            { status: 500 }
          );
        }

        return NextResponse.json(
          {
            success: true,
            requestId: updated.id,
            alreadyExists: true,
            updated: true,
          },
          { status: 200 }
        );
      }

      return NextResponse.json(
        {
          success: true,
          requestId:
            existingRequest.id,
          alreadyExists: true,
        },
        { status: 200 }
      );
    }

    const created =
      await db.orm.public.SubscriptionRequest.create({
        userId,
        planSlug,
        serviceName: plan.name,
        price: plan.price,
        durationMonths:
          plan.durationMonths,
        durationLabel:
          plan.durationLabel,
        contactMethod,
        status: "PENDING",
      });

    return NextResponse.json(
      {
        success: true,
        requestId: created.id,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      "Subscription request error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "حدث خطأ أثناء حفظ طلب الاشتراك.",
      },
      { status: 500 }
    );
  }
}