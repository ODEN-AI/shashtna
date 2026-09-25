import { NextResponse } from "next/server";

import { requireUser } from "@/src/lib/session";
import { createOrder, listOrdersForUser } from "@/src/server/orders";

export const dynamic = "force-dynamic";

/** The signed-in user's orders (website cookie or mobile Bearer token). */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const auth = requireUser(request, searchParams.get("userId"));

    if (!auth.ok) {
      return auth.response;
    }

    const orders = await listOrdersForUser(auth.userId);

    return NextResponse.json(
      {
        success: true,
        // `requests` is kept for existing clients.
        requests: orders,
        orders,
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    console.error("GET /api/subscription-requests error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "حدث خطأ أثناء تحميل الطلبات.",
        requests: [],
      },
      { status: 500 },
    );
  }
}

/**
 * Creates an order. Kept for the mobile app and older clients; the website
 * checkout uses the same `createOrder` service through a server action.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const auth = requireUser(request, body.userId);

    if (!auth.ok) {
      return auth.response;
    }

    const result = await createOrder(auth.userId, {
      requestType: body.requestType,
      planSlug: body.planSlug,
      deviceId: body.deviceId,
      subscriptionId: body.subscriptionId,
      contactMethod: body.contactMethod,
      paymentMethod: body.paymentMethod,
      customerNote: body.customerNote,
    });

    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error, message: result.error },
        { status: result.status },
      );
    }

    return NextResponse.json(
      {
        success: true,
        requestId: result.order.id,
        orderNumber: result.order.number,
        requestType: result.order.requestType,
        status: result.order.status,
        ...(result.alreadyExists ? { alreadyExists: true, updated: true } : {}),
      },
      { status: result.alreadyExists ? 200 : 201 },
    );
  } catch (error) {
    console.error("Subscription request error:", error);

    return NextResponse.json(
      { success: false, error: "حدث خطأ أثناء حفظ طلب الاشتراك." },
      { status: 500 },
    );
  }
}
