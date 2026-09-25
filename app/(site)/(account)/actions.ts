"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/src/prisma/db";
import { assertCustomer } from "@/src/server/auth";
import { logActivity } from "@/src/server/activity";
import { markNotificationsRead } from "@/src/server/notifications";
import { cancelOrderByCustomer, setOrderContact } from "@/src/server/orders";
import { savePaymentProof } from "@/src/server/payment-proofs";
import { MANUAL_TRANSFER_METHOD } from "@/src/server/settings";
import { closeTicket, createTicket, replyToTicket } from "@/src/server/tickets";

export type ActionState = { ok: boolean; message: string } | null;

function failure(error: unknown, fallback: string): ActionState {
  if (error instanceof Error && error.message === "UNAUTHENTICATED") {
    return { ok: false, message: "انتهت جلسة تسجيل الدخول. سجّل دخولك مرة ثانية." };
  }

  console.error("ACCOUNT_ACTION_ERROR:", error);
  return { ok: false, message: fallback };
}

// ------------------------------------------------------------------ orders

export async function cancelOrderAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await assertCustomer();
    const orderId = Number(formData.get("orderId"));
    const result = await cancelOrderByCustomer(user.id, orderId);

    if (!result.ok) {
      return { ok: false, message: result.error };
    }

    revalidatePath(`/orders/${orderId}`);
    revalidatePath("/orders");
    revalidatePath("/dashboard");
    return { ok: true, message: "تم إلغاء الطلب." };
  } catch (error) {
    return failure(error, "تعذر إلغاء الطلب.");
  }
}

export async function updateOrderContactAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await assertCustomer();
    const orderId = Number(formData.get("orderId"));
    const result = await setOrderContact(user.id, orderId, {
      contactMethod: formData.get("contactMethod"),
      paymentReference: formData.get("paymentReference"),
    });

    if (!result.ok) {
      return { ok: false, message: result.error };
    }

    revalidatePath(`/orders/${orderId}`);
    return { ok: true, message: "تم حفظ التحديث." };
  } catch (error) {
    return failure(error, "تعذر حفظ التحديث.");
  }
}

/** Upload (or replace) the transfer proof for one of the customer's unpaid orders. */
export async function uploadPaymentProofAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await assertCustomer();
    const orderId = Number(formData.get("orderId"));
    const saved = await savePaymentProof(user.id, orderId, formData.get("paymentProof"));

    if (!saved.ok) {
      return { ok: false, message: saved.error };
    }

    await setOrderContact(user.id, orderId, {
      paymentMethod: MANUAL_TRANSFER_METHOD,
      paymentReference: formData.get("paymentReference"),
    });

    revalidatePath(`/orders/${orderId}`);
    return { ok: true, message: "تم استلام إثبات الدفع، وسيتم مراجعته من فريق شاشتنا قبل تفعيل الاشتراك." };
  } catch (error) {
    return failure(error, "تعذر رفع الصورة، حاول مرة أخرى.");
  }
}

// ----------------------------------------------------------- notifications

export async function markNotificationsReadAction(formData: FormData) {
  const user = await assertCustomer();
  const id = Number(formData.get("id"));

  await markNotificationsRead(user.id, Number.isInteger(id) && id > 0 ? id : undefined);
  revalidatePath("/notifications");
  revalidatePath("/dashboard");
}

// ----------------------------------------------------------------- account

export async function updateProfileAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await assertCustomer();
    const name = String(formData.get("name") ?? "").trim().slice(0, 120);

    if (name.length < 2) {
      return { ok: false, message: "الاسم مطلوب." };
    }

    await db.orm.public.User.where({ id: user.id }).update({ name });
    revalidatePath("/", "layout");
    return { ok: true, message: "تم حفظ الاسم." };
  } catch (error) {
    return failure(error, "تعذر حفظ البيانات.");
  }
}

