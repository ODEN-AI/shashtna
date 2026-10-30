import { progressSentence } from "@/src/lib/loyalty";
import { getLoyalty } from "@/src/server/loyalty";

/**
 * `GET loyalty` shape. While the program is off only `enabled: false` is
 * sent, so the app hides the feature like the website does.
 */
export async function mobileLoyalty(userId: number) {
  const view = await getLoyalty(userId);

  if (!view.enabled) {
    return { enabled: false as const };
  }

  return {
    enabled: true as const,
    status: view.status,
    balance: view.balance,
    available: view.available,
    pending: view.pending,
    nextUnlockAt: view.nextUnlock,
    expiresOn: view.expiryDate,
    progress: {
      target: view.rules.reward3mPoints,
      current: Math.max(0, Math.min(view.available, view.rules.reward3mPoints)),
      messageAr: progressSentence(view.available, view.rules, view.perRenewal, "ar"),
      messageEn: progressSentence(view.available, view.rules, view.perRenewal, "en"),
    },
    openRewardOrderId: view.openRewardOrderId,
    rules: {
      pendingDays: view.rules.pendingDays,
      expiryMonths: view.rules.expiryMonths,
      cooldownDays: view.rules.cooldownDays,
    },
    rewards: view.rewards.map((reward) => ({
      key: reward.key,
      months: reward.months,
      cost: reward.cost,
      worth: reward.worth,
      redeemable: !reward.problem,
      problem: reward.problem ? { code: reward.problem.code, messageAr: reward.problem.ar, messageEn: reward.problem.en, until: reward.problem.until ?? null } : null,
    })),
    subscriptions: view.subscriptions.map((subscription) => ({ id: subscription.id, packageName: subscription.packageName, expiryDate: subscription.expiryDate })),
    entries: view.entries.slice(0, 50).map((entry) => ({
      id: entry.id,
      kind: entry.kind,
      labelAr: entry.label.ar,
      labelEn: entry.label.en,
      points: entry.points,
      orderId: entry.orderId,
      orderNumber: entry.orderNumber,
      availableAt: entry.availableAt,
      createdAt: entry.createdAt,
    })),
  };
}
