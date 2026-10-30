import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Gift, History } from "lucide-react";

import { PointsCard } from "@/app/components/account/PointsCard";
import { Badge } from "@/app/ui/Badge";
import { Card, CardHeader, Stat } from "@/app/ui/Card";
import { cn } from "@/app/ui/cn";
import { PageHeader } from "@/app/ui/Page";
import { EmptyState, Notice } from "@/app/ui/States";
import { formatDate, formatPrice } from "@/src/lib/i18n";
import { redeemProblemText } from "@/src/lib/loyalty";
import { orderRef } from "@/src/lib/order-status";
import { requireCustomer } from "@/src/server/auth";
import { getI18n } from "@/src/server/i18n";
import { getLoyalty } from "@/src/server/loyalty";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "نقاط شاشتنا" };

export default async function PointsPage() {
  const user = await requireCustomer("/points");
  const [{ t, lang }, view] = await Promise.all([getI18n(), getLoyalty(user.id)]);

  // Hidden from customers while the program is off.
  if (!view.enabled) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("نقاط شاشتنا", "Shashtna Points")}
        description={t("كل تجديد IPTV مدفوع يعطيك نقاط، وتستبدلها بأشهر مجانية.", "Every paid IPTV renewal earns points you can swap for free months.")}
      />

      {view.status === "SUSPENDED" ? (
        <Notice tone="danger" title={t("حساب النقاط موقوف", "Points account suspended")}>
          {t("ما تكدر تستبدل نقاط حالياً. تواصل مع الدعم.", "You can't redeem points right now. Contact support.")}
        </Notice>
      ) : null}

      {view.openRewardOrderId ? (
        <Notice tone="info" title={t("عندك مكافأة قيد التنفيذ", "You have a reward in progress")}>
          <Link href={`/orders/${view.openRewardOrderId}`} className="font-semibold text-brand-ink hover:underline">
            {t("تابع الطلب", "Follow the order")} {orderRef(view.openRewardOrderId)}
          </Link>
        </Notice>
      ) : null}

      <PointsCard view={view} t={t} lang={lang} />

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label={t("متاحة", "Available")} value={Math.max(0, view.available)} tone={view.available < 0 ? "danger" : "default"} />
        <Stat
          label={t("معلّقة", "Pending")}
          value={view.pending}
          hint={view.nextUnlock ? `${t("أول دفعة تصير متاحة", "Next unlock")} ${formatDate(view.nextUnlock, lang)}` : t("ماكو نقاط معلّقة", "Nothing pending")}
        />
        <Stat
          label={t("تنتهي بتاريخ", "Expire on")}
          value={view.expiryDate ? formatDate(view.expiryDate, lang) : "—"}
          hint={t(`بعد ${view.rules.expiryMonths} أشهر من انتهاء آخر اشتراك IPTV`, `${view.rules.expiryMonths} months after your latest IPTV expiry`)}
        />
      </div>

      <Card className="p-5 sm:p-6">
        <CardHeader icon={<Gift size={19} aria-hidden />} title={t("المكافآت", "Rewards")} />
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {view.rewards.map((reward) => (
            <li key={reward.key} className={cn("rounded-2xl border border-line bg-surface-2 p-4", reward.problem && "opacity-80")}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <b className="text-ink">{t(`${reward.months} أشهر مجاناً`, `${reward.months} free months`)}</b>
                <span className="nums text-sm font-bold text-glow">{t(`${reward.cost} نقطة`, `${reward.cost} points`)}</span>
              </div>
              {reward.worth ? (
                <p className="nums mt-1 text-xs text-ink-3">
                  {t("قيمتها", "Worth")} {formatPrice(reward.worth, lang)}
                </p>
              ) : null}
              {reward.problem ? <p className="mt-2 text-xs leading-5 text-ink-3">{redeemProblemText(reward.problem, lang)}</p> : null}
            </li>
          ))}
        </ul>
      </Card>

      <Card className="p-5 sm:p-6">
        <CardHeader icon={<History size={19} aria-hidden />} title={t("حركة النقاط", "Points history")} />
        {view.entries.length === 0 ? (
          <EmptyState
            compact
            className="mt-4"
            title={t("ماكو حركة بعد", "No activity yet")}
            description={t("أول ما يكتمل تجديد IPTV مدفوع، تنضاف نقاطه هنا.", "Once a paid IPTV renewal completes, its points show up here.")}
          />
        ) : (
          <ul className="mt-4 divide-y divide-line">
            {view.entries.map((entry) => {
              const pending = entry.pending;

              return (
                <li key={entry.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink">
                      {lang === "ar" ? entry.label.ar : entry.label.en}
                      {pending ? (
                        <Badge tone="warning" className="ms-2">
                          {t("معلّقة", "Pending")}
                        </Badge>
                      ) : null}
                    </p>
                    <p className="nums mt-0.5 text-xs text-ink-3">
                      {formatDate(entry.createdAt, lang)}
                      {entry.orderId ? (
                        <>
                          {" · "}
                          <Link href={`/orders/${entry.orderId}`} className="hover:underline">
                            {entry.orderNumber}
                          </Link>
                        </>
                      ) : null}
                    </p>
                  </div>
                  <span className={cn("nums text-sm font-bold", entry.points < 0 ? "text-danger" : "text-success")} dir="ltr">
                    {entry.points > 0 ? `+${entry.points}` : entry.points}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <div className="space-y-1 text-xs leading-6 text-ink-3">
        <p>
          {t(
            `كل 1,000 د.ع من تجديد IPTV مدفوع ومكتمل = نقطة. النقاط تصير متاحة بعد ${view.rules.pendingDays} أيام، وتنتهي بعد ${view.rules.expiryMonths} أشهر من انتهاء آخر اشتراك.`,
            `Each 1,000 IQD of a paid, completed IPTV order = 1 point. Points unlock after ${view.rules.pendingDays} days and expire ${view.rules.expiryMonths} months after your latest subscription ends.`,
          )}
        </p>
        <p>
          {t(
            `مكافأة وحدة كل ${view.rules.cooldownDays} يوم. النقاط ما تتحول لفلوس، ولا تنتقل لحساب ثاني، ولا تنجمع مع الخصومات.`,
            `One reward every ${view.rules.cooldownDays} days. Points can't be cashed out, transferred or combined with discounts.`,
          )}
        </p>
      </div>
    </div>
  );
}
