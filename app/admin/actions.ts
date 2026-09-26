"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/src/prisma/db";
import { toDate } from "@/src/lib/i18n";
import { ORDER_STATUSES, formatOrderNumber, type OrderStatus } from "@/src/lib/order-status";
import { ASSIGNABLE_ROLES, normalizeRole, type Permission } from "@/src/lib/roles";
import { getSupportTicket, makeSupportMessageId, normalizeSupportStatus, saveSupportTicket } from "@/src/lib/support-store";
import { logActivity } from "@/src/server/activity";
import { assertStaff } from "@/src/server/auth";
import {
  ANNOUNCEMENT_KINDS,
  ANNOUNCEMENT_PLACEMENTS,
  ANNOUNCEMENT_STYLES,
  ANNOUNCEMENT_TARGETS,
  INCIDENT_COMPONENTS,
  INCIDENT_STATUSES,
} from "@/src/server/content";
import { notify } from "@/src/server/notifications";
import { cancelCampaign, createCampaign, sendCampaign } from "@/src/server/push-campaigns";
import { updateOrderStatus } from "@/src/server/orders";
import { dismissReset, issueResetCode } from "@/src/server/password-reset";
import { SETTING_KEYS, saveSetting, type SettingKey } from "@/src/server/settings";

export type AdminState = { ok: boolean; message: string; code?: string } | null;

async function guard(permission: Permission) {
  try {
    return await assertStaff(permission);
  } catch {
    throw new Error("FORBIDDEN");
  }
}

function fail(error: unknown, fallback: string): AdminState {
  if (error instanceof Error && error.message === "FORBIDDEN") {
    return { ok: false, message: "ليس لديك صلاحية لتنفيذ هذا الإجراء." };
  }

  console.error("ADMIN_ACTION_ERROR:", error);
  return { ok: false, message: fallback };
}

function text(value: FormDataEntryValue | null, max: number) {
  return String(value ?? "").trim().slice(0, max);
}

function optionalText(value: FormDataEntryValue | null, max: number) {
  return text(value, max) || null;
}

function isoOrNull(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();

  if (!raw) {
    return null;
  }

  const date = toDate(raw.length === 16 ? `${raw}:00` : raw);

  return date ? date.toISOString() : null;
}

function safeCtaUrl(value: FormDataEntryValue | null) {
  const url = text(value, 500);

  if (!url) {
    return null;
  }

  if (/^https:\/\//.test(url) || (url.startsWith("/") && !url.startsWith("//"))) {
    return url;
  }

  throw new Error("INVALID_URL");
}

// ------------------------------------------------------------------ orders

export async function updateOrderStatusAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const staff = await guard("orders");
    const orderId = Number(formData.get("orderId"));
    const status = text(formData.get("status"), 30).toUpperCase();

    if (!(ORDER_STATUSES as readonly string[]).includes(status)) {
      return { ok: false, message: "الحالة غير صحيحة." };
    }

    const result = await updateOrderStatus(staff, orderId, status as OrderStatus, {
      adminNote: formData.has("adminNote") ? text(formData.get("adminNote"), 1000) : undefined,
      paymentReference: optionalText(formData.get("paymentReference"), 120),
    });

    if (!result.ok) {
      return { ok: false, message: result.error };
    }

    revalidatePath("/admin", "layout");
    return { ok: true, message: "تم تحديث الطلب." };
  } catch (error) {
    return fail(error, "تعذر تحديث الطلب.");
  }
}

