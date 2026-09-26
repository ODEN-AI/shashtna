import { db } from "@/src/prisma/db";
import {
  PERSONAL_DESTINATIONS,
  destinationLink,
  makeDestination,
  type Destination,
} from "@/src/lib/destinations";
import { UNPAID_STORED_STATUSES, OPEN_STORED_STATUSES } from "@/src/lib/order-status";
import {
  CAMPAIGN_AUDIENCES,
  CAMPAIGN_TYPES,
  canSendToAudience,
  pickEnum,
  resolveAudience,
  type CampaignAudience,
  type CampaignType,
} from "@/src/lib/push";
import { logActivity } from "@/src/server/activity";
import { PROOF_UPLOADED } from "@/src/server/payment-proofs";
import { pushNotifications, type PushNotificationRecord } from "@/src/server/push";

/**
 * Admin mobile notifications ("إشعارات الهواتف").
 *
 * A campaign is sent by writing one ordinary Notification per recipient —
 * the same records the website's notification page and the app's
 * notification centre read — and pushing them to the recipients' phones.
 */

type Staff = { id: number; role: string; name?: string };

export type CampaignInput = {
  title: unknown;
  body: unknown;
  type: unknown;
  imageUrl?: unknown;
  audience: unknown;
  customerPhone?: unknown;
  destinationKind?: unknown;
  destinationParam?: unknown;
  /** "draft" | "now" | "schedule" */
  mode: unknown;
  scheduledAt?: unknown;
};

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

function clean(value: unknown, max: number) {
  return String(value ?? "").trim().slice(0, max);
}

/** Checks that a personal destination belongs to the targeted customer. */
async function destinationBelongsTo(destination: Destination, userId: number | null) {
  if (!PERSONAL_DESTINATIONS.includes(destination.kind)) {
    return true;
  }

  if (!userId) {
    return false;
  }

  if (destination.kind === "ORDER") {
    return Boolean(await db.orm.public.SubscriptionRequest.first({ id: destination.id, userId }));
  }

  if (destination.kind === "SUBSCRIPTION") {
    return Boolean(await db.orm.public.Subscription.first({ id: destination.id, userId }));
  }

  // Tickets live in blob storage; the website route re-checks ownership.
  return true;
}

export async function validateCampaign(staff: Staff, input: CampaignInput) {
  const title = clean(input.title, 120);
  const body = clean(input.body, 600);
  const type = pickEnum(input.type, CAMPAIGN_TYPES);
  const audience = pickEnum(input.audience, CAMPAIGN_AUDIENCES);
  const mode = clean(input.mode, 10).toLowerCase();

  if (!title || !body) {
    return { ok: false as const, error: "العنوان والرسالة مطلوبين." };
  }

  if (!type || !audience) {
    return { ok: false as const, error: "اختر النوع والفئة المستهدفة." };
  }

  if (!["draft", "now", "schedule"].includes(mode)) {
    return { ok: false as const, error: "طريقة الإرسال غير صحيحة." };
  }

  if (!canSendToAudience(staff.role, audience)) {
    return { ok: false as const, error: "صلاحيتك تسمح بإرسال إشعار لعميل محدد فقط." };
  }

  const imageUrl = clean(input.imageUrl, 500) || null;

  if (imageUrl && !/^https:\/\//.test(imageUrl) && !(imageUrl.startsWith("/") && !imageUrl.startsWith("//"))) {
    return { ok: false as const, error: "رابط الصورة غير صالح." };
  }

  let targetUserId: number | null = null;

  if (audience === "CUSTOMER") {
    const phone = clean(input.customerPhone, 40);
    const user = phone ? await db.orm.public.User.first({ phone }) : null;

    if (!user) {
      return { ok: false as const, error: "ماكو عميل بهذا الرقم." };
    }

    targetUserId = user.id;
  }

  let link: string | null = null;
  const kind = clean(input.destinationKind, 20);

  if (kind && kind !== "NONE") {
    const destination = makeDestination(kind, input.destinationParam);

    if (!destination) {
      return { ok: false as const, error: "الوجهة غير صحيحة. تأكد من الرقم أو الرابط المختصر." };
    }

    if (PERSONAL_DESTINATIONS.includes(destination.kind) && audience !== "CUSTOMER") {
      return { ok: false as const, error: "وجهة طلب/اشتراك/تذكرة محددة تصلح فقط لعميل محدد." };
    }

    if (!(await destinationBelongsTo(destination, targetUserId))) {
      return { ok: false as const, error: "هذا السجل لا يخص العميل المحدد." };
    }

    if (destination.kind === "ANNOUNCEMENT" && !(await db.orm.public.Announcement.first({ id: destination.id }))) {
      return { ok: false as const, error: "الإعلان المحدد غير موجود." };
    }

    link = destinationLink(destination);
  }

  let scheduledAt: string | null = null;

  if (mode === "schedule") {
    const raw = clean(input.scheduledAt, 40);
    const date = raw ? new Date(raw.length === 16 ? `${raw}:00` : raw) : null;

    if (!date || Number.isNaN(date.getTime())) {
      return { ok: false as const, error: "حدد وقت الجدولة." };
    }

    if (date.getTime() < Date.now() + 60_000) {
      return { ok: false as const, error: "وقت الجدولة لازم يكون بالمستقبل." };
    }

    scheduledAt = date.toISOString();
  }

  return {
    ok: true as const,
    mode: mode as "draft" | "now" | "schedule",
    data: { title, body, type, audience, imageUrl, link, targetUserId, scheduledAt },
  };
}

