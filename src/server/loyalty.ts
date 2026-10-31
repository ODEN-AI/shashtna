import { randomUUID } from "node:crypto";

import { db } from "@/src/prisma/db";
import {
  DEFAULT_LOYALTY_RULES,
  LEDGER_LABELS,
  isPointsExpired,
  isRewardKey,
  enabledIntervals,
  earnsPoints,
  liabilityUsd,
  missedAwards,
  orderPointValue,
  parseLoyaltyRules,
  pointsExpiryDate,
  pointsForOrder,
  pointsLabel,
  redeemProblem,
  rewardCost,
  rewardMonths,
  rewardOptionId,
  ruleSnapshot,
  splitBalance,
  unlockDate,
  type LoyaltyKind,
  type LoyaltyRules,
  type RewardKey,
} from "@/src/lib/loyalty";
import { formatOrderNumber, normalizeOrderStatus, orderRef } from "@/src/lib/order-status";
import { deriveSubscriptionState } from "@/src/lib/subscription-state";
import { logActivity } from "@/src/server/activity";
import { notify } from "@/src/server/notifications";
import { isFullAccess } from "@/src/lib/system";

/**
 * «نقاط شاشتنا» — database side. Every change to a balance happens in one
 * transaction with the ledger entry that explains it, and every entry has an
 * idempotency key (unique in the database), so a retried award, redemption
 * or return is a no-op. Redemption is a single conditional UPDATE on the
 * account (enough available points, no open reward, cooldown over), so two
 * simultaneous redemptions can never both succeed.
 */

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Actor = { id: number; role: string };
type Fail = { ok: false; status: number; error: string };

const sql = db.raw.sql;

function fail(status: number, error: string): Fail {
  return { ok: false, status, error };
}

// ------------------------------------------------------------------- rules

export async function getLoyaltyRules(): Promise<LoyaltyRules> {
  try {
    const rows = await db.orm.public.SiteSetting.where((setting) => setting.key.like("loyalty.%")).all();

    return parseLoyaltyRules(Object.fromEntries(rows.map((row) => [row.key, row.value])));
  } catch (error) {
    console.error("LOYALTY_RULES_READ_ERROR:", error);
    return DEFAULT_LOYALTY_RULES;
  }
}

/** A reward's IPTV option, when the owner picked one and it can be sold. */
export async function rewardOption(rules: LoyaltyRules, key: RewardKey) {
  const id = rewardOptionId(rules, key);
  const option = id ? await db.orm.public.PackageOption.first({ id }) : null;
  const pkg = option ? await db.orm.public.Package.first({ id: option.packageId }) : null;

  if (!option || !pkg || !option.isActive || !pkg.isActive || String(pkg.serviceType).toUpperCase() !== "IPTV" || option.durationMonths <= 0) {
    return null;
  }

  return { option, pkg };
}

// ------------------------------------------------------------------- ledger primitives

type EntryInput = {
  userId: number;
  kind: LoyaltyKind;
  points: number;
  orderId?: number | null;
  availableAt: string;
  key: string;
  rule: string;
  reason?: string | null;
  actorUserId?: number | null;
};

async function ensureAccount(tx: Tx, userId: number) {
  await tx
    .query(
      sql`INSERT INTO "public"."loyaltyAccount" ("userId", "updatedAt") VALUES (${userId}, now())
        ON CONFLICT ("userId") DO NOTHING RETURNING "id"`
        .returnsRow({ id: "pg/int4@1" })
        .build(),
    )
    .toArray();
}

/**
 * Inserts an entry once (by its idempotency key). With `applyBalance`, the
 * account balance moves by the same points in the same transaction. Returns
 * false when the key already exists, i.e. this was a retry.
 */
async function writeEntry(tx: Tx, entry: EntryInput, applyBalance = true) {
  if (!Number.isInteger(entry.points)) {
    throw new Error("LOYALTY_POINTS_NOT_INTEGER");
  }

  await ensureAccount(tx, entry.userId);

  const inserted = await tx
    .query(
      sql`INSERT INTO "public"."loyaltyEntry"
          ("userId", "kind", "points", "orderId", "availableAt", "idempotencyKey", "rule", "reason", "actorUserId")
        VALUES (${entry.userId}, ${entry.kind}, ${entry.points}, NULLIF(${entry.orderId ?? 0}, 0), ${entry.availableAt}::timestamptz,
          ${entry.key}, ${entry.rule}, NULLIF(${entry.reason ?? ""}, ''), NULLIF(${entry.actorUserId ?? 0}, 0))
        ON CONFLICT ("idempotencyKey") DO NOTHING RETURNING "id"`
        .returnsRow({ id: "pg/int4@1" })
        .build(),
    )
    .toArray();

  if (!inserted.length) {
    return false;
  }

  if (applyBalance) {
    await tx
      .query(
        sql`UPDATE "public"."loyaltyAccount" SET "balance" = "balance" + ${entry.points}, "updatedAt" = now()
          WHERE "userId" = ${entry.userId} RETURNING "balance"`
          .returnsRow({ balance: "pg/int4@1" })
          .build(),
      )
      .toArray();
  }

  return true;
}