export async function bulkOrderStatusAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const staff = await guard("orders");
    const status = text(formData.get("status"), 30).toUpperCase();
    const ids = formData
      .getAll("ids")
      .map(Number)
      .filter((id) => Number.isInteger(id) && id > 0)
      .slice(0, 100);

    if (!(ORDER_STATUSES as readonly string[]).includes(status) || !ids.length) {
      return { ok: false, message: "اختر طلبات وحالة صحيحة." };
    }

    let updated = 0;
    const skipped: string[] = [];

    for (const id of ids) {
      const result = await updateOrderStatus(staff, id, status as OrderStatus);

      if (result.ok) {
        updated += 1;
      } else {
        skipped.push(formatOrderNumber(id));
      }
    }

    revalidatePath("/admin", "layout");
    return {
      ok: updated > 0,
      message: skipped.length
        ? `تم تحديث ${updated} طلب. تم تخطي: ${skipped.join("، ")} (انتقال غير مسموح).`
        : `تم تحديث ${updated} طلب.`,
    };
  } catch (error) {
    return fail(error, "تعذر تحديث الطلبات.");
  }
}

// ---------------------------------------------------------------- renewals

export async function logRenewalContactAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const staff = await guard("subscriptions");
    const subscriptionId = Number(formData.get("subscriptionId"));
    const subscription = await db.orm.public.Subscription.first({ id: subscriptionId });

    if (!subscription) {
      return { ok: false, message: "الاشتراك غير موجود." };
    }

    await logActivity({
      actor: staff,
      userId: subscription.userId,
      entityType: "SUBSCRIPTION",
      entityId: subscription.id,
      action: "RENEWAL_CONTACTED",
      summary: `تم التواصل مع العميل بخصوص التجديد${text(formData.get("note"), 200) ? `: ${text(formData.get("note"), 200)}` : ""}`,
    });

    revalidatePath("/admin/renewals");
    return { ok: true, message: "تم تسجيل التواصل." };
  } catch (error) {
    return fail(error, "تعذر تسجيل التواصل.");
  }
}

// ---------------------------------------------------------- password reset

export async function issueResetCodeAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const staff = await guard("customers");
    const result = await issueResetCode(staff, Number(formData.get("resetId")));

    if (!result.ok) {
      return { ok: false, message: result.error };
    }

    revalidatePath("/admin/password-resets");
    return { ok: true, message: "تم إصدار الرمز. أعطه للعميل بعد التأكد من هويته.", code: result.code };
  } catch (error) {
    return fail(error, "تعذر إصدار الرمز.");
  }
}

export async function dismissResetAction(formData: FormData) {
  const staff = await guard("customers");

  await dismissReset(staff, Number(formData.get("resetId")));
  revalidatePath("/admin/password-resets");
}

// ----------------------------------------------------------------- tickets

export async function replyTicketAdminAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const staff = await guard("support");
    const ticket = await getSupportTicket(text(formData.get("ticketId"), 80));

    if (!ticket) {
      return { ok: false, message: "التذكرة غير موجودة." };
    }

    const message = text(formData.get("message"), 4000);
    const requestedStatus = text(formData.get("status"), 20);
    const now = new Date().toISOString();

    if (!message && !requestedStatus) {
      return { ok: false, message: "اكتب ردًا أو اختر حالة." };
    }

    if (requestedStatus) {
      ticket.status = normalizeSupportStatus(requestedStatus);
    }

    if (message) {
      ticket.messages.push({ id: makeSupportMessageId(), sender: "ADMIN", senderName: staff.name, message, createdAt: now });
      ticket.lastSender = "ADMIN";

      if (ticket.status === "OPEN") {
        ticket.status = "IN_PROGRESS";
      }
    }

    ticket.updatedAt = now;
    await saveSupportTicket(ticket);

    if (message) {
      await notify({
        userId: ticket.userId,
        type: "TICKET_REPLY",
        title: "رد جديد من الدعم الفني",
        body: `وصل رد على تذكرتك «${ticket.subject}».`,
        link: `/support/${encodeURIComponent(ticket.id)}`,
      });
    }

    await logActivity({
      actor: staff,
      userId: ticket.userId,
      entityType: "TICKET",
      entityId: ticket.id,
      action: message ? "TICKET_REPLIED" : "TICKET_STATUS",
      summary: message ? `رد الدعم على التذكرة «${ticket.subject}»` : `حالة التذكرة «${ticket.subject}»: ${ticket.status}`,
    });

    revalidatePath(`/admin/support/${encodeURIComponent(ticket.id)}`);
    revalidatePath("/admin", "layout");
    return { ok: true, message: message ? "تم إرسال الرد." : "تم تحديث الحالة." };
  } catch (error) {
    return fail(error, "تعذر تحديث التذكرة.");
  }
}

