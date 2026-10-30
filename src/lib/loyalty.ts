import { addDays } from "@/src/lib/business-time";
import { formatDate } from "@/src/lib/i18n";
import { normalizeOrderStatus } from "@/src/lib/order-status";
import { addMonthsClamped } from "@/src/lib/subscription-duration";
import { expiryInstant } from "@/src/lib/subscription-state";

/**
 * «نقاط شاشتنا» — the loyalty program's pure rules (no database).
 *
 * - A completed, paid IPTV order (NEW / RENEW / UPGRADE) earns 1 point per
 *   1,000 IQD of its stored price, rounded down, unless its package option
 *   sets `pointsEarned`. Devices, VIP and reward orders never earn.
 * - Points unlock `pendingDays` after the order completes.
 * - The whole balance expires `expiryMonths` after the customer's latest IPTV
 *   subscription expiry.
 * - Rewards are free IPTV renewals (3 or 6 months) for a set number of points.
 * Every number is an owner-editable setting; see LOYALTY_SETTING_RULES.
 */

export const POINT_VALUE_IQD = 1000;

export const LOYALTY_KINDS = ["SEED", "EARN", "REDEEM", "REDEEM_RETURN", "REVERSE", "ADJUST", "EXPIRE"] as const;
export type LoyaltyKind = (typeof LOYALTY_KINDS)[number];

export const LEDGER_LABELS: Record<LoyaltyKind, { ar: string; en: string }> = {
  SEED: { ar: "هدية بداية", en: "Welcome gift" },
  EARN: { ar: "نقاط طلب", en: "Order points" },
  REDEEM: { ar: "استبدال مكافأة", en: "Reward redeemed" },
  REDEEM_RETURN: { ar: "إرجاع نقاط", en: "Points returned" },
  REVERSE: { ar: "سحب نقاط", en: "Points reversed" },
  ADJUST: { ar: "تعديل إداري", en: "Staff adjustment" },
  EXPIRE: { ar: "انتهاء نقاط", en: "Points expired" },
};

export const REWARD_KEYS = ["3m", "6m"] as const;
export type RewardKey = (typeof REWARD_KEYS)[number];

export type LoyaltyRules = {
  enabled: boolean;
  reward3mPoints: number;
  reward6mPoints: number;
  pendingDays: number;
  expiryMonths: number;
  cooldownDays: number;
  seedPoints: number;
  reward3mOptionId: number | null;
  reward6mOptionId: number | null;
};

export const DEFAULT_LOYALTY_RULES: LoyaltyRules = {
  enabled: false,
  reward3mPoints: 30,
  reward6mPoints: 60,
  pendingDays: 7,
  expiryMonths: 6,
  cooldownDays: 90,
  seedPoints: 10,
  reward3mOptionId: null,
  reward6mOptionId: null,
};

type NumberRule = { field: keyof LoyaltyRules; min: number; max: number; optional?: boolean };

/** Setting key → the rule field it holds and its allowed whole-number range. */
export const LOYALTY_SETTING_RULES: Record<string, NumberRule> = {
  "loyalty.reward3mPoints": { field: "reward3mPoints", min: 1, max: 100000 },
  "loyalty.reward6mPoints": { field: "reward6mPoints", min: 1, max: 100000 },
  "loyalty.pendingDays": { field: "pendingDays", min: 0, max: 90 },
  "loyalty.expiryMonths": { field: "expiryMonths", min: 1, max: 60 },
  "loyalty.cooldownDays": { field: "cooldownDays", min: 0, max: 365 },
  "loyalty.seedPoints": { field: "seedPoints", min: 0, max: 1000 },
  "loyalty.reward3mOptionId": { field: "reward3mOptionId", min: 1, max: 2147483647, optional: true },
  "loyalty.reward6mOptionId": { field: "reward6mOptionId", min: 1, max: 2147483647, optional: true },
};

function wholeNumber(value: string) {
  return /^\d{1,10}$/.test(value.trim()) ? Number(value.trim()) : null;
}

/** Server-side validation of one loyalty setting as typed in the admin form. */
export function loyaltySettingProblem(key: string, value: string): string | null {
  if (key === "loyalty.enabled") {
    return value === "on" || value === "off" ? null : "حالة البرنامج يجب أن تكون مفعّل أو متوقف.";
  }

  const rule = LOYALTY_SETTING_RULES[key];

  if (!rule) return null;
  if (!value.trim()) return rule.optional ? null : "كل أرقام برنامج النقاط مطلوبة.";

  const number = wholeNumber(value);

  if (number === null || number < rule.min || number > rule.max) {
    return `القيمة يجب أن تكون رقمًا صحيحًا بين ${rule.min} و${rule.max}.`;
  }

  return null;
}

