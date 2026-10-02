import { NextResponse } from "next/server";

import { fail, ok, positiveInt, withMobileUser } from "@/src/server/mobile/http";
import { ownOrderDetail } from "@/src/server/mobile/shape";
import { getOrderForUser, setOrderContact } from "@/src/server/orders";
import { readPaymentProof, savePaymentProof } from "@/src/server/payment-proofs";
import { MANUAL_TRANSFER_METHOD } from "@/src/server/settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** The order's payment proof image (owner only). */
export const GET = withMobileUser<{ id: string }>(async ({ user, params }) => {
  const id = positiveInt(params.id);
  const order = id ? await getOrderForUser(user.id, id) : null;
  const proof = order ? await readPaymentProof(order.id) : null;

  if (!proof) return fail(404, "NOT_FOUND", "الصورة غير موجودة.");

  return new NextResponse(proof.data, { status: 200, headers: { "Content-Type": proof.contentType, "Cache-Control": "private, no-store" } });
});

/**
 * Uploads the transfer screenshot (multipart `paymentProof`) and optional
 * transaction reference, exactly like the website's order page. The status
 * does not change: staff review the proof in Admin.
 */
export const POST = withMobileUser<{ id: string }>(async ({ request, user, params }) => {
  const id = positiveInt(params.id);
  if (!id) return fail(404, "NOT_FOUND", "الطلب غير موجود.");

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail(400, "VALIDATION", "يرجى رفع صورة إثبات الدفع.");
  }

  const saved = await savePaymentProof(user.id, id, form.get("paymentProof"));
  if (!saved.ok) return fail(400, "PROOF_REJECTED", saved.error);

  await setOrderContact(user.id, id, { paymentMethod: MANUAL_TRANSFER_METHOD, paymentReference: form.get("paymentReference") });

  return ok({ order: await ownOrderDetail(user.id, id), message: "تم رفع إثبات الدفع ✅ طلبك قيد المراجعة." });
});