// ------------------------------------------------------------ announcements

export async function saveAnnouncementAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const staff = await guard("content");
    const id = Number(formData.get("id"));
    const title = text(formData.get("title"), 140);

    if (!title) {
      return { ok: false, message: "العنوان مطلوب." };
    }

    const pick = <T extends string>(value: FormDataEntryValue | null, allowed: readonly T[], fallback: T) => {
      const candidate = text(value, 30).toUpperCase() as T;
      return allowed.includes(candidate) ? candidate : fallback;
    };

    let ctaUrl: string | null;

    try {
      ctaUrl = safeCtaUrl(formData.get("ctaUrl"));
    } catch {
      return { ok: false, message: "رابط الزر يجب أن يبدأ بـ https:// أو / ." };
    }

    const imageUrl = optionalText(formData.get("imageUrl"), 500);

    if (imageUrl && !/^https:\/\//.test(imageUrl) && !(imageUrl.startsWith("/") && !imageUrl.startsWith("//"))) {
      return { ok: false, message: "رابط الصورة غير صالح." };
    }

    const startsAt = isoOrNull(formData.get("startsAt"));
    const endsAt = isoOrNull(formData.get("endsAt"));

    if (startsAt && endsAt && startsAt > endsAt) {
      return { ok: false, message: "تاريخ النهاية قبل تاريخ البداية." };
    }

    const data = {
      kind: pick(formData.get("kind"), ANNOUNCEMENT_KINDS, "AD"),
      title,
      description: optionalText(formData.get("description"), 400),
      imageUrl,
      ctaLabel: optionalText(formData.get("ctaLabel"), 40),
      ctaUrl,
      target: pick(formData.get("target"), ANNOUNCEMENT_TARGETS, "ALL"),
      placement: pick(formData.get("placement"), ANNOUNCEMENT_PLACEMENTS, "HOME_CAROUSEL"),
      style: pick(formData.get("style"), ANNOUNCEMENT_STYLES, "STANDARD"),
      priority: Math.max(-100, Math.min(100, Math.trunc(Number(formData.get("priority")) || 0))),
      isActive: formData.get("isActive") === "on",
      startsAt,
      endsAt,
    };

    const saved =
      Number.isInteger(id) && id > 0
        ? await db.orm.public.Announcement.where({ id }).update(data)
        : await db.orm.public.Announcement.create(data);

    await logActivity({
      actor: staff,
      entityType: "ANNOUNCEMENT",
      entityId: saved?.id ?? id,
      action: id ? "ANNOUNCEMENT_UPDATED" : "ANNOUNCEMENT_CREATED",
      summary: `${id ? "تعديل" : "إضافة"} إعلان «${title}»`,
    });

    revalidatePath("/admin/announcements");
    revalidatePath("/");
    return { ok: true, message: "تم حفظ الإعلان." };
  } catch (error) {
    return fail(error, "تعذر حفظ الإعلان.");
  }
}

export async function deleteAnnouncementAction(formData: FormData) {
  const staff = await guard("content");
  const id = Number(formData.get("id"));
  const existing = await db.orm.public.Announcement.first({ id });

  if (existing) {
    await db.orm.public.Announcement.where({ id }).delete();
    await logActivity({
      actor: staff,
      entityType: "ANNOUNCEMENT",
      entityId: id,
      action: "ANNOUNCEMENT_DELETED",
      summary: `حذف إعلان «${existing.title}»`,
    });
  }

  revalidatePath("/admin/announcements");
  revalidatePath("/");
}