/** Creates a draft / scheduled campaign, or creates and sends it now. */
export async function createCampaign(staff: Staff, input: CampaignInput) {
  const checked = await validateCampaign(staff, input);

  if (!checked.ok) {
    return checked;
  }

  const campaign = await db.orm.public.PushCampaign.create({
    ...checked.data,
    status: checked.mode === "schedule" ? "SCHEDULED" : "DRAFT",
    createdBy: staff.id,
  });

  await logActivity({
    actor: staff,
    entityType: "NOTIFICATION",
    entityId: campaign.id,
    action: checked.mode === "schedule" ? "PUSH_CAMPAIGN_SCHEDULED" : "PUSH_CAMPAIGN_CREATED",
    summary: `${checked.mode === "schedule" ? "جدولة" : "إنشاء"} إشعار هواتف «${campaign.title}»`,
  });

  if (checked.mode === "now") {
    const sent = await sendCampaign(staff, campaign.id);
    return sent.ok ? { ok: true as const, campaign, sent } : sent;
  }

  return { ok: true as const, campaign };
}

async function loadAudienceData(audience: CampaignAudience) {
  const users = (await db.orm.public.User.all()).map((user) => ({ id: user.id, marketingOptIn: user.marketingOptIn }));
  const needsSubscriptions = audience === "ACTIVE_SUBSCRIBERS" || audience === "EXPIRING";
  const needsOrders = audience === "PENDING_ORDERS" || audience === "AWAITING_PAYMENT";

  const subscriptions = needsSubscriptions
    ? (await db.orm.public.Subscription.all()).map((row) => ({
        userId: row.userId,
        status: row.status,
        expiryDate: String(row.expiryDate),
      }))
    : [];

  const orders = needsOrders
    ? (
        await db.orm.public.SubscriptionRequest.where((order) =>
          order.status.in(audience === "AWAITING_PAYMENT" ? UNPAID_STORED_STATUSES : OPEN_STORED_STATUSES),
        ).all()
      ).map((row) => ({ id: row.id, userId: row.userId, status: row.status }))
    : [];

  const ordersWithProof = new Set<number>();

  if (audience === "AWAITING_PAYMENT" && orders.length) {
    const events = await db.orm.public.ActivityEvent.where({ entityType: "ORDER", action: PROOF_UPLOADED })
      .where((event) => event.entityId.in(orders.map((order) => String(order.id))))
      .all();

    for (const event of events) {
      ordersWithProof.add(Number(event.entityId));
    }
  }

  return { users, subscriptions, orders, ordersWithProof };
}

/** How many accounts / phones a campaign would reach right now. */
export async function previewAudience(audience: CampaignAudience, type: CampaignType, targetUserId?: number | null) {
  const recipients = resolveAudience(audience, type, await loadAudienceData(audience), { targetUserId });
  const devices = recipients.length
    ? await db.orm.public.PushDevice.where({ isActive: true })
        .where((device) => device.userId.in(recipients))
        .aggregate((aggregate) => ({ count: aggregate.count() }))
    : { count: 0 };

  return { recipients: recipients.length, devices: devices.count };
}

/**
 * Sends a draft or scheduled campaign. The status is claimed atomically
 * (DRAFT/SCHEDULED → SENDING) so the scheduler and a staff click can never
 * send the same campaign twice.
 */