async function clearOpenReward(tx: Tx, orderId: number) {
  await tx
    .query(
      sql`UPDATE "public"."loyaltyAccount" SET "openRewardOrderId" = NULL, "updatedAt" = now()
        WHERE "openRewardOrderId" = ${orderId} RETURNING "id"`
        .returnsRow({ id: "pg/int4@1" })
        .build(),
    )
    .toArray();
}

// ------------------------------------------------------------------- reading

async function iptvSubscriptions(userId: number) {
  const rows = await db.orm.public.Subscription.where({ userId }).all();

  return rows
    .filter((row) => String(row.serviceType ?? "IPTV").toUpperCase() === "IPTV")
    .sort((a, b) => String(b.expiryDate).localeCompare(String(a.expiryDate)));
}

async function entriesFor(userId: number) {
  return db.orm.public.LoyaltyEntry.where({ userId })
    .orderBy([(entry) => entry.createdAt.desc(), (entry) => entry.id.desc()])
    .all();
}

/**
 * Writes the EXPIRE entry once the balance has passed its expiry date (no
 * cron in v1: this runs whenever the balance is read). Keyed by the expiry
 * date, so it happens once per expiry and never twice in a race.
 */
async function applyExpiry(userId: number, rules: LoyaltyRules, expiryDate: string | null, balance: number) {
  if (!expiryDate || balance <= 0 || !isPointsExpired(expiryDate)) {
    return false;
  }

  const now = new Date().toISOString();

  return db.transaction((tx) =>
    writeEntry(tx, {
      userId,
      kind: "EXPIRE",
      points: -balance,
      availableAt: now,
      key: `expire:user:${userId}:${expiryDate}`,
      rule: ruleSnapshot(rules, { expiryDate }),
      reason: `انتهت النقاط بتاريخ ${expiryDate}`,
    }),
  );
}

export type LoyaltyView = Awaited<ReturnType<typeof getLoyalty>>;

/** Everything the customer's points page, dashboard card and app need. */
export async function getLoyalty(userId: number) {
  const rules = await getLoyaltyRules();
  const subscriptions = await iptvSubscriptions(userId);
  const latestExpiry = subscriptions[0] ? String(subscriptions[0].expiryDate).slice(0, 10) : null;
  const expiryDate = pointsExpiryDate(latestExpiry, rules);

  let entries = await entriesFor(userId);

  if (await applyExpiry(userId, rules, expiryDate, splitBalance(entries).balance)) {
    entries = await entriesFor(userId);
  }

  const account = await db.orm.public.LoyaltyAccount.first({ userId });
  const split = splitBalance(entries);

  // What one renewal of the customer's usual length earns (their latest award).
  const lastEarn = entries.find((entry) => entry.kind === "EARN" && entry.points > 0);
  const perRenewal = lastEarn ? lastEarn.points : null;

  const orderIds = [...new Set(entries.map((entry) => entry.orderId).filter((id): id is number => typeof id === "number"))];
  const accountState = account
    ? {
        status: account.status,
        balance: account.balance,
        openRewardOrderId: account.openRewardOrderId ?? null,
        lastRedeemedAt: account.lastRedeemedAt ? String(account.lastRedeemedAt) : null,
      }
    : null;

  const rewards = await Promise.all(
    (["3m", "6m"] as const).map(async (key) => {
      const configured = await rewardOption(rules, key);
      const problem = redeemProblem({
        rules,
        account: accountState,
        available: split.available,
        reward: key,
        hasIptvSubscription: subscriptions.length > 0,
        rewardOptionActive: Boolean(configured),
      });

      return {
        key,
        months: rewardMonths(key),
        cost: rewardCost(rules, key),
        /** The IPTV price of this length, to show what the reward is worth. */
        worth: configured ? configured.option.price : null,
        available: Boolean(configured),
        problem,
      };
    }),
  );

  return {
    enabled: rules.enabled,
    rules,
    status: account?.status ?? "ACTIVE",
    balance: split.balance,
    available: split.available,
    pending: split.pending,
    nextUnlock: split.nextUnlock,
    expiryDate: split.balance > 0 ? expiryDate : null,
    perRenewal,
    openRewardOrderId: account?.openRewardOrderId ?? null,
    lastRedeemedAt: accountState?.lastRedeemedAt ?? null,
    rewards,
    subscriptions: subscriptions.map((row) => ({
      id: row.id,
      packageName: row.packageName,
      expiryDate: String(row.expiryDate),
      state: deriveSubscriptionState({ status: row.status, expiryDate: String(row.expiryDate) }),
    })),
    entries: entries.map((entry) => ({
      id: entry.id,
      kind: entry.kind as LoyaltyKind,
      label: LEDGER_LABELS[entry.kind as LoyaltyKind] ?? { ar: entry.kind, en: entry.kind },
      points: entry.points,
      orderId: entry.orderId ?? null,
      orderNumber: entry.orderId ? formatOrderNumber(entry.orderId) : null,
      availableAt: String(entry.availableAt),
      pending: entry.points > 0 && Date.parse(String(entry.availableAt)) > Date.now(),
      createdAt: String(entry.createdAt),
      reason: entry.reason ?? null,
    })),
    orderIds,
  };
}