// --------------------------------------------------------------- incidents

export async function saveIncidentAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const staff = await guard("content");
    const id = Number(formData.get("id"));
    const title = text(formData.get("title"), 140);
    const message = text(formData.get("message"), 2000);
    const status = text(formData.get("status"), 20).toUpperCase();
    const component = text(formData.get("component"), 20).toUpperCase();

    if (!title || !message) {
      return { ok: false, message: "العنوان والوصف مطلوبين." };
    }

    if (!(INCIDENT_STATUSES as readonly string[]).includes(status) || !(INCIDENT_COMPONENTS as readonly string[]).includes(component)) {
      return { ok: false, message: "اختيارات غير صحيحة." };
    }

    const data = {
      title,
      message,
      status,
      component,
      isPublished: formData.get("isPublished") === "on",
      startsAt: isoOrNull(formData.get("startsAt")) ?? new Date().toISOString(),
    };

    if (Number.isInteger(id) && id > 0) {
      await db.orm.public.ServiceIncident.where({ id }).update(data);
    } else {
      await db.orm.public.ServiceIncident.create(data);
    }

    await logActivity({
      actor: staff,
      entityType: "INCIDENT",
      entityId: id || null,
      action: id ? "INCIDENT_UPDATED" : "INCIDENT_CREATED",
      summary: `${id ? "تحديث" : "نشر"} حالة خدمة: ${title}`,
    });

    revalidatePath("/admin/status");
    revalidatePath("/status");
    return { ok: true, message: "تم الحفظ." };
  } catch (error) {
    return fail(error, "تعذر الحفظ.");
  }
}

export async function resolveIncidentAction(formData: FormData) {
  const staff = await guard("content");
  const id = Number(formData.get("id"));

  await db.orm.public.ServiceIncident.where({ id }).update({ resolvedAt: new Date().toISOString() });
  await logActivity({ actor: staff, entityType: "INCIDENT", entityId: id, action: "INCIDENT_RESOLVED", summary: "تم حل مشكلة معلنة" });
  revalidatePath("/admin/status");
  revalidatePath("/status");
}

// ---------------------------------------------------------------- settings

export async function saveSettingsAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const staff = await guard("settings");
    const changed: string[] = [];

    for (const key of SETTING_KEYS) {
      if (formData.has(key)) {
        const value = text(formData.get(key), 20000);

        if (key === "contact.telegram" && value && !/^https:\/\/t\.me\//.test(value)) {
          return { ok: false, message: "رابط تيليجرام يجب أن يبدأ بـ https://t.me/" };
        }

        if ((key === "contact.facebook" || key === "player.downloadUrl") && value && !/^https:\/\//.test(value)) {
          return { ok: false, message: "الروابط يجب أن تبدأ بـ https://" };
        }

        await saveSetting(key as SettingKey, value, staff.id);
        changed.push(key);
      }
    }

    await logActivity({
      actor: staff,
      entityType: "SETTING",
      action: "SETTINGS_UPDATED",
      summary: `تحديث الإعدادات: ${changed.join("، ")}`,
    });

    revalidatePath("/", "layout");
    return { ok: true, message: "تم حفظ الإعدادات." };
  } catch (error) {
    return fail(error, "تعذر حفظ الإعدادات.");
  }
}

// ------------------------------------------------------------------- staff

export async function setUserRoleAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const staff = await guard("staff");
    const userId = Number(formData.get("userId"));
    const role = normalizeRole(formData.get("role"));

    if (!(ASSIGNABLE_ROLES as readonly string[]).includes(role)) {
      return { ok: false, message: "الدور غير صحيح." };
    }

    if (userId === staff.id) {
      return { ok: false, message: "ما تكدر تغير دورك بنفسك." };
    }

    const target = await db.orm.public.User.first({ id: userId });

    if (!target) {
      return { ok: false, message: "المستخدم غير موجود." };
    }

    await db.orm.public.User.where({ id: userId }).update({ role });
    await logActivity({
      actor: staff,
      userId,
      entityType: "STAFF",
      entityId: userId,
      action: "ROLE_CHANGED",
      summary: `تغيير دور ${target.name} من ${target.role} إلى ${role}`,
    });

    revalidatePath("/admin/admins");
    return { ok: true, message: "تم تحديث الدور. يسري فورًا على صلاحيات لوحة الإدارة." };
  } catch (error) {
    return fail(error, "تعذر تحديث الدور.");
  }
}

