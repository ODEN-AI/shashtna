import { Gift } from "lucide-react";
import Link from "next/link";

import { RedeemDialog } from "@/app/components/account/RedeemDialog";
import { Card, CardHeader } from "@/app/ui/Card";
import { formatDate, type Lang, type Translate } from "@/src/lib/i18n";
import { progressFraction, progressSentence } from "@/src/lib/loyalty";
import type { LoyaltyView } from "@/src/server/loyalty";

/** The redeemable rewards and IPTV subscriptions, in the shape the client dialog takes. */
export function redeemProps(view: LoyaltyView) {
  return {
    rewards: view.rewards.map((reward) => ({ key: reward.key, months: reward.months, cost: reward.cost, worth: reward.worth, problem: reward.problem })),
    subscriptions: view.subscriptions.map((subscription) => ({ id: subscription.id, packageName: subscription.packageName, expiryDate: subscription.expiryDate })),
    available: view.available,
  };
}

/** Dashboard card: balance, progress to the first reward, the next step. */
export function PointsCard({ view, t, lang }: { view: LoyaltyView; t: Translate; lang: Lang }) {
  const fraction = progressFraction(view.available, view.rules);
  const canRedeem = view.rewards.some((reward) => !reward.problem);

  return (
    <Card className="p-5 sm:p-6">
      <CardHeader
        icon={<Gift size={19} aria-hidden />}
        title={t("نقاط شاشتنا", "Shashtna Points")}
        description={progressSentence(view.available, view.rules, view.perRenewal, lang)}
        action={
          <Link href="/points" className="text-sm font-semibold text-brand-ink hover:underline">
            {t("التفاصيل", "Details")}
          </Link>
        }
      />
      <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
        <p className="text-ink">
          <span className="nums text-3xl font-bold">{Math.max(0, view.available)}</span>
          <span className="ms-2 text-sm text-ink-3">{t("نقطة متاحة", "points available")}</span>
        </p>
        {view.pending > 0 ? (
          <p className="nums text-xs text-ink-3">
            {t(`+${view.pending} معلّقة`, `+${view.pending} pending`)}
            {view.nextUnlock ? ` · ${t("تصير متاحة", "unlock")} ${formatDate(view.nextUnlock, lang)}` : ""}
          </p>
        ) : null}
      </div>
      <div
        className="mt-3 h-2 overflow-hidden rounded-full bg-surface-3"
        role="progressbar"
        aria-label={t("التقدم نحو 3 أشهر مجاناً", "Progress to 3 free months")}
        aria-valuemin={0}
        aria-valuemax={view.rules.reward3mPoints}
        aria-valuenow={Math.max(0, Math.min(view.available, view.rules.reward3mPoints))}
      >
        <div className="h-full rounded-full bg-glow" style={{ width: `${Math.round(fraction * 100)}%` }} />
      </div>
      <p className="nums mt-2 text-xs text-ink-3">
        {Math.max(0, Math.min(view.available, view.rules.reward3mPoints))} / {view.rules.reward3mPoints}
      </p>
      {canRedeem ? <RedeemDialog {...redeemProps(view)} size="sm" className="mt-4" /> : null}
    </Card>
  );
}
