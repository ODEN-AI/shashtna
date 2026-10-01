import { NextResponse } from "next/server";

import { requireAdmin } from "@/src/lib/session";
import { db } from "@/src/prisma/db";
import { logActivity } from "@/src/server/activity";

/**
 * Reveal a subscription's stored credentials — an explicit, audited action.
 * POST only (never cached, never prefetched); needs the "subscriptions"
 * permission; every reveal is written to the audit log with who and when.
 */
const NO_STORE = { "Cache-Control": "no-store, private", Pragma: "no-cache" };

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(request, "subscriptions");

  if (!admin.ok) {
    return admin.response;
  }

  const subscriptionId = Number((await params).id);

  if (!Number.isInteger(subscriptionId) || subscriptionId <= 0) {
    return NextResponse.json({ success: false, message: "معرف الاشتراك غير صحيح." }, { status: 400, headers: NO_STORE });
  }

  try {
    const subscription = await db.orm.public.Subscription.first({ id: subscriptionId });

    if (!subscription) {
      return NextResponse.json({ success: false, message: "الاشتراك غير موجود." }, { status: 404, headers: NO_STORE });
    }

    await logActivity({
      actor: { id: admin.user.id, role: admin.user.role },
      userId: subscription.userId,
      entityType: "SUBSCRIPTION",
      entityId: subscription.id,
      action: "SUBSCRIPTION_CREDENTIALS_REVEALED",
      summary: `Credentials revealed for subscription #${subscription.id}`,
    });

    return NextResponse.json(
      {
        success: true,
        credentials: {
          username: subscription.username,
          password: subscription.password,
        },
      },
      { headers: NO_STORE },
    );
  } catch (error) {
    console.error("CREDENTIALS_REVEAL_ERROR:", error);

    return NextResponse.json({ success: false, message: "تعذر إظهار البيانات. حاول مرة أخرى." }, { status: 500, headers: NO_STORE });
  }
}