/** The points line on an order page / receipt: what this order earned and where it stands. */
export async function orderLoyalty(orderId: number) {
  const entries = await db.orm.public.LoyaltyEntry.where({ orderId }).all();
  const earned = entries.filter((entry) => entry.kind === "EARN").reduce((sum, entry) => sum + entry.points, 0);

  if (!earned) {
    return null;
  }

  const reversed = entries.some((entry) => entry.kind === "REVERSE");
  const earn = entries.find((entry) => entry.kind === "EARN");
  const pending = earn ? Date.parse(String(earn.availableAt)) > Date.now() : false;

  return {
    points: earned,
    state: reversed ? ("REVERSED" as const) : pending ? ("PENDING" as const) : ("CONFIRMED" as const),
    availableAt: earn ? String(earn.availableAt) : null,
  };
}

/** Points an order of this option and price would earn (shown before checkout); null when the program is off. */
export async function previewOrderPoints(serviceType: string, price: number, optionId: number | null) {
  const rules = await getLoyaltyRules();

  if (!rules.enabled || !earnsPoints(serviceType)) {
    return null;
  }

  const option = optionId ? await db.orm.public.PackageOption.first({ id: optionId }) : null;

  return orderPointValue(price, option?.pointsEarned ?? null, serviceType);
}

// ------------------------------------------------------------------- earning

/**
 * Awards a completed order's points once. Called right after the order is
 * completed; `snapshotPrice` is the price stored on the order before staff
 * completed it (the customer's price). Does nothing while the program is off,
 * so an order completed then never earns later.
 */
export async function awardForOrder(orderId: number, snapshotPrice?: number, options: { backfill?: boolean } = {}) {
  try {
    const rules = await getLoyaltyRules();
    const order = await db.orm.public.SubscriptionRequest.first({ id: orderId });

    if (!order) {
      return { awarded: 0 };
    }

    if (order.loyaltyReward) {
      await db.transaction((tx) => clearOpenReward(tx, orderId));
      return { awarded: 0 };
    }

    // A backfill re-awards an order completed while the program was on
    // (checked by missingAwards), even if the program is off today.
    if (!rules.enabled && !options.backfill) {
      return { awarded: 0 };
    }

    const price = snapshotPrice ?? order.price;
    const option = order.packageOptionId ? await db.orm.public.PackageOption.first({ id: order.packageOptionId }) : null;
    const points = pointsForOrder(
      { serviceType: order.serviceType, requestType: order.requestType, price, status: order.status, loyaltyReward: order.loyaltyReward, channel: order.channel },
      option?.pointsEarned ?? null,
    );

    if (points <= 0) {
      return { awarded: 0 };
    }

    const availableAt = unlockDate(new Date(), rules).toISOString();
    const written = await db.transaction((tx) =>
      writeEntry(tx, {
        userId: order.userId,
        kind: "EARN",
        points,
        orderId,
        availableAt,
        key: `earn:order:${orderId}`,
        rule: ruleSnapshot(rules, { orderId, price, optionId: order.packageOptionId ?? null, optionPoints: option?.pointsEarned ?? null }),
      }),
    );

    if (!written) {
      return { awarded: 0 };
    }

    await logActivity({
      userId: order.userId,
      entityType: "LOYALTY",
      entityId: orderId,
      action: "LOYALTY_EARNED",
      summary: `+${points} نقطة على الطلب ${orderRef(orderId)}`,
      customerVisible: true,
    });

    await notify({
      userId: order.userId,
      type: "LOYALTY_EARNED",
      title: `+${pointsLabel(points, "ar")} بنقاط شاشتنا`,
      body: `حصلت على ${pointsLabel(points, "ar")} من الطلب ${orderRef(orderId)}. تصير متاحة بعد ${rules.pendingDays} أيام.`,
      link: "/points",
      dedupeKey: `loyalty-earn:order:${orderId}`,
    });

    return { awarded: points };
  } catch (error) {
    // Never break the order completion that called this. The admin points
    // page lists orders left without their award (missingAwards) to retry.
    console.error("LOYALTY_AWARD_ERROR:", error);
    await logActivity({ entityType: "LOYALTY", entityId: orderId, action: "LOYALTY_AWARD_FAILED", summary: `تعذر احتساب نقاط الطلب ${orderRef(orderId)}` });
    return { awarded: 0 };
  }
}