/** Rules from stored settings; a missing or invalid value falls back to its default. */
export function parseLoyaltyRules(values: Record<string, string | undefined>): LoyaltyRules {
  const rules: LoyaltyRules = { ...DEFAULT_LOYALTY_RULES, enabled: values["loyalty.enabled"] === "on" };

  for (const [key, rule] of Object.entries(LOYALTY_SETTING_RULES)) {
    const raw = String(values[key] ?? "");

    if (raw.trim() && loyaltySettingProblem(key, raw) === null) {
      (rules[rule.field] as number | null) = Number(raw.trim());
    }
  }

  if (rules.reward6mPoints <= rules.reward3mPoints) {
    rules.reward6mPoints = Math.max(rules.reward3mPoints + 1, DEFAULT_LOYALTY_RULES.reward6mPoints);
  }

  return rules;
}

export function rewardCost(rules: LoyaltyRules, key: RewardKey) {
  return key === "3m" ? rules.reward3mPoints : rules.reward6mPoints;
}

export function rewardOptionId(rules: LoyaltyRules, key: RewardKey) {
  return key === "3m" ? rules.reward3mOptionId : rules.reward6mOptionId;
}

export function rewardMonths(key: RewardKey) {
  return key === "3m" ? 3 : 6;
}

export function isRewardKey(value: unknown): value is RewardKey {
  return (REWARD_KEYS as readonly unknown[]).includes(value);
}

/** The JSON stored on every entry: the rules it was computed with. */
export function ruleSnapshot(rules: LoyaltyRules, extra: Record<string, unknown> = {}) {
  const numbers: Partial<LoyaltyRules> = { ...rules };
  delete numbers.enabled;

  return JSON.stringify({ pointValueIqd: POINT_VALUE_IQD, ...numbers, ...extra });
}

// ------------------------------------------------------------------- earning

export type EarnableOrder = {
  serviceType: string;
  requestType: string;
  price: number;
  status: string;
  loyaltyReward: boolean;
};

export type EarnBlock = "NOT_IPTV" | "WRONG_TYPE" | "FREE" | "REWARD" | "NOT_COMPLETED";

/** Why an order earns nothing, or null when it earns points. */
export function earnBlock(order: EarnableOrder): EarnBlock | null {
  if (String(order.serviceType).toUpperCase() !== "IPTV") return "NOT_IPTV";
  if (!["NEW", "RENEW", "UPGRADE"].includes(String(order.requestType).toUpperCase())) return "WRONG_TYPE";
  if (order.loyaltyReward) return "REWARD";
  if (!Number.isInteger(order.price) || order.price <= 0) return "FREE";
  if (normalizeOrderStatus(order.status) !== "COMPLETED") return "NOT_COMPLETED";

  return null;
}

/** Points an order is worth: the option's override, else price ÷ 1,000 rounded down. */
export function orderPointValue(price: number, optionPoints: number | null | undefined) {
  if (typeof optionPoints === "number" && Number.isInteger(optionPoints) && optionPoints >= 0) {
    return optionPoints;
  }

  return Number.isInteger(price) && price > 0 ? Math.floor(price / POINT_VALUE_IQD) : 0;
}

/** Points a completed order earns (0 when it doesn't qualify). */
export function pointsForOrder(order: EarnableOrder, optionPoints: number | null | undefined) {
  return earnBlock(order) === null ? orderPointValue(order.price, optionPoints) : 0;
}

/** Points shown before purchase ("هذا الطلب يعطيك X نقطة"): IPTV plan orders only. */
export function previewPoints(serviceType: string, price: number, optionPoints: number | null | undefined) {
  return String(serviceType).toUpperCase() === "IPTV" ? orderPointValue(price, optionPoints) : 0;
}

/** Validates the per-option `pointsEarned` field from the package form (empty = automatic). */
export function parsePointsEarned(value: unknown): { ok: true; value: number | null } | { ok: false } {
  if (value === null || value === undefined || value === "") return { ok: true, value: null };
  if (typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 100000) return { ok: true, value };

  return { ok: false };
}

export function unlockDate(completedAt: Date, rules: LoyaltyRules) {
  return addDays(completedAt, rules.pendingDays);
}

// ------------------------------------------------------------------- balance

export type LedgerPoint = { points: number; availableAt: string };

/**
 * Balance split: positive entries whose `availableAt` is still ahead are
 * pending; everything else (including deductions) counts at once, so the
 * available figure can go negative after a reversal.
 */
