import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AppWindow,
  ArrowRight,
  ArrowUpCircle,
  KeyRound,
  LifeBuoy,
  MessageSquarePlus,
  MonitorSmartphone,
  PackageSearch,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";

import { Badge, StatusBadge } from "@/app/ui/Badge";
import { LinkButton } from "@/app/ui/Button";
import { Card, CardHeader } from "@/app/ui/Card";
import { CopyButton, SecretValue } from "@/app/ui/CopyButton";
import { ProgressRing } from "@/app/ui/ProgressRing";
import { formatDate, formatDateTime, formatPrice } from "@/src/lib/i18n";
import { ORDER_STATUS_LABELS, isOpen } from "@/src/lib/order-status";
import { SUBSCRIPTION_STATE_LABELS } from "@/src/lib/subscription-state";
import { listEntityActivity } from "@/src/server/activity";
import { requireCustomer } from "@/src/server/auth";
import { getActiveApps, getActivePackages } from "@/src/server/catalog";
import { getI18n } from "@/src/server/i18n";
import { listOrdersForUser } from "@/src/server/orders";
import { getSubscriptionForUser, listReceiptsForUser } from "@/src/server/subscriptions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "تفاصيل الاشتراك" };

export default async function SubscriptionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireCustomer(`/subscriptions/${id}`);
  const subscriptionId = Number(id);
  const subscription = Number.isInteger(subscriptionId) ? await getSubscriptionForUser(user.id, subscriptionId) : null;

  if (!subscription) {
    notFound();
  }

  const [{ t, lang }, events, receipts, orders, apps, packages] = await Promise.all([
    getI18n(),
    listEntityActivity("SUBSCRIPTION", subscription.id, { customerVisibleOnly: true }).catch(() => []),
    listReceiptsForUser(user.id),
    listOrdersForUser(user.id),
    getActiveApps().catch(() => []),
    getActivePackages().catch(() => []),
  ]);

  const subscriptionReceipts = receipts.filter((receipt) => receipt.subscriptionId === subscription.id);
  const pendingOrder = orders.find((order) => order.subscriptionId === subscription.id && isOpen(order.status));
  const canUpgrade = packages.some((pkg) => pkg.id !== subscription.packageId);
  const expired = subscription.state === "EXPIRED" || subscription.state === "SUSPENDED";
  const ringTone = expired ? "danger" : subscription.state === "EXPIRING" ? "warning" : "brand";
  const isVip = subscription.serviceType === "VIP";
  const copyLabels = {
    showLabel: t("إظهار", "Show"),
    hideLabel: t("إخفاء", "Hide"),
    copyLabel: t("نسخ", "Copy"),
    copiedLabel: t("تم النسخ", "Copied"),
  };

  return (
    <div className="space-y-6">
      <LinkButton href="/subscriptions" variant="ghost" size="sm" className="-ms-3">
        <ArrowRight size={16} className="ltr:rotate-180" aria-hidden />
        {t("اشتراكاتي", "My subscriptions")}
      </LinkButton>

      <section className="surface-raised rounded-panel p-6 sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={isVip ? "glow" : "brand"}>{subscription.serviceType}</Badge>
              <StatusBadge status={subscription.state} label={SUBSCRIPTION_STATE_LABELS[subscription.state][lang]} />
            </div>
            <h1 className="mt-3 text-2xl font-bold text-ink sm:text-3xl">{subscription.packageName}</h1>
            <dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:max-w-sm">
              <div>
                <dt className="text-xs text-ink-3">{t("البداية", "Started")}</dt>
                <dd className="nums mt-1 font-semibold text-ink">{formatDate(subscription.startDate, lang)}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-3">{t("الانتهاء", "Expires")}</dt>
                <dd className="nums mt-1 font-semibold text-ink">{formatDate(subscription.expiryDate, lang)}</dd>
              </div>
            </dl>
            <div className="mt-6 flex flex-wrap gap-2">
              <LinkButton href={`/checkout?renew=${subscription.id}`} size="lg" variant={subscription.state === "ACTIVE" ? "secondary" : "primary"}>
                <RefreshCw size={17} aria-hidden />
                {expired ? t("إعادة التفعيل", "Reactivate") : subscription.state === "EXPIRING" ? t("جدّد الآن", "Renew now") : t("تجديد", "Renew")}
              </LinkButton>
              {canUpgrade ? (
                <LinkButton href={`/checkout?upgrade=${subscription.id}`} size="lg" variant="ghost">
                  <ArrowUpCircle size={17} aria-hidden />
                  {t("ترقية", "Upgrade")}
                </LinkButton>
              ) : null}
            </div>
          </div>
          <ProgressRing value={subscription.remainingFraction} tone={ringTone} size={136}>
            <span className="nums text-3xl font-bold text-ink">{subscription.daysRemaining}</span>
            <span className="text-xs text-ink-3">{t("يوم متبقي", "days left")}</span>
          </ProgressRing>
        </div>
      </section>

      {pendingOrder ? (
        <Link href={`/orders/${pendingOrder.id}`} className="surface flex items-center justify-between gap-3 rounded-card p-4 transition hover:border-brand/50">
          <span className="flex items-center gap-3 text-sm">
            <PackageSearch size={18} className="text-glow" aria-hidden />
            <span>
              <span className="font-bold text-ink">{t("طلب قيد المتابعة لهذا الاشتراك", "Order in progress for this subscription")}</span>
              <span className="nums block text-xs text-ink-3">
                {pendingOrder.number} · {ORDER_STATUS_LABELS[pendingOrder.status][lang]}
              </span>
            </span>
          </span>
          <span className="text-sm font-semibold text-brand-ink">{t("تتبّع", "Track")}</span>
        </Link>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <CardHeader
            icon={<KeyRound size={19} aria-hidden />}
            title={isVip ? t("بيانات الجهاز", "Device details") : t("بيانات الدخول", "Login details")}
            description={t("لا تشارك هاي البيانات ويا أي شخص.", "Don't share these details with anyone.")}
          />
          <dl className="mt-5 divide-y divide-line">
            {isVip ? (
              subscription.deviceId ? (
                <div className="flex items-center justify-between gap-3 py-3">
                  <dt className="text-sm text-ink-3">Device ID</dt>
                  <dd className="flex items-center gap-1">
                    <span className="nums font-mono text-sm text-ink" dir="ltr">{subscription.deviceId}</span>
                    <CopyButton value={subscription.deviceId} label={copyLabels.copyLabel} copiedLabel={copyLabels.copiedLabel} />
                  </dd>
                </div>
              ) : null
            ) : (
              <>
                {subscription.username ? (
                  <div className="flex items-center justify-between gap-3 py-3">
                    <dt className="text-sm text-ink-3">{t("اسم المستخدم", "Username")}</dt>
                    <dd className="flex min-w-0 items-center gap-1">
                      <span className="nums truncate font-mono text-sm text-ink" dir="ltr">{subscription.username}</span>
                      <CopyButton value={subscription.username} label={copyLabels.copyLabel} copiedLabel={copyLabels.copiedLabel} />
                    </dd>
                  </div>
                ) : null}
                {subscription.password ? (
                  <div className="flex items-center justify-between gap-3 py-3">
                    <dt className="text-sm text-ink-3">{t("كلمة المرور", "Password")}</dt>
                    <dd className="min-w-0">
                      <SecretValue value={subscription.password} {...copyLabels} />
                    </dd>
                  </div>
                ) : null}
                {subscription.macAddress ? (
                  <div className="flex items-center justify-between gap-3 py-3">
                    <dt className="text-sm text-ink-3">MAC</dt>
                    <dd className="nums font-mono text-sm text-ink" dir="ltr">{subscription.macAddress}</dd>
                  </div>
                ) : null}
              </>
            )}
            <div className="flex items-center justify-between gap-3 py-3">
              <dt className="text-sm text-ink-3">{t("عدد الاتصالات المسموحة", "Allowed connections")}</dt>
              <dd className="nums text-sm font-semibold text-ink">{subscription.maxConnections}</dd>
            </div>
          </dl>
          {!subscription.username && !subscription.deviceId ? (
            <p className="mt-3 text-sm text-ink-3">{t("البيانات راح تظهر هنا بعد ما يجهزها فريقنا.", "Details will appear here once our team adds them.")}</p>
          ) : null}
          {expired ? (
            <p className="mt-4 flex items-start gap-2 rounded-xl bg-danger/10 p-3 text-xs leading-6 text-danger">
              <ShieldAlert size={15} className="mt-0.5 shrink-0" aria-hidden />
              {t("الاشتراك منتهي، فالبيانات ما راح تشتغل لحد التجديد.", "The subscription has expired, so these details won't work until you renew.")}
            </p>
          ) : null}
        </Card>

        <Card className="p-6">
          <CardHeader
            icon={<AppWindow size={19} aria-hidden />}
            title={t("شاهد على جهازك", "Watch on your device")}
            description={t("التطبيقات المقترحة لاشتراكك.", "Recommended apps for your subscription.")}
          />
          <ul className="mt-5 space-y-2">
            {apps.slice(0, 3).map((app) => (
              <li key={app.id}>
                <Link href={`/apps#app-${app.slug}`} className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface-2 px-4 py-3 transition hover:border-brand/50">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-ink">{app.name}</span>
                    <span className="block text-xs text-ink-3">{app.platform}</span>
                  </span>
                  {app.isPlayer ? <Badge tone="glow">{t("الرسمي", "Official")}</Badge> : null}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-dashed border-line-strong p-4">
            <MonitorSmartphone size={18} className="mt-0.5 shrink-0 text-ink-3" aria-hidden />
            <p className="text-xs leading-6 text-ink-3">
              {t(
                "ربط الأجهزة بالحساب وعرض الأجهزة المتصلة — قريبًا. حاليًا ماكو ربط أجهزة من الموقع.",
                "Linking devices to your account and seeing connected devices is coming soon. Device linking isn't available on the website yet.",
              )}
            </p>
          </div>
        </Card>

        <Card className="p-6">
          <CardHeader title={t("سجل الاشتراك", "Subscription history")} />
          {events.length ? (
            <ol className="mt-4 space-y-3">
              {events.map((event) => (
                <li key={event.id} className="flex items-start gap-3 text-sm">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-glow" aria-hidden />
                  <span className="flex-1 text-ink-2">{event.summary}</span>
                  <span className="nums shrink-0 text-xs text-ink-3">{formatDateTime(event.createdAt, lang)}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-4 text-sm text-ink-3">
              {t("التجديدات والتحديثات الجاية راح تنسجل هنا.", "Future renewals and updates will be recorded here.")}
            </p>
          )}
          {subscriptionReceipts.length ? (
            <div className="mt-6 border-t border-line pt-4">
              <p className="text-xs font-semibold text-ink-3">{t("الإيصالات", "Receipts")}</p>
              <ul className="mt-2 space-y-2">
                {subscriptionReceipts.map((receipt) => (
                  <li key={receipt.id}>
                    <Link href={`/receipts/${receipt.id}`} className="flex items-center justify-between gap-3 text-sm hover:text-ink">
                      <span className="nums text-ink-2" dir="ltr">{receipt.receiptNumber}</span>
                      <span className="nums font-semibold text-ink">{formatPrice(receipt.price, lang)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Card>

        <Card className="p-6">
          <CardHeader icon={<LifeBuoy size={19} aria-hidden />} title={t("مشكلة بالاشتراك؟", "Problem with this subscription?")} />
          <p className="mt-3 text-sm leading-7 text-ink-2">
            {t("افتح تذكرة من هنا وتنربط تلقائيًا بهذا الاشتراك.", "Open a ticket from here and it's linked to this subscription automatically.")}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <LinkButton href={`/support/new?category=subscription&subscriptionId=${subscription.id}`} variant="secondary" size="sm">
              <MessageSquarePlus size={15} aria-hidden />
              {t("افتح تذكرة", "Open a ticket")}
            </LinkButton>
            <LinkButton href="/help/troubleshooting" variant="ghost" size="sm">
              {t("حل المشاكل", "Troubleshooting")}
            </LinkButton>
          </div>
        </Card>
      </div>
    </div>
  );
}
