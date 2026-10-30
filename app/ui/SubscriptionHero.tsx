import Link from "next/link";
import { CalendarClock, PackageSearch, RefreshCw, Sparkles, Tv } from "lucide-react";

import a from "@/app/components/account/account.module.css";
import { formatDate, type Lang } from "@/src/lib/i18n";
import { ORDER_STATUS_LABELS } from "@/src/lib/order-status";
import {
  SUBSCRIPTION_STATE_LABELS,
  type AccountState,
} from "@/src/lib/subscription-state";
import type { Order } from "@/src/server/orders";
import type { CustomerSubscription } from "@/src/server/subscriptions";

import { StatusBadge } from "./Badge";
import { ProgressRing } from "./ProgressRing";

export function renewHref(subscription: CustomerSubscription) {
  return `/checkout?renew=${subscription.id}`;
}

/** The dashboard's first block: everything about the account's state and
 * the one action that matters most right now. */
export function SubscriptionHero({
  state,
  subscription,
  openOrder,
  name,
  lang,
}: {
  state: AccountState;
  subscription?: CustomerSubscription;
  openOrder?: Order;
  name: string;
  lang: Lang;
}) {
  const isAr = lang === "ar";
  const firstName = name.split(" ")[0] || name;

  const headline = {
    ACTIVE: isAr ? "اشتراكك نشط" : "Your subscription is active",
    EXPIRING: isAr ? "اشتراكك ينتهي قريبًا" : "Your subscription ends soon",
    EXPIRED: isAr ? "اشتراكك منتهي" : "Your subscription has expired",
    PENDING: isAr ? "طلبك قيد المتابعة" : "Your order is in progress",
    NONE: isAr ? "ابدأ مشاهدتك مع شاشتنا" : "Start watching with Shashtna",
  }[state];

  const showSubscription = subscription && (state !== "PENDING" || !openOrder);
  const tone = state === "EXPIRING" ? "warning" : state === "EXPIRED" ? "danger" : "brand";

  let primary: { href: string; label: string; icon: React.ReactNode };
  let secondary: { href: string; label: string } | null = null;

  if (state === "ACTIVE" && subscription) {
    primary = {
      href: `/subscriptions/${subscription.id}`,
      label: isAr ? "عرض الاشتراك" : "View subscription",
      icon: <Tv size={17} aria-hidden />,
    };
    secondary = { href: renewHref(subscription), label: isAr ? "تجديد" : "Renew" };
  } else if (state === "EXPIRING" && subscription) {
    primary = {
      href: renewHref(subscription),
      label: isAr ? "جدّد الآن" : "Renew now",
      icon: <RefreshCw size={17} aria-hidden />,
    };
    secondary = {
      href: `/subscriptions/${subscription.id}`,
      label: isAr ? "تفاصيل الاشتراك" : "Subscription details",
    };
  } else if (state === "EXPIRED" && subscription) {
    primary = {
      href: renewHref(subscription),
      label: isAr ? "إعادة التفعيل" : "Reactivate",
      icon: <RefreshCw size={17} aria-hidden />,
    };
    secondary = { href: "/plans", label: isAr ? "باقات أخرى" : "Other plans" };
  } else if (state === "PENDING" && openOrder) {
    primary = {
      href: `/orders/${openOrder.id}`,
      label: isAr ? "تتبّع الطلب" : "Track order",
      icon: <PackageSearch size={17} aria-hidden />,
    };
  } else {
    primary = {
      href: "/plans",
      label: isAr ? "اختر باقة" : "Choose a plan",
      icon: <Sparkles size={17} aria-hidden />,
    };
    secondary = { href: "/watch", label: isAr ? "وين تكدر تشاهد" : "Where you can watch" };
  }

  return (
    <section className={`${a.hero} ${state === "EXPIRING" ? a.heroWarn : state === "EXPIRED" ? a.heroDanger : ""}`} data-testid="subscription-hero" data-state={state}>
      <div className={a.heroIn}>
        <div className="min-w-0">
          <p className={a.hello}>{isAr ? `هلا ${firstName} 👋` : `Hi ${firstName} 👋`}</p>
          <h1 className={a.headline}>{headline}</h1>

          {showSubscription && subscription ? (
            <div className={a.facts}>
              <StatusBadge
                status={subscription.state}
                label={isAr ? SUBSCRIPTION_STATE_LABELS[subscription.state].ar : SUBSCRIPTION_STATE_LABELS[subscription.state].en}
              />
              <span className={a.fact} dir="auto">
                {subscription.packageName}
              </span>
              <span className={a.fact}>
                <CalendarClock size={15} aria-hidden />
                {isAr ? "ينتهي في " : "Expires "}
                <span className="nums">{formatDate(subscription.expiryDate, lang)}</span>
              </span>
            </div>
          ) : null}

          {state === "PENDING" && openOrder ? (
            <div className={a.facts}>
              <StatusBadge
                status={openOrder.status}
                label={isAr ? ORDER_STATUS_LABELS[openOrder.status].ar : ORDER_STATUS_LABELS[openOrder.status].en}
              />
              <span className={a.fact} dir="auto">
                {openOrder.serviceName}
              </span>
              <span className={`${a.fact} nums`}>{openOrder.number}</span>
            </div>
          ) : null}

          {state === "NONE" ? (
            <p className={a.heroText}>
              {isAr
                ? "ما عندك اشتراك حاليًا. اختار باقة تناسبك وفريقنا يفعّلها إلك بعد إتمام الطلب."
                : "You don't have a subscription yet. Pick a plan and our team activates it once your order is complete."}
            </p>
          ) : null}

          <div className={a.heroActions}>
            <Link href={primary.href} className={`${a.btn} ${a.btnWhite}`}>
              {primary.icon}
              {primary.label}
            </Link>
            {secondary ? (
              <Link href={secondary.href} className={`${a.btn} ${a.btnGlass}`}>
                {secondary.label}
              </Link>
            ) : null}
          </div>
        </div>

        {showSubscription && subscription && state !== "NONE" ? (
          <div className={a.ring}>
            <ProgressRing value={subscription.remainingFraction} tone={tone} size={148} stroke={10}>
              <span className={`${a.ringValue} nums`}>{subscription.daysRemaining}</span>
              <span className={a.ringLabel}>{isAr ? "يوم متبقي" : "days left"}</span>
            </ProgressRing>
          </div>
        ) : null}
      </div>
    </section>
  );
}
