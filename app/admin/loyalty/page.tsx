import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, ClipboardCheck, Gift, Scale, Settings } from "lucide-react";

import { approveRewardAction, awardMissingAction, rejectRewardAction } from "@/app/admin/loyalty/actions";
import { EmptyLine, SectionCard } from "@/app/components/admin/dashboard/DashboardUI";
import { Forbidden } from "@/app/components/admin/Forbidden";
import { ActionForm } from "@/app/ui/ActionForm";
import { Badge } from "@/app/ui/Badge";
import { LinkButton } from "@/app/ui/Button";
import { Stat } from "@/app/ui/Card";
import { PageHeader } from "@/app/ui/Page";
import { Notice } from "@/app/ui/States";
import { SubmitButton } from "@/app/ui/SubmitButton";
import { formatDateTime } from "@/src/lib/i18n";
import { formatOrderNumber } from "@/src/lib/order-status";
import { db } from "@/src/prisma/db";
import { requireStaffPage } from "@/src/server/auth";
import { getI18n } from "@/src/server/i18n";
import { loyaltyReport, missingAwards, pendingRewardOrders, rewardOption } from "@/src/server/loyalty";
import { isFullAccess } from "@/src/lib/system";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "نقاط شاشتنا" };

function usd(value: number) {
  return `$${value.toFixed(2)}`;
}

/**
 * Admin → Shashtna Points: the finance report (points issued, redeemed,
 * expired, reversed; reward cost; outstanding liability; reconciliation) for
 * the "finance" permission, and the reward approval queue for the owner.
 */