// ------------------------------------------------------------------- redemption

class Refused extends Error {}

export type RedeemResult = { ok: true; orderId: number } | Fail;

/**
 * Spends points on a free IPTV renewal: one transaction takes the points with
 * a conditional UPDATE, creates the 0-price RENEW reward order (SUBMITTED,
 * waiting for the owner's approval) and records the REDEEM entry. The order is
 * created here only, never through createOrder / saveOrder.
 */
export async function redeemReward(userId: number, rewardKey: unknown, subscriptionId: unknown): Promise<RedeemResult> {
  if (!isRewardKey(rewardKey)) {
    return fail(400, "اختر المكافأة.");
  }

  const subscriptionNumber = Number(subscriptionId);

  if (!Number.isInteger(subscriptionNumber) || subscriptionNumber <= 0) {
    return fail(400, "اختر اشتراك IPTV اللي تريد تجدده.");
  }

  const view = await getLoyalty(userId);
  const reward = view.rewards.find((item) => item.key === rewardKey);

  if (reward?.problem) {
    return fail(409, reward.problem.ar);
  }

  const subscription = await db.orm.public.Subscription.first({ id: subscriptionNumber, userId });

  if (!subscription || String(subscription.serviceType ?? "IPTV").toUpperCase() !== "IPTV") {
    return fail(404, "اشتراك IPTV المحدد غير موجود.");
  }

  const configured = await rewardOption(view.rules, rewardKey);

  if (!configured) {
    return fail(409, "هذه المكافأة غير متاحة حالياً. جرّب بعدين أو تواصل مع الدعم.");
  }

  const rules = view.rules;
  const cost = rewardCost(rules, rewardKey);
  const nowIso = new Date().toISOString();

  try {
    const orderId = await db.transaction(async (tx) => {
      await ensureAccount(tx, userId);

      const pendingRows = await tx.orm.public.LoyaltyEntry.where({ userId })
        .where((entry) => entry.points.gt(0))
        .where((entry) => entry.availableAt.gt(nowIso))
        .select("points")
        .all();
      const pending = pendingRows.reduce((sum, entry) => sum + entry.points, 0);

      const taken = await tx
        .query(
          sql`UPDATE "public"."loyaltyAccount"
              SET "balance" = "balance" - ${cost}, "lastRedeemedAt" = now(), "updatedAt" = now()
            WHERE "userId" = ${userId}
              AND "status" = 'ACTIVE'
              AND "openRewardOrderId" IS NULL
              AND "balance" >= ${cost + pending}
              AND ("lastRedeemedAt" IS NULL OR "lastRedeemedAt" <= now() - make_interval(days => ${rules.cooldownDays}))
            RETURNING "balance"`
            .returnsRow({ balance: "pg/int4@1" })
            .build(),
        )
        .toArray();

      if (!taken.length) {
        throw new Refused();
      }

      const order = await tx.orm.public.SubscriptionRequest.create({
        userId,
        status: "SUBMITTED",
        planSlug: configured.pkg.slug,
        packageOptionId: configured.option.id,
        serviceType: "IPTV",
        serviceName: configured.pkg.name,
        requestType: "RENEW",
        price: 0,
        durationMonths: configured.option.durationMonths,
        durationLabel: configured.option.durationLabel,
        bonusYears: 0,
        deviceId: null,
        deviceName: null,
        devicePrice: null,
        contactMethod: "PENDING",
        paymentMethod: "مكافأة نقاط",
        subscriptionId: subscription.id,
        loyaltyReward: true,
      });

      await tx.orm.public.LoyaltyAccount.where({ userId }).update({ openRewardOrderId: order.id, updatedAt: nowIso });

      await writeEntry(
        tx,
        {
          userId,
          kind: "REDEEM",
          points: -cost,
          orderId: order.id,
          availableAt: nowIso,
          key: `redeem:order:${order.id}`,
          rule: ruleSnapshot(rules, { reward: rewardKey, cost, optionId: configured.option.id, subscriptionId: subscription.id }),
        },
        false,
      );

      return order.id;
    });

    await logActivity({
      actor: { id: userId, role: "CUSTOMER" },
      userId,
      entityType: "ORDER",
      entityId: orderId,
      action: "ORDER_CREATED",
      summary: `تم إنشاء الطلب ${orderRef(orderId)} (مكافأة نقاط: ${configured.option.durationLabel})`,
      customerVisible: true,
    });

    await logActivity({
      actor: { id: userId, role: "CUSTOMER" },
      userId,
      entityType: "LOYALTY",
      entityId: orderId,
      action: "LOYALTY_REDEEMED",
      summary: `استبدال ${cost} نقطة بمكافأة ${rewardMonths(rewardKey)} أشهر (الطلب ${orderRef(orderId)})`,
      customerVisible: true,
    });

    await notify({
      userId,
      type: "LOYALTY_REDEEMED",
      title: "استلمنا طلب مكافأتك",
      body: `استبدلت ${pointsLabel(cost, "ar")} بتجديد ${configured.option.durationLabel} مجاناً. فريقنا يراجع الطلب ويفعّله.`,
      link: `/orders/${orderId}`,
      dedupeKey: `loyalty-redeem:order:${orderId}`,
    });

    return { ok: true, orderId };
  } catch (error) {
    if (error instanceof Refused) {
      return fail(409, "ما كدرنا نستبدل النقاط: الرصيد ما يكفي، أو عندك مكافأة مفتوحة، أو لسه ما مرت فترة الانتظار. حدّث الصفحة وشوف.");
    }

    console.error("LOYALTY_REDEEM_ERROR:", error);
    return fail(500, "تعذر استبدال النقاط. حاول مرة ثانية.");
  }
}

