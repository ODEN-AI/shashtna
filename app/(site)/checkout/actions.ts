"use server";

import { redirect } from "next/navigation";

import { checkProofBytes } from "@/src/lib/payment-proof";
import { assertCustomer } from "@/src/server/auth";
import { createOrder } from "@/src/server/orders";
import { savePaymentProof } from "@/src/server/payment-proofs";
import { MANUAL_TRANSFER_METHOD } from "@/src/server/settings";

export type CheckoutState = { error: string; field?: "paymentProof" } | null;

/**
 * Places the order together with the customer's proof of a manual transfer.
 * The order stays "submitted": staff check the transfer and mark it paid.
 */
export async function placeOrderAction(_prev: CheckoutState, formData: FormData): Promise<CheckoutState> {
  let orderId: number;

  try {
    const user = await assertCustomer();
    const proof = formData.get("paymentProof");

    if (!(proof instanceof File) || proof.size === 0) {
      return { error: "يرجى رفع صورة إثبات الدفع.", field: "paymentProof" };
    }

    const check = checkProofBytes(new Uint8Array(await proof.arrayBuffer()));

    if (!check.ok) {
      return { error: check.error, field: "paymentProof" };
    }

    const result = await createOrder(user.id, {
      requestType: formData.get("requestType"),
      planSlug: formData.get("planSlug"),
      deviceId: formData.get("deviceId"),
      subscriptionId: formData.get("subscriptionId"),
      contactMethod: formData.get("contactMethod"),
      paymentMethod: MANUAL_TRANSFER_METHOD,
      paymentReference: formData.get("paymentReference"),
      customerNote: formData.get("customerNote"),
    });

    if (!result.ok) {
      return { error: result.error };
    }

    orderId = result.order.id;

    // A failed upload leaves an unpaid order without proof; submitting again
    // updates that same order instead of creating a second one.
    const saved = await savePaymentProof(user.id, orderId, proof);

    if (!saved.ok) {
      return { error: saved.error, field: "paymentProof" };
    }
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return { error: "انتهت جلسة تسجيل الدخول. سجّل دخولك مرة ثانية." };
    }

    console.error("CHECKOUT_ERROR:", error instanceof Error ? error.message : error);
    return { error: "تعذر إرسال الطلب حاليًا. حاول مرة ثانية." };
  }

  redirect(`/orders/${orderId}?created=1`);
}
