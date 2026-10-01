"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/src/prisma/db";
import { toDate } from "@/src/lib/i18n";
import { ORDER_STATUSES, formatOrderNumber, type OrderStatus } from "@/src/lib/order-status";
import { ASSIGNABLE_ROLES, normalizeRole, type Permission } from "@/src/lib/roles";
import { getSupportTicket, makeSupportMessageId, normalizeSupportStatus, saveSupportTicket } from "@/src/lib/support-store";
import { logActivity } from "@/src/server/activity";
import { assertStaff, getSessionUser } from "@/src/server/auth";
import {
  ANNOUNCEMENT_KINDS,
  ANNOUNCEMENT_PLACEMENTS,
  ANNOUNCEMENT_STYLES,
  ANNOUNCEMENT_TARGETS,
  INCIDENT_COMPONENTS,
  INCIDENT_STATUSES,
} from "@/src/server/content";
import { isInternalPath, strictChoice, strictPriority } from "@/src/lib/content-console";
import { checkRoleChange, describeSettingChanges, isFullAccess, settingProblem } from "@/src/lib/system";
import { AUDIENCES, EDITORIAL_KINDS, MEDIA_TYPES, WEBSITE_PLACEMENTS } from "@/src/lib/promotions";
import { notify } from "@/src/server/notifications";
import { updateOrderStatus } from "@/src/server/orders";
import { dismissReset, issueResetCode } from "@/src/server/password-reset";
import { SETTING_DEFINITIONS, SETTING_KEYS, getSettings, saveSetting, type SettingKey } from "@/src/server/settings";
import { revokeStaffSessions } from "@/src/server/staff-sessions";

export type AdminState = { ok: boolean; message: string; code?: string; id?: number } | null;

async function guard(permission: Permission) {
  try {
    return await assertStaff(permission);
  } catch {
    // 401 vs 403: a missing/expired session is not a missing permission.
    throw new Error((await getSessionUser()) ? "FORBIDDEN" : "UNAUTHENTICATED");
  }
}