export default async function LoyaltyAdminPage() {
  const { user, allowed } = await requireStaffPage("/admin/loyalty", "finance");

  if (!allowed) {
    return <Forbidden />;
  }

  const isOwner = isFullAccess(user.role);
  const [{ t, lang }, report, queue, missing] = await Promise.all([getI18n(), loyaltyReport(), isOwner ? pendingRewardOrders() : Promise.resolve([]), missingAwards()]);
  const [reward3m, reward6m] = await Promise.all([rewardOption(report.rules, "3m"), rewardOption(report.rules, "6m")]);
  const customers = queue.length ? await db.orm.public.User.where((row) => row.id.in([...new Set(queue.map((order) => order.userId))])).select("id", "name").all() : [];
  const nameOf = new Map(customers.map((customer) => [customer.id, customer.name]));

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("نقاط شاشتنا", "Shashtna Points")}
        description={t("برنامج ولاء لتجديدات IPTV: نقاط على كل طلب مدفوع، تُستبدل بتجديد مجاني.", "IPTV renewal loyalty: points on every paid order, swapped for a free renewal.")}
        actions={
          <LinkButton href="/admin/settings#loyalty" variant="secondary" size="sm">
            <Settings size={15} aria-hidden />
            {t("إعدادات البرنامج", "Program settings")}
          </LinkButton>
        }
      />

      {!report.rules.enabled ? (
        <Notice tone="warning" title={t("البرنامج متوقف", "The program is off")}>
          {t("الزبائن ما يشوفون النقاط وما يكسبون ولا يستبدلون. شغّله من الإعدادات.", "Customers don't see, earn or redeem points. Turn it on in Settings.")}
        </Notice>
      ) : null}
      {!reward3m || !reward6m ? (
        <Notice tone="warning" title={t("مدة المكافأة غير محددة", "Reward length not set")}>
          {t("اختر مدة IPTV فعّالة لمكافأة 3 أشهر و6 أشهر من الإعدادات، وإلا الاستبدال يترفض.", "Pick an active IPTV length for the 3- and 6-month rewards in Settings, or redemptions are refused.")}
        </Notice>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" data-testid="loyalty-report">
        <Stat label={t("نقاط صادرة", "Points issued")} value={report.issued} hint={t(`منها ${report.seeded} هدية إطلاق`, `${report.seeded} as launch gift`)} />
        <Stat label={t("نقاط مستبدلة", "Points redeemed")} value={report.redeemed} hint={t(`${report.rewards.completed} مكافأة مكتملة · ${report.rewards.open} مفتوحة`, `${report.rewards.completed} completed · ${report.rewards.open} open`)} />
        <Stat label={t("منتهية / مسحوبة", "Expired / reversed")} value={`${report.expired} / ${report.reversed}`} />
        <Stat
          label={t("الالتزام المتبقي", "Outstanding liability")}
          value={usd(report.outstanding.liabilityUsd)}
          hint={t(`${report.outstanding.points} نقطة عند ${report.outstanding.accounts} عميل`, `${report.outstanding.points} points across ${report.outstanding.accounts} customers`)}
        />
      </div>
      <p className="text-xs leading-6 text-ink-3">
        {t(
          `تكلفة المكافآت المستبدلة ≈ ${usd(report.rewards.costUsd)} (كل ${report.rules.reward3mPoints} نقطة ≈ 1$ من كلفة المزوّد). طلبات المكافآت ما تنحسب بالإيرادات ولا بعدد المبيعات.`,
          `Redeemed rewards cost ≈ ${usd(report.rewards.costUsd)} (every ${report.rules.reward3mPoints} points ≈ $1 of supplier cost). Reward orders are left out of revenue and sales counts.`,
        )}
      </p>

      {isOwner ? (
        <SectionCard title={t("طلبات المكافآت بانتظار موافقتك", "Reward orders awaiting your approval")} icon={<ClipboardCheck size={14} aria-hidden />} testId="loyalty-queue">
          {queue.length ? (
            <ul className="divide-y divide-line/70">
              {queue.map((order) => (
                <li key={order.id} className="flex flex-wrap items-center gap-3 py-3" data-testid="loyalty-queue-item" data-order-id={order.id}>
                  <div className="min-w-0 flex-1">
                    <Link href={`/admin/orders/${order.id}`} className="nums text-sm font-bold text-ink hover:underline">
                      {formatOrderNumber(order.id)}
                    </Link>
                    <p className="text-xs text-ink-3">
                      <Link href={`/admin/customers/${order.userId}`} className="hover:underline">
                        {nameOf.get(order.userId) ?? `#${order.userId}`}
                      </Link>
                      {" · "}
                      {order.serviceName} · {order.durationLabel}
                      {" · "}
                      <span className="nums">{formatDateTime(String(order.createdAt), lang)}</span>
                    </p>
                  </div>
                  <ActionForm action={approveRewardAction}>
                    <input type="hidden" name="orderId" value={order.id} />
                    <SubmitButton size="sm" pendingLabel={t("جاري…", "Saving…")}>
                      <CheckCircle2 size={15} aria-hidden />
                      {t("موافقة", "Approve")}
                    </SubmitButton>
                  </ActionForm>
                  <ActionForm action={rejectRewardAction}>
                    <input type="hidden" name="orderId" value={order.id} />
                    <SubmitButton size="sm" variant="danger" pendingLabel={t("جاري…", "Saving…")}>
                      {t("رفض وإرجاع النقاط", "Reject & return points")}
                    </SubmitButton>
                  </ActionForm>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyLine>{t("ماكو طلبات مكافآت تنتظر.", "No reward orders waiting.")}</EmptyLine>
          )}
          <p className="mt-3 text-xs leading-6 text-ink-3">
            {t("بعد الموافقة، فعّل الطلب من صفحة التفعيل كتجديد عادي (السعر 0 ونفس المدة).", "After approval, activate it from Activations like any renewal (price 0, same length).")}
          </p>
        </SectionCard>
      ) : null}

      <SectionCard title={t("مطابقة الأرصدة", "Balance reconciliation")} icon={<Scale size={14} aria-hidden />} testId="loyalty-reconciliation">
        {report.mismatches.length ? (
          <ul className="space-y-2">
            {report.mismatches.map((row) => (
              <li key={row.userId} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <Link href={`/admin/customers/${row.userId}`} className="font-semibold text-ink hover:underline">
                  {t("عميل", "Customer")} #{row.userId}
                </Link>
                <Badge tone="danger">
                  <span className="nums">
                    {t("الرصيد", "Balance")} {row.balance} ≠ {t("السجل", "Ledger")} {row.ledger}
                  </span>
                </Badge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="flex items-center gap-2 text-sm text-success">
            <Gift size={15} aria-hidden />
            {t("كل الأرصدة تطابق سجل النقاط.", "Every balance matches the points ledger.")}
          </p>
        )}

        <div className="mt-4 border-t border-line pt-4" data-testid="loyalty-missing">
          {missing.length ? (
            <>
              <p className="text-sm font-semibold text-warning">
                {t(`${missing.length} طلب مكتمل ما أخذ نقاطه`, `${missing.length} completed orders have no points`)}
              </p>
              <p className="nums mt-1 text-xs leading-6 text-ink-3">
                {missing.slice(0, 20).map((order) => formatOrderNumber(order.id)).join("، ")}
                {missing.length > 20 ? " …" : ""}
              </p>
              {isOwner ? (
                <ActionForm action={awardMissingAction} className="mt-3">
                  <SubmitButton size="sm" pendingLabel={t("جاري…", "Working…")}>
                    {t("احتساب النقاط الناقصة", "Award missing points")}
                  </SubmitButton>
                </ActionForm>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-ink-3">{t("كل الطلبات المؤهلة أخذت نقاطها.", "Every eligible order has its points.")}</p>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