export async function changePasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await assertCustomer();
    const current = String(formData.get("currentPassword") ?? "");
    const next = String(formData.get("newPassword") ?? "");
    const confirm = String(formData.get("confirmPassword") ?? "");

    if (next.length < 6) {
      return { ok: false, message: "كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل." };
    }

    if (next !== confirm) {
      return { ok: false, message: "كلمتا المرور غير متطابقتين." };
    }

    const row = await db.orm.public.User.first({ id: user.id });

    if (!row || !(await bcrypt.compare(current, row.passwordHash))) {
      return { ok: false, message: "كلمة المرور الحالية غير صحيحة." };
    }

    await db.orm.public.User.where({ id: user.id }).update({
      passwordHash: await bcrypt.hash(next, 12),
    });

    await logActivity({
      actor: { id: user.id, role: user.role },
      userId: user.id,
      entityType: "USER",
      entityId: user.id,
      action: "PASSWORD_CHANGED",
      summary: "تم تغيير كلمة المرور",
      customerVisible: true,
    });

    return { ok: true, message: "تم تغيير كلمة المرور." };
  } catch (error) {
    return failure(error, "تعذر تغيير كلمة المرور.");
  }
}

const CONTACT_PREFERENCES = ["", "TELEGRAM", "WHATSAPP", "FACEBOOK", "PHONE"];

export async function updatePreferencesAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await assertCustomer();
    const preferredContact = String(formData.get("preferredContact") ?? "").toUpperCase();

    if (!CONTACT_PREFERENCES.includes(preferredContact)) {
      return { ok: false, message: "اختيار غير صحيح." };
    }

    await db.orm.public.User.where({ id: user.id }).update({
      preferredContact: preferredContact || null,
      renewalReminders: formData.get("renewalReminders") === "on",
      marketingOptIn: formData.get("marketingOptIn") === "on",
    });

    revalidatePath("/account");
    return { ok: true, message: "تم حفظ التفضيلات." };
  } catch (error) {
    return failure(error, "تعذر حفظ التفضيلات.");
  }
}

// ----------------------------------------------------------------- support

export async function createTicketAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let ticketId: string;

  try {
    const user = await assertCustomer();
    const subscriptionId = Number(formData.get("subscriptionId"));
    const orderId = Number(formData.get("orderId"));
    const result = await createTicket(user, {
      subject: String(formData.get("subject") ?? ""),
      category: String(formData.get("category") ?? "general"),
      message: String(formData.get("message") ?? ""),
      context: {
        subscriptionId: Number.isInteger(subscriptionId) && subscriptionId > 0 ? subscriptionId : undefined,
        orderId: Number.isInteger(orderId) && orderId > 0 ? orderId : undefined,
        app: String(formData.get("app") ?? "") || undefined,
        device: String(formData.get("device") ?? "") || undefined,
        topic: String(formData.get("topic") ?? "") || undefined,
      },
    });

    if (!result.ok) {
      return { ok: false, message: result.error };
    }

    ticketId = result.ticket.id;
  } catch (error) {
    return failure(error, "تعذر إنشاء التذكرة.");
  }

  revalidatePath("/support");
  redirect(`/support/${encodeURIComponent(ticketId)}?created=1`);
}

export async function replyTicketAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await assertCustomer();
    const ticketId = String(formData.get("ticketId") ?? "");
    const result = await replyToTicket(user, ticketId, String(formData.get("message") ?? ""));

    if (!result.ok) {
      return { ok: false, message: result.error };
    }

    revalidatePath(`/support/${encodeURIComponent(ticketId)}`);
    return { ok: true, message: "تم إرسال الرد." };
  } catch (error) {
    return failure(error, "تعذر إرسال الرد.");
  }
}

export async function closeTicketAction(formData: FormData) {
  const user = await assertCustomer();
  const ticketId = String(formData.get("ticketId") ?? "");

  await closeTicket(user, ticketId);
  revalidatePath(`/support/${encodeURIComponent(ticketId)}`);
  revalidatePath("/support");
}
