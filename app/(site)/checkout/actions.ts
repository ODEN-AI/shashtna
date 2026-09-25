"use server";

import { redirect } from "next/navigation";

import { assertCustomer } from "@/src/server/auth";
import { createOrder } from "@/src/server/orders";
import { MANUAL_TRANSFER_METHOD } from "@/src/server/settings";

export type CheckoutState = { error: string } | null;

/**
 * Creates the order for the confirmed selection and sends the customer to
 * their dashboard, where they pay and upload the proof. createOrder
 * re-reads the package, device and price from the catalogue, so nothing
 * the browser sends about pricing is trusted.
 */
export async function placeOrderAction(_prev: CheckoutState, formData: FormData): Promise<CheckoutState> {
  let orderId: number;

  try {
    const user = await assertCustomer();

    const result = await createOrder(user.id, {
      requestType: formData.get("requestType"),
      planSlug: formData.get("planSlug"),
      deviceId: formData.get("deviceId"),
      subscriptionId: formData.get("subscriptionId"),
      contactMethod: user.preferredContact ?? "PENDING",
      paymentMethod: MANUAL_TRANSFER_METHOD,
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

    console.error("CHECKOUT_ERROR:", error instanceof Error ? error.message : error);
    return { error: "تعذر إرسال الطلب حاليًا. حاول مرة ثانية." };
  }

  redirect(`/dashboard?order=${orderId}&created=1`);
}
