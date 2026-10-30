"use client";

import { Gift } from "lucide-react";
import { useState } from "react";

import { redeemPointsAction } from "@/app/(site)/(account)/actions";
import { useLanguage } from "@/app/components/LanguageProvider";
import { ActionForm } from "@/app/ui/ActionForm";
import { Button } from "@/app/ui/Button";
import { cn } from "@/app/ui/cn";
import { Dialog } from "@/app/ui/Dialog";
import { Field, Select } from "@/app/ui/Field";
import { Notice } from "@/app/ui/States";
import { SubmitButton } from "@/app/ui/SubmitButton";
import { formatDate, formatPrice } from "@/src/lib/i18n";
import { redeemProblemText } from "@/src/lib/loyalty";

export type RedeemReward = {
  key: "3m" | "6m";
  months: number;
  cost: number;
  worth: number | null;
  problem: { code: string; ar: string; en: string; until?: string } | null;
};

export type RedeemSubscription = { id: number; packageName: string; expiryDate: string };

/**
 * Redeem flow: pick the reward and the IPTV subscription it renews, see the
 * balance after, confirm. Every check runs again on the server; this only
 * explains up front why a reward can't be taken.
 */
export function RedeemDialog({
  rewards,
  subscriptions,
  available,
  className,
  size = "md",
}: {
  rewards: RedeemReward[];
  subscriptions: RedeemSubscription[];
  available: number;
  className?: string;
  size?: "sm" | "md";
}) {
  const { t, language } = useLanguage();
  const [open, setOpen] = useState(false);
  const firstOpen = rewards.find((reward) => !reward.problem) ?? rewards[0];
  const [choice, setChoice] = useState<RedeemReward["key"]>(firstOpen?.key ?? "3m");
  const selected = rewards.find((reward) => reward.key === choice) ?? firstOpen;
  const blocked = !selected || Boolean(selected.problem);

  return (
    <>
      <Button variant="glow" size={size} className={className} onClick={() => setOpen(true)}>
        <Gift size={16} aria-hidden />
        {t("استبدل نقاطك", "Redeem points")}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t("استبدال النقاط", "Redeem points")}
        description={t("المكافأة تجديد مجاني لاشتراك IPTV. فريقنا يراجع الطلب ويفعّله.", "The reward is a free IPTV renewal. Our team reviews and activates it.")}
        closeLabel={t("إغلاق", "Close")}
      >
        <ActionForm action={redeemPointsAction} className="space-y-5">
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-semibold text-ink">{t("اختر المكافأة", "Choose a reward")}</legend>
            {rewards.map((reward) => (
              <label
                key={reward.key}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors",
                  choice === reward.key ? "border-brand bg-brand/10" : "border-line bg-surface-2",
                  reward.problem ? "opacity-70" : "",
                )}
              >
                <input
                  type="radio"
                  name="reward"
                  value={reward.key}
                  checked={choice === reward.key}
                  onChange={() => setChoice(reward.key)}
                  className="mt-1 accent-brand"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-baseline justify-between gap-2">
                    <b className="text-ink">{t(`${reward.months} أشهر مجاناً`, `${reward.months} free months`)}</b>
                    <span className="nums text-sm font-bold text-glow">{t(`${reward.cost} نقطة`, `${reward.cost} points`)}</span>
                  </span>
                  {reward.worth ? (
                    <span className="nums mt-1 block text-xs text-ink-3">
                      {t("قيمتها", "Worth")} {formatPrice(reward.worth, language)}
                    </span>
                  ) : null}
                  {reward.problem ? <span className="mt-1 block text-xs leading-5 text-warning">{redeemProblemText(reward.problem, language)}</span> : null}
                </span>
              </label>
            ))}
          </fieldset>

          {subscriptions.length ? (
            <Field label={t("الاشتراك اللي يتجدد", "Subscription to renew")} htmlFor="redeem-subscription">
              <Select id="redeem-subscription" name="subscriptionId" defaultValue={String(subscriptions[0].id)}>
                {subscriptions.map((subscription) => (
                  <option key={subscription.id} value={subscription.id}>
                    {subscription.packageName} — {t("ينتهي", "expires")} {formatDate(subscription.expiryDate, language)}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}

          {selected ? (
            <div className="surface flex items-center justify-between gap-3 rounded-2xl p-4 text-sm">
              <span className="text-ink-2">{t("رصيدك بعد الاستبدال", "Balance after redeeming")}</span>
              <b className="nums text-ink">{t(`${Math.max(0, available - selected.cost)} نقطة`, `${Math.max(0, available - selected.cost)} points`)}</b>
            </div>
          ) : null}

          {selected?.problem ? <Notice tone="warning">{redeemProblemText(selected.problem, language)}</Notice> : null}

          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t("رجوع", "Back")}
            </Button>
            <SubmitButton disabled={blocked} pendingLabel={t("جاري الاستبدال…", "Redeeming…")}>
              {t("تأكيد الاستبدال", "Confirm")}
            </SubmitButton>
          </div>
        </ActionForm>
      </Dialog>
    </>
  );
}