export function splitBalance(entries: LedgerPoint[], now = new Date()) {
  let balance = 0;
  let pending = 0;
  let nextUnlock: string | null = null;

  for (const entry of entries) {
    balance += entry.points;

    const at = Date.parse(String(entry.availableAt));

    if (entry.points > 0 && Number.isFinite(at) && at > now.getTime()) {
      pending += entry.points;
      const iso = new Date(at).toISOString();
      if (!nextUnlock || iso < nextUnlock) nextUnlock = iso;
    }
  }

  return { balance, pending, available: balance - pending, nextUnlock };
}

/** "YYYY-MM-DD" the balance expires, from the latest IPTV subscription expiry; null without one. */
export function pointsExpiryDate(latestIptvExpiry: string | null | undefined, rules: LoyaltyRules) {
  if (!latestIptvExpiry) return null;

  return addMonthsClamped(String(latestIptvExpiry).slice(0, 10), rules.expiryMonths);
}

export function isPointsExpired(expiryDate: string | null, now = new Date()) {
  if (!expiryDate) return false;

  const end = expiryInstant(expiryDate);

  return Number.isFinite(end) && end < now.getTime();
}

// ------------------------------------------------------------------- progress

function renewalsAr(count: number) {
  if (count === 1) return "تجديد واحد";
  if (count === 2) return "تجديدين";
  if (count <= 10) return `${count} تجديدات`;

  return `${count} تجديد`;
}

function pointsAr(count: number) {
  if (count === 1) return "نقطة وحدة";
  if (count === 2) return "نقطتين";
  if (count <= 10) return `${count} نقاط`;

  return `${count} نقطة`;
}

export function pointsLabel(count: number, lang: "ar" | "en") {
  return lang === "ar" ? pointsAr(Math.abs(count)) : `${Math.abs(count)} point${Math.abs(count) === 1 ? "" : "s"}`;
}

/**
 * «باقي لك X تجديدات وتاخذ 3 أشهر مجاناً». `perRenewal` is what one renewal
 * of the customer's usual length earns; without it the gap is given in points.
 */
export function progressSentence(available: number, rules: LoyaltyRules, perRenewal: number | null, lang: "ar" | "en") {
  const target = rules.reward3mPoints;

  if (available >= rules.reward6mPoints) {
    return lang === "ar" ? "نقاطك تكفي لـ 6 أشهر مجاناً." : "You have enough points for 6 free months.";
  }

  if (available >= target) {
    return lang === "ar" ? "نقاطك تكفي لـ 3 أشهر مجاناً." : "You have enough points for 3 free months.";
  }

  const missing = target - Math.max(0, available);

  if (perRenewal && perRenewal > 0) {
    const renewals = Math.ceil(missing / perRenewal);

    return lang === "ar"
      ? `باقي لك ${renewalsAr(renewals)} وتاخذ 3 أشهر مجاناً.`
      : `${renewals} more renewal${renewals === 1 ? "" : "s"} and you get 3 free months.`;
  }

  return lang === "ar"
    ? `باقي لك ${pointsAr(missing)} وتاخذ 3 أشهر مجاناً.`
    : `${missing} more point${missing === 1 ? "" : "s"} and you get 3 free months.`;
}

export function progressFraction(available: number, rules: LoyaltyRules) {
  return Math.max(0, Math.min(1, available / rules.reward3mPoints));
}

// ------------------------------------------------------------------- redemption

export type RedeemProblemCode =
  | "DISABLED"
  | "SUSPENDED"
  | "NEGATIVE"
  | "INSUFFICIENT"
  | "OPEN_REWARD"
  | "COOLDOWN"
  | "NO_SUBSCRIPTION"
  | "NOT_CONFIGURED";

export type RedeemProblem = { code: RedeemProblemCode; ar: string; en: string; until?: string };

export function cooldownUntil(lastRedeemedAt: string | null | undefined, rules: LoyaltyRules) {
  if (!lastRedeemedAt) return null;

  const last = Date.parse(String(lastRedeemedAt));

  return Number.isFinite(last) ? addDays(new Date(last), rules.cooldownDays) : null;
}

export type RedeemState = {
  rules: LoyaltyRules;
  account: { status: string; balance: number; openRewardOrderId: number | null; lastRedeemedAt: string | null } | null;
  available: number;
  reward: RewardKey;
  hasIptvSubscription: boolean;
  rewardOptionActive: boolean;
  now?: Date;
};