function fail(error: unknown, fallback: string): AdminState {
  if (error instanceof Error && error.message === "UNAUTHENTICATED") {
    return { ok: false, code: "UNAUTHENTICATED", message: "انتهت جلسة تسجيل الدخول. يرجى تسجيل الدخول مرة أخرى." };
  }

  if (error instanceof Error && error.message === "FORBIDDEN") {
    return { ok: false, code: "FORBIDDEN", message: "ليس لديك صلاحية لتنفيذ هذا الإجراء." };
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
    revalidatePath("/admin/operations");
    revalidatePath("/admin/customers/[id]", "page");
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

    // Empty → the default; an unknown value is rejected, never silently replaced.
    const choices = {
      kind: strictChoice(formData.get("kind"), [...ANNOUNCEMENT_KINDS, ...EDITORIAL_KINDS], "AD"),
      placement: strictChoice(formData.get("placement"), [...ANNOUNCEMENT_PLACEMENTS, ...WEBSITE_PLACEMENTS], "HOME_CAROUSEL"),
      target: strictChoice(formData.get("target"), ANNOUNCEMENT_TARGETS, "ALL"),
      audience: strictChoice(formData.get("audience"), AUDIENCES, "ALL"),
      style: strictChoice(formData.get("style"), ANNOUNCEMENT_STYLES, "STANDARD"),
      mediaType: strictChoice(formData.get("mediaType"), MEDIA_TYPES, "IMAGE"),
    };
    const invalid = Object.entries(choices).find(([, value]) => value === null);

    if (invalid) {
      return { ok: false, message: `قيمة غير صالحة في حقل ${invalid[0]}.` };
    }

    const priority = strictPriority(formData.get("priority"));

    if (priority === null) {
      return { ok: false, message: "الأولوية يجب أن تكون رقمًا صحيحًا بين ‎-100 و 100." };
    }

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

    const mediaType = choices.mediaType!;
    const videoUrl = mediaType === "VIDEO" ? optionalText(formData.get("videoUrl"), 500) : null;

    if (videoUrl && !/^https:\/\//.test(videoUrl) && !(videoUrl.startsWith("/") && !videoUrl.startsWith("//"))) {
      return { ok: false, message: "رابط الفيديو غير صالح." };
    }

    if (mediaType === "VIDEO" && !videoUrl) {
      return { ok: false, message: "ارفع الفيديو أو اكتب رابطه، أو اختر «صورة»." };
    }

    const startsAt = isoOrNull(formData.get("startsAt"));
    const endsAt = isoOrNull(formData.get("endsAt"));

    if ((text(formData.get("startsAt"), 40) && !startsAt) || (text(formData.get("endsAt"), 40) && !endsAt)) {
      return { ok: false, message: "تاريخ البداية أو النهاية غير صالح." };
    }

    if (startsAt && endsAt && startsAt > endsAt) {
      return { ok: false, message: "تاريخ النهاية قبل تاريخ البداية." };
    }

    const placement = choices.placement!;
    // Hero board, latest list and entry experiences are website surfaces:
    // keep them out of the Shashtna Player / app feeds.
    const websiteOnly = (WEBSITE_PLACEMENTS as readonly string[]).includes(placement);

    const data = {
      kind: choices.kind!,
      title,
      description: optionalText(formData.get("description"), 400),
      imageUrl,
      ctaLabel: optionalText(formData.get("ctaLabel"), 40),
      ctaUrl,
      target: websiteOnly ? "WEBSITE" : choices.target!,
      placement,
      mediaType: videoUrl ? "VIDEO" : "IMAGE",
      videoUrl,
      audience: choices.audience!,
      highlight: optionalText(formData.get("highlight"), 60),
      style: choices.style!,
      priority,
      isActive: formData.get("isActive") === "on",
      startsAt,
      endsAt,
    };

    const editing = Number.isInteger(id) && id > 0;
    const before = editing ? await db.orm.public.Announcement.first({ id }) : null;

    if (editing && !before) {
      return { ok: false, message: "الإعلان غير موجود." };
    }

    const saved = editing
      ? await db.orm.public.Announcement.where({ id }).update(data)
      : await db.orm.public.Announcement.create(data);

    await auditAnnouncementSave(staff, saved?.id ?? id, title, before, data);
    revalidateContent(saved?.id ?? id);
    return { ok: true, message: "تم حفظ الإعلان.", id: saved?.id ?? id };
  } catch (error) {
    return fail(error, "تعذر حفظ الإعلان.");
  }
}

async function removeAnnouncement(staff: { id: number; role?: string | null }, id: number) {
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

  revalidateContent(id);
  return Boolean(existing);
}

export async function deleteAnnouncementAction(formData: FormData) {
  const staff = await guard("content");
  await removeAnnouncement(staff, Number(formData.get("id")));
}

/** Same delete as above, for the Promotions console (reports the outcome). */
export async function removeAnnouncementAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const staff = await guard("content");
    const removed = await removeAnnouncement(staff, Number(formData.get("id")));

    return removed ? { ok: true, message: "تم حذف الإعلان." } : { ok: false, message: "الإعلان غير موجود." };
  } catch (error) {
    return fail(error, "تعذر حذف الإعلان.");
  }
}

/** Publish / unpublish without touching any other field. */
export async function setAnnouncementActiveAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const staff = await guard("content");
    const id = Number(formData.get("id"));
    const isActive = formData.get("isActive") === "true";
    const existing = Number.isInteger(id) && id > 0 ? await db.orm.public.Announcement.first({ id }) : null;

    if (!existing) {
      return { ok: false, message: "الإعلان غير موجود." };
    }

    if (existing.isActive !== isActive) {
      await db.orm.public.Announcement.where({ id }).update({ isActive });
      await logActivity({
        actor: staff,
        entityType: "ANNOUNCEMENT",
        entityId: id,
        action: isActive ? "ANNOUNCEMENT_ACTIVATED" : "ANNOUNCEMENT_DEACTIVATED",
        summary: `${isActive ? "تفعيل" : "إيقاف"} إعلان «${existing.title}»`,
      });
    }

    revalidateContent(id);
    return { ok: true, message: isActive ? "تم تفعيل الإعلان." : "تم إيقاف الإعلان." };
  } catch (error) {
    return fail(error, "تعذر تغيير حالة الإعلان.");
  }
}

