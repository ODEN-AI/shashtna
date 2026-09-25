"use server";

import { redirect } from "next/navigation";

import { assertCustomer } from "@/src/server/auth";
import { createOrder } from "@/src/server/orders";

export type CheckoutState = { error: string } | null;

export async function placeOrderAction(_prev: CheckoutState, formData: FormData): Promise<CheckoutState> {
  let orderId: number;

  try {
    const user = await assertCustomer();
    const result = await createOrder(user.id, {
      requestType: formData.get("requestType"),
      planSlug: formData.get("planSlug"),
      deviceId: formData.get("deviceId"),
      subscriptionId: formData.get("subscriptionId"),
      contactMethod: formData.get("contactMethod"),
      paymentMethod: formData.get("paymentMethod"),
      customerNote: formData.get("customerNote"),
    });

    if (!result.ok) {
      return { error: result.error };
    }

    orderId = result.order.id;
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return { error: "انتهت جلسة تسجيل الدخول. سجّل دخولك مرة ثانية." };
    }

    console.error("CHECKOUT_ERROR:", error);
    return { error: "تعذر إرسال الطلب حاليًا. حاول مرة ثانية." };
  }

  redirect(`/orders/${orderId}?created=1`);
}