// ----------------------------------------------------------- notifications

/**
 * "إشعارات الهواتف": create a campaign as a draft, schedule it, or send it
 * now. Permissions, audience rules and destination checks live in
 * src/server/push-campaigns.ts and are enforced there for every path.
 */
export async function createPushCampaignAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const staff = await guard("notifications");
    const scheduled = text(formData.get("scheduledAt"), 20);
    const result = await createCampaign(staff, {
      title: formData.get("title"),
      body: formData.get("body"),
      type: formData.get("type"),
      imageUrl: formData.get("imageUrl"),
      audience: formData.get("audience"),
      customerPhone: formData.get("phone"),
      destinationKind: formData.get("destinationKind"),
      destinationParam: formData.get("destinationParam"),
      mode: formData.get("mode"),
      // The form asks for Baghdad time (UTC+3, no daylight saving).
      scheduledAt: scheduled ? `${scheduled.length === 16 ? `${scheduled}:00` : scheduled}+03:00` : null,
    });

    if (!result.ok) {
      return { ok: false, message: result.error };
    }

    revalidatePath("/admin/notifications");

    if ("sent" in result && result.sent) {
      const sent = result.sent;
      return {
        ok: true,
        message: `تم الإرسال إلى ${sent.recipients} حساب — ${sent.accepted} من ${sent.devices} جهاز استلم الإشعار${sent.failed ? ` (${sent.failed} فشل)` : ""}.`,
      };
    }

    return { ok: true, message: result.campaign.status === "SCHEDULED" ? "تمت الجدولة." : "تم حفظ المسودة." };
  } catch (error) {
    return fail(error, "تعذر حفظ الإشعار.");
  }
}

export async function sendPushCampaignAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const staff = await guard("notifications");
    const result = await sendCampaign(staff, Number(formData.get("id")));

    revalidatePath("/admin/notifications");

    return result.ok
      ? { ok: true, message: `تم الإرسال إلى ${result.recipients} حساب (${result.accepted}/${result.devices} جهاز).` }
      : { ok: false, message: result.error };
  } catch (error) {
    return fail(error, "تعذر إرسال الإشعار.");
  }
}

export async function cancelPushCampaignAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const staff = await guard("notifications");
    const result = await cancelCampaign(staff, Number(formData.get("id")));

    revalidatePath("/admin/notifications");
    return result.ok ? { ok: true, message: "تم الإلغاء." } : { ok: false, message: result.error };
  } catch (error) {
    return fail(error, "تعذر الإلغاء.");
  }
}

// ------------------------------------------------------------------- leads

export async function updateLeadAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const staff = await guard("orders");
    const id = Number(formData.get("id"));
    const status = text(formData.get("status"), 20).toUpperCase();

    if (!["NEW", "CONTACTED", "WON", "LOST"].includes(status)) {
      return { ok: false, message: "الحالة غير صحيحة." };
    }

    await db.orm.public.ServiceLead.where({ id }).update({
      status,
      adminNote: optionalText(formData.get("adminNote"), 1000),
    });
    await logActivity({ actor: staff, entityType: "LEAD", entityId: id, action: "LEAD_UPDATED", summary: `تحديث طلب مشروع إلى ${status}` });

    revalidatePath("/admin/leads");
    return { ok: true, message: "تم الحفظ." };
  } catch (error) {
    return fail(error, "تعذر الحفظ.");
  }
}
