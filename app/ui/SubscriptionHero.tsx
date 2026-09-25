import { CalendarClock, PackageSearch, RefreshCw, Sparkles, Tv } from "lucide-react";

import { formatDate, type Lang } from "@/src/lib/i18n";
import { ORDER_STATUS_LABELS } from "@/src/lib/order-status";
import {
  SUBSCRIPTION_STATE_LABELS,
  type AccountState,
} from "@/src/lib/subscription-state";
import type { Order } from "@/src/server/orders";
import type { CustomerSubscription } from "@/src/server/subscriptions";

import { StatusBadge } from "./Badge";
import { LinkButton } from "./Button";
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
    <section className="surface-raised relative overflow-hidden rounded-panel p-6 sm:p-8">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 end-0 h-64 w-2/3 bg-[radial-gradient(closest-side,rgba(47,107,255,0.25),transparent)]"
      />
      <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm text-ink-3">
            {isAr ? `هلا ${firstName} 👋` : `Hi ${firstName} 👋`}
          </p>
          <h1 className="mt-2 text-2xl font-bold text-ink sm:text-3xl">{headline}</h1>

          {showSubscription && subscription ? (
            <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-ink-2">
              <StatusBadge
                status={subscription.state}
                label={isAr ? SUBSCRIPTION_STATE_LABELS[subscription.state].ar : SUBSCRIPTION_STATE_LABELS[subscription.state].en}
              />
              <span className="font-semibold text-ink">{subscription.packageName}</span>
              <span className="text-ink-3">·</span>
              <span className="inline-flex items-center gap-1.5">
                <CalendarClock size={15} aria-hidden className="text-ink-3" />
                {isAr ? "ينتهي في " : "Expires "}
                <span className="nums">{formatDate(subscription.expiryDate, lang)}</span>
              </span>
            </div>
          ) : null}

          {state === "PENDING" && openOrder ? (
            <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-ink-2">
              <StatusBadge
                status={openOrder.status}
                label={isAr ? ORDER_STATUS_LABELS[openOrder.status].ar : ORDER_STATUS_LABELS[openOrder.status].en}
              />
              <span className="font-semibold text-ink">{openOrder.serviceName}</span>
              <span className="nums text-ink-3">{openOrder.number}</span>
            </div>
          ) : null}

          {state === "NONE" ? (
            <p className="mt-3 max-w-lg text-sm leading-7 text-ink-2">
              {isAr
                ? "ما عندك اشتراك حاليًا. اختار باقة تناسبك وفريقنا يفعّلها إلك بعد إتمام الطلب."
                : "You don't have a subscription yet. Pick a plan and our team activates it once your order is complete."}
            </p>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-2">
            <LinkButton href={primary.href} size="lg">
              {primary.icon}
              {primary.label}
            </LinkButton>
            {secondary ? (
              <LinkButton href={secondary.href} variant="secondary" size="lg">
                {secondary.label}
              </LinkButton>
            ) : null}
          </div>
        </div>

        {showSubscription && subscription && state !== "NONE" ? (
          <ProgressRing value={subscription.remainingFraction} tone={tone} size={128}>
            <span className="nums text-3xl font-bold text-ink">{subscription.daysRemaining}</span>
            <span className="text-xs text-ink-3">{isAr ? "يوم متبقي" : "days left"}</span>
          </ProgressRing>
        ) : null}
      </div>
    </section>
  );
}