/**
 * Gives back a reward order's points when it is rejected or cancelled before
 * completion (once, by key), frees the "one open reward" slot and restores
 * the cooldown to the customer's previous kept redemption.
 */
export async function returnReward(orderId: number, actor?: Actor | null) {
  try {
    const order = await db.orm.public.SubscriptionRequest.first({ id: orderId });

    if (!order || !order.loyaltyReward || normalizeOrderStatus(order.status) === "COMPLETED") {
      return { returned: 0 };
    }

    const redeem = await db.orm.public.LoyaltyEntry.first({ idempotencyKey: `redeem:order:${orderId}` });

    if (!redeem || redeem.points >= 0) {
      return { returned: 0 };
    }

    const rules = await getLoyaltyRules();
    const points = -redeem.points;
    const nowIso = new Date().toISOString();

    const written = await db.transaction(async (tx) => {
      const done = await writeEntry(tx, {
        userId: order.userId,
        kind: "REDEEM_RETURN",
        points,
        orderId,
        availableAt: nowIso,
        key: `redeem-return:order:${orderId}`,
        rule: ruleSnapshot(rules, { returnOf: redeem.id }),
        reason: `الطلب ${formatOrderNumber(orderId)} ${normalizeOrderStatus(order.status) === "REJECTED" ? "مرفوض" : "ملغي"}`,
        actorUserId: actor?.id ?? null,
      });

      if (done) {
        await clearOpenReward(tx, orderId);

        // The cooldown follows the latest redemption that was kept.
        await tx
          .query(
            sql`UPDATE "public"."loyaltyAccount" SET "lastRedeemedAt" = (
                SELECT max(r."createdAt") FROM "public"."loyaltyEntry" r
                WHERE r."userId" = ${order.userId} AND r."kind" = 'REDEEM'
                  AND NOT EXISTS (SELECT 1 FROM "public"."loyaltyEntry" b WHERE b."kind" = 'REDEEM_RETURN' AND b."orderId" = r."orderId")
              ), "updatedAt" = now()
              WHERE "userId" = ${order.userId} RETURNING "id"`
              .returnsRow({ id: "pg/int4@1" })
              .build(),
          )
          .toArray();
      }

      return done;
    });

    if (written) {
      await logActivity({
        actor: actor ?? null,
        userId: order.userId,
        entityType: "LOYALTY",
        entityId: orderId,
        action: "LOYALTY_RETURNED",
        summary: `إرجاع ${points} نقطة: الطلب ${orderRef(orderId)} ما اكتمل`,
        customerVisible: true,
      });

      await notify({
        userId: order.userId,
        type: "LOYALTY_RETURNED",
        title: "رجّعنا نقاطك",
        body: `رجعت ${pointsLabel(points, "ar")} لرصيدك لأن طلب المكافأة ${orderRef(orderId)} ما اكتمل.`,
        link: "/points",
        dedupeKey: `loyalty-return:order:${orderId}`,
      });
    }

    return { returned: written ? points : 0 };
  } catch (error) {
    console.error("LOYALTY_RETURN_ERROR:", error);
    return { returned: 0 };
  }
}