/** Every page that shows announcements: the editors and the public surfaces. */
function revalidateContent(id?: number) {
  revalidatePath("/admin/announcements");
  revalidatePath("/admin/promotions", "layout");
  if (id) revalidatePath(`/admin/promotions/items/${id}`);
  revalidatePath("/");
  revalidatePath("/dashboard");
}

/**
 * One audit event per kind of change: created, activated / deactivated,
 * schedule changed, edited — so publishing decisions are findable.
 */
async function auditAnnouncementSave(
  staff: { id: number; role?: string | null },
  id: number,
  title: string,
  before: Record<string, unknown> | null,
  after: Record<string, unknown>,
) {
  const log = (action: string, summary: string, details?: string) =>
    logActivity({ actor: staff, entityType: "ANNOUNCEMENT", entityId: id, action, summary, details: details ?? null });

  if (!before) {
    await log("ANNOUNCEMENT_CREATED", `إضافة إعلان «${title}»`, `${after.kind} · ${after.placement} · ${after.audience} · ${after.isActive ? "active" : "inactive"}`);
    return;
  }

  const changed = (field: string) => String(before[field] ?? "") !== String(after[field] ?? "");
  const time = (value: unknown) => (value ? toDate(String(value))?.toISOString() ?? null : null);

  if (changed("isActive")) await log(after.isActive ? "ANNOUNCEMENT_ACTIVATED" : "ANNOUNCEMENT_DEACTIVATED", `${after.isActive ? "تفعيل" : "إيقاف"} إعلان «${title}»`);
  if (time(before.startsAt) !== time(after.startsAt) || time(before.endsAt) !== time(after.endsAt)) {
    await log("ANNOUNCEMENT_SCHEDULED", `تعديل جدولة إعلان «${title}»`, `${time(before.startsAt) ?? "—"} → ${time(after.startsAt) ?? "—"} / ${time(before.endsAt) ?? "—"} → ${time(after.endsAt) ?? "—"}`);
  }

  const fields = ["title", "description", "kind", "placement", "target", "audience", "style", "priority", "imageUrl", "videoUrl", "mediaType", "ctaLabel", "ctaUrl", "highlight"].filter(changed);

  if (fields.length) await log("ANNOUNCEMENT_UPDATED", `تعديل إعلان «${title}»`, `changed: ${fields.join(", ")}`);
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
    const current = await getSettings();
    const changes: { key: SettingKey; group: string; before: string; after: string }[] = [];

    // Validate everything first, then save only what actually changed.
    for (const key of SETTING_KEYS) {
      if (formData.has(key)) {
        const value = text(formData.get(key), 20000);
        const problem = settingProblem(key, value);

        if (problem) {
          return { ok: false, message: problem };
        }

        if (value !== String(current[key] ?? "").trim()) {
          changes.push({ key, group: SETTING_DEFINITIONS[key].group, before: String(current[key] ?? "").trim(), after: value });
        }
      }
    }

    if (!changes.length) {
      return { ok: true, message: "لا توجد تغييرات للحفظ." };
    }

    for (const change of changes) {
      await saveSetting(change.key, change.after, staff.id);
    }

    await logActivity({
      actor: staff,
      entityType: "SETTING",
      action: "SETTINGS_UPDATED",
      summary: `تحديث الإعدادات: ${changes.map((change) => change.key).join("، ")}`,
      details: describeSettingChanges(changes).join("\n"),
    });

    revalidatePath("/admin/system", "layout");

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

    const target = Number.isInteger(userId) && userId > 0 ? await db.orm.public.User.first({ id: userId }) : null;

    if (!target) {
      return { ok: false, message: "المستخدم غير موجود." };
    }

    if (normalizeRole(target.role) === role) {
      return { ok: true, message: "الدور نفسه بدون تغيير." };
    }

    // Privilege rules: only full-access staff grant or remove full access,
    // and the last full-access account can't be demoted (no lock-out).
    const fullAccessCount = isFullAccess(target.role)
      ? (await db.orm.public.User.where((user) => user.role.in(["OWNER", "ADMIN"])).aggregate((a) => ({ n: a.count() }))).n
      : 1;
    const allowed = checkRoleChange({ actorId: staff.id, actorRole: staff.role, targetId: userId, targetRole: target.role, nextRole: role, fullAccessCount: Number(fullAccessCount) });

    if (!allowed.ok) {
      const messages = {
        SELF: "ما تكدر تغير دورك بنفسك.",
        NOT_ALLOWED: "ليس لديك صلاحية لتنفيذ هذا الإجراء.",
        ESCALATION: "منح أو سحب الصلاحيات الكاملة متاح فقط لمالك بصلاحيات كاملة.",
        LAST_OWNER: "لا يمكن سحب الصلاحيات الكاملة من آخر حساب مالك.",
      } as const;

      return { ok: false, code: allowed.reason === "NOT_ALLOWED" ? "FORBIDDEN" : undefined, message: messages[allowed.reason] };
    }

    await db.orm.public.User.where({ id: userId }).update({ role });
    await logActivity({
      actor: staff,
      userId,
      entityType: "STAFF",
      entityId: userId,
      action: "ROLE_CHANGED",
      summary: `تغيير دور ${target.name} من ${target.role} إلى ${role}`,
      details: `${target.role} → ${role}`,
    });

    revalidatePath("/admin/admins");
    revalidatePath("/admin/system", "layout");
    return { ok: true, message: "تم تحديث الدور. يسري فورًا على صلاحيات لوحة الإدارة." };
  } catch (error) {
    return fail(error, "تعذر تحديث الدور.");
  }
}