export async function sendCampaign(staff: Staff | null, campaignId: number): Promise<Result<{ recipients: number; devices: number; accepted: number; failed: number }>> {
  const campaign = await db.orm.public.PushCampaign.first({ id: campaignId });

  if (!campaign) {
    return { ok: false, error: "الإشعار غير موجود." };
  }

  if (staff && !canSendToAudience(staff.role, campaign.audience as CampaignAudience)) {
    return { ok: false, error: "ليس لديك صلاحية لإرسال هذا الإشعار." };
  }

  const claimed = await db.orm.public.PushCampaign.where({ id: campaignId })
    .where((item) => item.status.in(["DRAFT", "SCHEDULED"]))
    .updateAll({ status: "SENDING" });

  if (!claimed.length) {
    return { ok: false, error: "تم إرسال هذا الإشعار أو إلغاؤه مسبقًا." };
  }

  try {
    const audience = campaign.audience as CampaignAudience;
    const type = campaign.type as CampaignType;
    const recipients = resolveAudience(audience, type, await loadAudienceData(audience), {
      targetUserId: campaign.targetUserId,
    });

    const records: PushNotificationRecord[] = [];

    for (const userId of recipients) {
      const dedupeKey = `campaign:${campaign.id}:${userId}`;
      const existing = await db.orm.public.Notification.first({ dedupeKey });
      const row =
        existing ??
        (await db.orm.public.Notification.create({
          userId,
          type,
          title: campaign.title,
          body: campaign.body,
          link: campaign.link,
          imageUrl: campaign.imageUrl,
          campaignId: campaign.id,
          dedupeKey,
        }));

      records.push(row);
    }

    const pushed = await pushNotifications(records, { campaignId: campaign.id });
    const failedEverything = pushed.devices > 0 && pushed.accepted === 0;

    await db.orm.public.PushCampaign.where({ id: campaignId }).update({
      status: failedEverything ? "FAILED" : "SENT",
      sentAt: new Date().toISOString(),
      recipientCount: recipients.length,
      deviceCount: pushed.devices,
      acceptedCount: pushed.accepted,
      failedCount: pushed.failed,
      lastError: pushed.error ?? null,
    });

    await logActivity({
      actor: staff,
      entityType: "NOTIFICATION",
      entityId: campaign.id,
      action: "PUSH_CAMPAIGN_SENT",
      summary: `إرسال إشعار هواتف «${campaign.title}» إلى ${recipients.length} حساب (${pushed.accepted}/${pushed.devices} جهاز)`,
    });

    return { ok: true, recipients: recipients.length, ...pushed };
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    console.error("PUSH_CAMPAIGN_ERROR:", { campaignId, message });

    await db.orm.public.PushCampaign.where({ id: campaignId }).update({ status: "FAILED", lastError: message.slice(0, 300) });

    return { ok: false, error: "تعذر إرسال الإشعار." };
  }
}

export async function cancelCampaign(staff: Staff, campaignId: number): Promise<Result> {
  const campaign = await db.orm.public.PushCampaign.first({ id: campaignId });

  if (!campaign || !canSendToAudience(staff.role, campaign.audience as CampaignAudience)) {
    return { ok: false, error: "الإشعار غير موجود." };
  }

  const cancelled = await db.orm.public.PushCampaign.where({ id: campaignId })
    .where((item) => item.status.in(["DRAFT", "SCHEDULED"]))
    .updateAll({ status: "CANCELLED" });

  if (!cancelled.length) {
    return { ok: false, error: "لا يمكن إلغاء إشعار تم إرساله." };
  }

  await logActivity({
    actor: staff,
    entityType: "NOTIFICATION",
    entityId: campaignId,
    action: "PUSH_CAMPAIGN_CANCELLED",
    summary: `إلغاء إشعار هواتف «${campaign.title}»`,
  });

  return { ok: true };
}

/** Scheduler: sends every scheduled campaign whose time has come. */
export async function dispatchDueCampaigns(now = Date.now()) {
  const due = await db.orm.public.PushCampaign.where({ status: "SCHEDULED" })
    .where((item) => item.scheduledAt.lte(new Date(now).toISOString()))
    .orderBy((item) => item.id.asc())
    .limit(20)
    .all();

  const results = [];

  for (const campaign of due) {
    results.push({ id: campaign.id, ...(await sendCampaign(null, campaign.id)) });
  }

  return results;
}

export async function listCampaigns(limit = 50) {
  return db.orm.public.PushCampaign.orderBy((item) => item.id.desc()).limit(limit).all();
}
