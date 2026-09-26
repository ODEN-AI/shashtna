import { NextResponse } from "next/server";

import { getOrderForUser, setOrderContact } from "@/src/server/orders";
import { mobileOrderDetail } from "@/src/server/mobile";
import { fail, ok, positiveInt, withMobileUser } from "@/src/server/mobile-api";
import { readPaymentProof, savePaymentProof } from "@/src/server/payment-proofs";
import { MANUAL_TRANSFER_METHOD } from "@/src/server/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The order's payment proof image (owner only). */
export const GET = withMobileUser<{ id: string }>(async ({ user, params }) => {
  const id = positiveInt(params.id);
  const order = id ? await getOrderForUser(user.id, id) : null;
  const proof = order ? await readPaymentProof(order.id) : null;

  if (!proof) {
    return fail(404, "NOT_FOUND", "الصورة غير موجودة.");
  }

  return new NextResponse(proof.data, {
    status: 200,
    headers: { "Content-Type": proof.contentType, "Cache-Control": "private, no-store" },
  });
});

/**
 * Uploads the transfer screenshot (multipart field `paymentProof`) and the
 * optional transaction reference, exactly like the website's order page.
 * The order status does not change: staff review the proof.
 */
export const POST = withMobileUser<{ id: string }>(async ({ request, user, params }) => {
  const id = positiveInt(params.id);

  if (!id) {
    return fail(404, "NOT_FOUND", "الطلب غير موجود.");
  }

  let form: FormData;

  try {
    form = await request.formData();
  } catch {
    return fail(400, "VALIDATION", "يرجى رفع صورة إثبات الدفع.");
  }

  const saved = await savePaymentProof(user.id, id, form.get("paymentProof"));

  if (!saved.ok) {
    return fail(400, "PROOF_REJECTED", saved.error);
  }

  await setOrderContact(user.id, id, {
    paymentMethod: MANUAL_TRANSFER_METHOD,
    paymentReference: form.get("paymentReference"),
  });

  const order = await getOrderForUser(user.id, id);

  return ok({ order: order ? await mobileOrderDetail(order) : null, message: "تم رفع إثبات الدفع ✅ طلبك قيد المراجعة." });
});