/** The first reason a redemption can't go ahead, or null when it can. */
export function redeemProblem(state: RedeemState): RedeemProblem | null {
  const { rules, account } = state;
  const cost = rewardCost(rules, state.reward);

  if (!rules.enabled) {
    return { code: "DISABLED", ar: "برنامج النقاط متوقف حالياً.", en: "The points program is paused right now." };
  }

  if (account && String(account.status).toUpperCase() === "SUSPENDED") {
    return { code: "SUSPENDED", ar: "حساب النقاط موقوف. تواصل مع الدعم.", en: "Your points account is suspended. Contact support." };
  }

  if (account && account.balance < 0) {
    return { code: "NEGATIVE", ar: "رصيد نقاطك بالسالب، فما تكدر تستبدل حالياً.", en: "Your points balance is negative, so you can't redeem right now." };
  }

  if (state.available < cost) {
    return {
      code: "INSUFFICIENT",
      ar: `تحتاج ${pointsAr(cost)} متاحة لهذه المكافأة، وعندك ${pointsAr(Math.max(0, state.available))}.`,
      en: `This reward needs ${cost} available points; you have ${Math.max(0, state.available)}.`,
    };
  }

  if (account?.openRewardOrderId) {
    return { code: "OPEN_REWARD", ar: "عندك مكافأة قيد التنفيذ. تكدر تستبدل غيرها بعد ما تكتمل.", en: "You already have a reward in progress. You can redeem another once it's done." };
  }

  const until = cooldownUntil(account?.lastRedeemedAt ?? null, rules);

  if (until && until.getTime() > (state.now ?? new Date()).getTime()) {
    return { code: "COOLDOWN", ar: "تكدر تستبدل مكافأة وحدة كل فترة. الاستبدال الجاي متاح من تاريخ", en: "One reward per period. Your next redemption opens on", until: until.toISOString() };
  }

  if (!state.hasIptvSubscription) {
    return { code: "NO_SUBSCRIPTION", ar: "المكافأة تجديد لاشتراك IPTV، وما عندك اشتراك IPTV بعد.", en: "Rewards renew an IPTV subscription, and you don't have one yet." };
  }

  if (!state.rewardOptionActive) {
    return { code: "NOT_CONFIGURED", ar: "هذه المكافأة غير متاحة حالياً. جرّب بعدين أو تواصل مع الدعم.", en: "This reward isn't available right now. Try later or contact support." };
  }

  return null;
}

/** A redemption problem as one sentence in the viewer's language (the cooldown gets its date). */
export function redeemProblemText(problem: { ar: string; en: string; until?: string }, lang: "ar" | "en") {
  const text = lang === "ar" ? problem.ar : problem.en;

  return problem.until ? `${text} ${formatDate(problem.until, lang)}.` : text;
}

/** Liability in USD at the owner's rule of thumb: every `reward3mPoints` points ≈ $1 of supplier cost. */
export function liabilityUsd(points: number, rules: LoyaltyRules) {
  return Math.max(0, points) / rules.reward3mPoints;
}

// ------------------------------------------------------------------- missed awards

export type EnabledInterval = { from: number; to: number | null };

/**
 * When the program was on, from the settings audit trail: each
 * LOYALTY_SETTINGS_CHANGED event's details carry "loyalty.enabled: off → on"
 * (describeSettingChanges). The program starts off.
 */
export function enabledIntervals(events: { at: string; details: string | null }[]): EnabledInterval[] {
  const intervals: EnabledInterval[] = [];
  const sorted = [...events].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));

  for (const event of sorted) {
    const match = /^loyalty\.enabled: (\S+) → (\S+)$/m.exec(String(event.details ?? ""));
    const at = Date.parse(event.at);

    if (!match || !Number.isFinite(at)) continue;

    const open = intervals.at(-1);

    if (match[2] === "on" && (!open || open.to !== null)) intervals.push({ from: at, to: null });
    if (match[2] !== "on" && open && open.to === null) open.to = at;
  }

  return intervals;
}

export function wasEnabledAt(intervals: EnabledInterval[], at: string) {
  const time = Date.parse(at);

  return Number.isFinite(time) && intervals.some((interval) => time >= interval.from && (interval.to === null || time < interval.to));
}

/**
 * Orders that should have earned but have no EARN entry (an award that failed):
 * eligible by earnBlock, completed while the program was on.
 */
export function missedAwards<T extends EarnableOrder & { id: number }>(
  orders: T[],
  completedAt: Map<number, string>,
  earnedOrderIds: Set<number>,
  intervals: EnabledInterval[],
) {
  return orders.filter((order) => {
    const at = completedAt.get(order.id);

    return !earnedOrderIds.has(order.id) && earnBlock(order) === null && Boolean(at) && wasEnabledAt(intervals, at!);
  });
}
