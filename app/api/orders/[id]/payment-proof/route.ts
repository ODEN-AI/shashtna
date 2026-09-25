import { NextResponse } from "next/server";

import { db } from "@/src/prisma/db";
import { hasPermission } from "@/src/lib/roles";
import { getSessionUser } from "@/src/server/auth";
import { readPaymentProof } from "@/src/server/payment-proofs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Serves an order's payment proof to its owner or to staff who handle orders. */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const orderId = Number(id);
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json({ message: "سجّل دخولك أولًا." }, { status: 401 });
  }

  if (!Number.isInteger(orderId) || orderId <= 0) {
    return NextResponse.json({ message: "الطلب غير موجود." }, { status: 404 });
  }

  const order = await db.orm.public.SubscriptionRequest.first({ id: orderId });
  const allowed = order && (order.userId === user.id || (user.isStaff && hasPermission(user.role, "orders")));

  // Same answer for "not yours" and "missing", so order ids can't be probed.
  if (!allowed) {
    return NextResponse.json({ message: "الصورة غير موجودة." }, { status: 404 });
  }

  const proof = await readPaymentProof(orderId);

  if (!proof) {
    return NextResponse.json({ message: "الصورة غير موجودة." }, { status: 404 });
  }

  return new NextResponse(proof.data, {
    status: 200,
    headers: {
      "Content-Type": proof.contentType,
      "Content-Disposition": "inline",
      "Cache-Control": "private, no-store",
    },
  });
}