/** End every session of another staff member (lost device, offboarding). */
export async function revokeStaffSessionsAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const staff = await guard("staff");
    const userId = Number(formData.get("userId"));

    if (!Number.isInteger(userId) || userId <= 0 || userId === staff.id) {
      return { ok: false, message: "لإنهاء جلساتك أنت استخدم صفحة «الأمان والجلسات»." };
    }

    const target = await db.orm.public.User.first({ id: userId });

    if (!target) {
      return { ok: false, message: "المستخدم غير موجود." };
    }

    await revokeStaffSessions(userId, staff, "ADMIN");
    revalidatePath("/admin/admins");
    revalidatePath("/admin/system", "layout");

    return { ok: true, message: `تم إنهاء كل جلسات ${target.name}. لازم يسجّل الدخول من جديد.` };
  } catch (error) {
    return fail(error, "تعذر إنهاء الجلسات.");
  }
}

// ----------------------------------------------------------- notifications

export async function sendNotificationAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const staff = await guard("support");
    const title = text(formData.get("title"), 120);
    const body = text(formData.get("body"), 600);
    const phone = text(formData.get("phone"), 40);
    const link = optionalText(formData.get("link"), 300);

    if (!title || !body) {
      return { ok: false, message: "العنوان والنص مطلوبين." };
    }

    // Internal paths only; an invalid link is reported, not silently dropped.
    if (link && !isInternalPath(link)) {
      return { ok: false, message: "الرابط يجب أن يكون مسارًا داخل الموقع يبدأ بـ / ." };
    }

    const user = await db.orm.public.User.first({ phone });

    if (!user) {
      return { ok: false, message: "ماكو عميل بهذا الرقم." };
    }

    await notify({ userId: user.id, type: "MESSAGE", title, body, link });
    await logActivity({
      actor: staff,
      userId: user.id,
      entityType: "NOTIFICATION",
      action: "NOTIFICATION_SENT",
      summary: `إرسال إشعار «${title}» إلى ${user.name}`,
    });

    revalidatePath("/admin/notifications");
    revalidatePath("/admin/promotions", "layout");
    return { ok: true, message: `تم إرسال الإشعار إلى ${user.name}.` };
  } catch (error) {
    return fail(error, "تعذر إرسال الإشعار.");
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
    revalidatePath("/admin/operations");
    return { ok: true, message: "تم الحفظ." };
  } catch (error) {
    return fail(error, "تعذر الحفظ.");
  }
}
