import { NextResponse } from "next/server";
import {
  db,
  ensureDatabaseConnection,
} from "@/src/prisma/db";

export const dynamic = "force-dynamic";

type RequestBody = {
  userId?: number;
  planSlug?: string;
  contactMethod?: string;
};

const VALID_CONTACT_METHODS = new Set([
  "PENDING",
  "TELEGRAM",
  "FACEBOOK",
]);

export async function POST(request: Request) {
  try {
    await ensureDatabaseConnection();

    const body =
      (await request.json()) as RequestBody;

    const userId = body.userId;
    const planSlug = body.planSlug?.trim();
    const contactMethod =
      body.contactMethod ?? "PENDING";

    if (
      !Number.isInteger(userId) ||
      !userId ||
      !planSlug
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "بيانات الطلب غير مكتملة.",
        },
        { status: 400 }
      );
    }

    if (
      !VALID_CONTACT_METHODS.has(
        contactMethod
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "طريقة التواصل غير صحيحة.",
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
          success: false,
          error: "المستخدم غير موجود.",
        },
        { status: 404 }
      );
    }

    const plan =
      await db.orm.public.Package.first({
        slug: planSlug,
        isActive: true,
      });

    if (!plan) {
      return NextResponse.json(
        {
          success: false,
          error:
            "الباقة المحددة غير موجودة أو غير متاحة حاليًا.",
        },
        { status: 400 }
      );
    }

    const existingRequest =
      await db.orm.public.SubscriptionRequest.first(
        {
          userId,
          planSlug,
          status: "PENDING",
        }
      );

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
              serviceName: plan.name,
              price: plan.price,
              durationMonths:
                plan.durationMonths,
              durationLabel:
                plan.durationLabel,
            });

        if (!updated) {
          return NextResponse.json(
            {
              success: false,
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
      await db.orm.public.SubscriptionRequest.create(
        {
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
        }
      );

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
        success: false,
        error:
          "حدث خطأ أثناء حفظ طلب الاشتراك.",
      },
      { status: 500 }
    );
  }
}