// ------------------------------------------------------------------- owner corrections

function cleanReason(value: unknown) {
  const text = String(value ?? "").trim().slice(0, 500);

  return text.length >= 3 ? text : null;
}

function isOwner(actor: Actor) {
  return isFullAccess(actor.role);
}

/** Takes back the points an order earned (no refund status exists). Owner only; the balance may go negative. */
export async function reverseOrder(actor: Actor, orderId: number, reasonInput: unknown): Promise<{ ok: true; points: number } | Fail> {
  if (!isOwner(actor)) return fail(403, "سحب النقاط للمالك فقط.");

  const reason = cleanReason(reasonInput);

  if (!reason) return fail(400, "اكتب سبب سحب النقاط (3 أحرف على الأقل).");

  const earn = await db.orm.public.LoyaltyEntry.first({ idempotencyKey: `earn:order:${orderId}` });

  if (!earn || earn.points <= 0) return fail(404, "هذا الطلب ما أخذ نقاط حتى تنسحب.");

  const rules = await getLoyaltyRules();
  const written = await db.transaction((tx) =>
    writeEntry(tx, {
      userId: earn.userId,
      kind: "REVERSE",
      points: -earn.points,
      orderId,
      availableAt: new Date().toISOString(),
      key: `reverse:order:${orderId}`,
      rule: ruleSnapshot(rules, { reverseOf: earn.id }),
      reason,
      actorUserId: actor.id,
    }),
  );

  if (!written) return fail(409, "نقاط هذا الطلب انسحبت من قبل.");

  await logActivity({
    actor,
    userId: earn.userId,
    entityType: "LOYALTY",
    entityId: orderId,
    action: "LOYALTY_ADJUSTED",
    summary: `سحب ${earn.points} نقطة من الطلب ${orderRef(orderId)}`,
    details: reason,
  });

  return { ok: true, points: -earn.points };
}

/** A manual correction (positive or negative). Owner only, with a reason. */
export async function adjust(actor: Actor, userId: number, pointsInput: unknown, reasonInput: unknown): Promise<{ ok: true } | Fail> {
  if (!isOwner(actor)) return fail(403, "تعديل النقاط للمالك فقط.");

  const points = typeof pointsInput === "number" ? pointsInput : Number(String(pointsInput ?? "").trim());

  if (!Number.isInteger(points) || points === 0 || Math.abs(points) > 100000) {
    return fail(400, "النقاط يجب أن تكون رقمًا صحيحًا غير صفر (بين -100000 و100000).");
  }

  const reason = cleanReason(reasonInput);

  if (!reason) return fail(400, "اكتب سبب التعديل (3 أحرف على الأقل).");

  const user = await db.orm.public.User.first({ id: userId });

  if (!user) return fail(404, "العميل غير موجود.");

  const rules = await getLoyaltyRules();

  await db.transaction((tx) =>
    writeEntry(tx, {
      userId,
      kind: "ADJUST",
      points,
      availableAt: new Date().toISOString(),
      key: `adjust:${randomUUID()}`,
      rule: ruleSnapshot(rules),
      reason,
      actorUserId: actor.id,
    }),
  );

  await logActivity({
    actor,
    userId,
    entityType: "LOYALTY",
    entityId: userId,
    action: "LOYALTY_ADJUSTED",
    summary: `تعديل إداري: ${points > 0 ? "+" : ""}${points} نقطة`,
    details: reason,
  });

  return { ok: true };
}

/** Owner suspends or reactivates a customer's points account (blocks redemption only). */
export async function setAccountStatus(actor: Actor, userId: number, status: unknown): Promise<{ ok: true } | Fail> {
  if (!isOwner(actor)) return fail(403, "إيقاف حساب النقاط للمالك فقط.");

  const target = String(status ?? "").toUpperCase();

  if (target !== "ACTIVE" && target !== "SUSPENDED") return fail(400, "الحالة غير صحيحة.");

  await db.transaction((tx) => ensureAccount(tx, userId));
  await db.orm.public.LoyaltyAccount.where({ userId }).update({ status: target, updatedAt: new Date().toISOString() });
  await logActivity({ actor, userId, entityType: "LOYALTY", entityId: userId, action: "LOYALTY_ADJUSTED", summary: target === "SUSPENDED" ? "إيقاف حساب النقاط" : "تفعيل حساب النقاط" });

  return { ok: true };
}

