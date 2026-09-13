import { NextResponse } from "next/server";
import { db } from "@/src/prisma/db";

export async function GET() {
  try {
    const requests =
      await db.orm.public.SubscriptionRequest.all();

    const customers = await Promise.all(
      requests.map(async (request) => {
        const user =
          await db.orm.public.User.first({
            id: request.userId,
          });

        return {
          id: request.id,
          userId: request.userId,
          customerName:
            user?.name ?? "Unknown",
          customerPhone:
            user?.phone ?? "",
          customerEmail:
            user?.email ?? "",
          planSlug: request.planSlug,
          serviceName:
            request.serviceName,
          price: request.price,
          durationMonths:
            request.durationMonths,
          durationLabel:
            request.durationLabel,
          contactMethod:
            request.contactMethod,
          status: request.status,
          createdAt:
            request.createdAt,
          updatedAt:
            request.updatedAt,
        };
      })
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
          "Unable to load subscription requests.",
      },
      { status: 500 }
    );
  }
}