// ------------------------------------------------------------------- launch seed

/**
 * The one-time launch gift: `seedPoints` for each customer with an active IPTV
 * subscription and at least one paid, completed IPTV order on the site. Keyed
 * per customer, so running it again gives nothing twice. `check` only counts.
 */
export async function seedAtLaunch({ check }: { check: boolean }) {
  const rules = await getLoyaltyRules();
  const now = Date.now();

  const [subscriptions, orders, seeded] = await Promise.all([
    db.orm.public.Subscription.all(),
    db.orm.public.SubscriptionRequest.where((order) => order.price.gt(0)).select("userId", "serviceType", "status", "loyaltyReward", "channel").all(),
    db.orm.public.LoyaltyEntry.where({ kind: "SEED" }).select("userId").all(),
  ]);

  const active = new Set(
    subscriptions
      .filter((row) => String(row.serviceType ?? "IPTV").toUpperCase() === "IPTV")
      .filter((row) => {
        const state = deriveSubscriptionState({ status: row.status, expiryDate: String(row.expiryDate) }, now);
        return state === "ACTIVE" || state === "EXPIRING";
      })
      .map((row) => row.userId),
  );
  const paid = new Set(
    orders
      .filter((row) => String(row.serviceType).toUpperCase() === "IPTV" && !row.loyaltyReward && String(row.channel ?? "SITE").toUpperCase() === "SITE" && normalizeOrderStatus(row.status) === "COMPLETED")
      .map((row) => row.userId),
  );
  const already = new Set(seeded.map((row) => row.userId));
  const eligible = [...active].filter((userId) => paid.has(userId));
  const toSeed = eligible.filter((userId) => !already.has(userId));

  const summary = {
    eligible: eligible.length,
    alreadySeeded: eligible.length - toSeed.length,
    toSeed: toSeed.length,
    seedPoints: rules.seedPoints,
    totalPoints: toSeed.length * rules.seedPoints,
    worstCaseUsd: liabilityUsd(toSeed.length * rules.seedPoints, rules),
    written: 0,
  };

  if (check || rules.seedPoints <= 0) {
    return summary;
  }

  const nowIso = new Date().toISOString();

  for (const userId of toSeed) {
    const written = await db.transaction((tx) =>
      writeEntry(tx, {
        userId,
        kind: "SEED",
        points: rules.seedPoints,
        availableAt: nowIso,
        key: `seed:user:${userId}`,
        rule: ruleSnapshot(rules),
        reason: "هدية إطلاق نقاط شاشتنا",
      }),
    );

    if (written) summary.written += 1;
  }

  await logActivity({
    entityType: "LOYALTY",
    action: "LOYALTY_SEEDED",
    summary: `هدية الإطلاق: ${summary.written} عميل × ${rules.seedPoints} نقطة`,
  });

  return summary;
}

// ------------------------------------------------------------------- admin

/** Accounts whose cached balance differs from the sum of their ledger. */
export async function reconciliationMismatches() {
  return db
    .runtime()
    .query(
      sql`SELECT a."userId" AS "userId", a."balance" AS "balance", COALESCE(SUM(e."points"), 0)::int4 AS "ledger"
        FROM "public"."loyaltyAccount" a
        LEFT JOIN "public"."loyaltyEntry" e ON e."userId" = a."userId"
        GROUP BY a."userId", a."balance"
        HAVING a."balance" <> COALESCE(SUM(e."points"), 0)`
        .returnsRow({ userId: "pg/int4@1", balance: "pg/int4@1", ledger: "pg/int4@1" })
        .build(),
    )
    .toArray();
}

/** Finance report: points by kind, reward orders, outstanding liability. */
export async function loyaltyReport() {
  const rules = await getLoyaltyRules();
  const totals = await db
    .runtime()
    .query(
      sql`SELECT "kind" AS "kind", COALESCE(SUM("points"), 0)::int4 AS "points", COUNT(*)::int4 AS "entries"
        FROM "public"."loyaltyEntry" GROUP BY "kind"`
        .returnsRow({ kind: "pg/text@1", points: "pg/int4@1", entries: "pg/int4@1" })
        .build(),
    )
    .toArray();
  const outstanding = await db
    .runtime()
    .query(
      sql`SELECT COALESCE(SUM("balance"), 0)::int4 AS "points", COUNT(*)::int4 AS "accounts"
        FROM "public"."loyaltyAccount" WHERE "balance" > 0`
        .returnsRow({ points: "pg/int4@1", accounts: "pg/int4@1" })
        .build(),
    )
    .toArray();
  const rewardOrders = await db.orm.public.SubscriptionRequest.where({ loyaltyReward: true }).select("id", "status", "durationMonths").all();
  const mismatches = await reconciliationMismatches();

  const byKind = Object.fromEntries(totals.map((row) => [row.kind, { points: row.points, entries: row.entries }])) as Partial<Record<LoyaltyKind, { points: number; entries: number }>>;
  const points = (kind: LoyaltyKind) => byKind[kind]?.points ?? 0;
  const completedRewards = rewardOrders.filter((order) => normalizeOrderStatus(order.status) === "COMPLETED");
  const redeemedNet = -(points("REDEEM") + points("REDEEM_RETURN"));

  return {
    rules,
    issued: points("SEED") + points("EARN") + Math.max(0, points("ADJUST")),
    seeded: points("SEED"),
    earned: points("EARN"),
    redeemed: redeemedNet,
    expired: -points("EXPIRE"),
    reversed: -points("REVERSE"),
    adjusted: points("ADJUST"),
    rewards: {
      total: rewardOrders.length,
      completed: completedRewards.length,
      open: rewardOrders.filter((order) => !["COMPLETED", "CANCELLED", "REJECTED"].includes(normalizeOrderStatus(order.status))).length,
      costUsd: liabilityUsd(redeemedNet, rules),
    },
    outstanding: { points: outstanding[0]?.points ?? 0, accounts: outstanding[0]?.accounts ?? 0, liabilityUsd: liabilityUsd(outstanding[0]?.points ?? 0, rules) },
    mismatches,
  };
}

/**
 * Completed, paid IPTV orders that should have earned while the program was
 * on but have no EARN entry (e.g. the award failed). Retrying is safe: the
 * award is keyed earn:order:{id}.
 */
export async function missingAwards() {
  const [settingEvents, orders, earned] = await Promise.all([
    db.orm.public.ActivityEvent.where({ entityType: "LOYALTY", action: "LOYALTY_SETTINGS_CHANGED" }).select("details", "createdAt").all(),
    db.orm.public.SubscriptionRequest.where({ loyaltyReward: false })
      .where((order) => order.price.gt(0))
      .select("id", "userId", "serviceType", "requestType", "price", "status", "loyaltyReward", "channel")
      .all(),
    db.orm.public.LoyaltyEntry.where({ kind: "EARN" }).select("orderId").all(),
  ]);
  const intervals = enabledIntervals(settingEvents.map((event) => ({ at: String(event.createdAt), details: event.details ?? null })));

  if (!intervals.length) {
    return [];
  }

  const candidates = orders.filter((order) => earnsPoints(order.serviceType) && normalizeOrderStatus(order.status) === "COMPLETED");
  const completedAt = new Map<number, string>();

  for (let index = 0; index < candidates.length; index += 500) {
    const chunk = candidates.slice(index, index + 500).map((order) => String(order.id));
    const events = await db.orm.public.ActivityEvent.where({ entityType: "ORDER", action: "ORDER_COMPLETED" })
      .where((event) => event.entityId.in(chunk))
      .select("entityId", "createdAt")
      .all();

    for (const event of events) {
      const id = Number(event.entityId);
      const at = String(event.createdAt);
      const current = completedAt.get(id);
      if (!current || Date.parse(at) < Date.parse(current)) completedAt.set(id, at);
    }
  }

  const earnedIds = new Set(earned.map((entry) => entry.orderId).filter((id): id is number => typeof id === "number"));

  return missedAwards(candidates, completedAt, earnedIds, intervals).map((order) => ({ id: order.id, userId: order.userId, price: order.price, completedAt: completedAt.get(order.id) ?? null }));
}

/** Owner retries every missing award (idempotent). */
export async function awardMissing(actor: Actor): Promise<{ ok: true; orders: number; points: number } | Fail> {
  if (!isOwner(actor)) return fail(403, "احتساب النقاط الناقصة للمالك فقط.");

  let orders = 0;
  let points = 0;

  for (const order of await missingAwards()) {
    const result = await awardForOrder(order.id, undefined, { backfill: true });
    if (result.awarded > 0) {
      orders += 1;
      points += result.awarded;
    }
  }

  await logActivity({ actor, entityType: "LOYALTY", action: "LOYALTY_ADJUSTED", summary: `احتساب نقاط ناقصة: ${orders} طلب، ${points} نقطة` });

  return { ok: true, orders, points };
}

/** Reward orders waiting for the owner's approval (newest first). */
export async function pendingRewardOrders() {
  return db.orm.public.SubscriptionRequest.where({ loyaltyReward: true })
    .where((order) => order.status.in(["SUBMITTED", "PENDING"]))
    .orderBy((order) => order.id.desc())
    .all();
}
