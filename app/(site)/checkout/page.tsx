import { planOrderPrice } from "@/src/lib/catalogue";
import { discountBadge, orderPricing } from "@/src/lib/discounts";
import { orderPointValue } from "@/src/lib/loyalty";
import { getLoyaltyRules } from "@/src/server/loyalty";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import s from "@/app/components/home/home.module.css";
import { LinkButton } from "@/app/ui/Button";
import { cn } from "@/app/ui/cn";
import { EmptyState } from "@/app/ui/States";
import { getSessionUser, requireCustomer } from "@/src/server/auth";
import { resolveCheckoutSelection, type CheckoutMode } from "@/src/server/checkout-selection";
import { getI18n } from "@/src/server/i18n";

import c from "./checkout.module.css";
import { CheckoutForm } from "./CheckoutForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "تأكيد الطلب",
  robots: { index: false },
};

type Params = { plan?: string; option?: string; device?: string; renew?: string; upgrade?: string; type?: string };

// Stand-in for a visitor without a session. resolveCheckoutSelection only
// reads the user for renewals and upgrades (an existing subscription), and
// visitors are sent to sign in before those, so the id is never used.
const VISITOR = { id: 0, preferredContact: null };

/**
 * Confirms ONE order the customer already chose on the Packages page (or on
 * a device / renewal link). Nothing to pick here except, for VIP plans, the
 * compatible device. Without a valid selection the customer goes back to
 * choose. Payment happens after the order exists, from the account. The
 * selection rules live in resolveCheckoutSelection (shared with the mobile app).
 *
 * Visitors see the same review and total before signing in; confirming
 * sends them to sign in or register and straight back here. Creating the
 * order still requires a session (placeOrderAction → assertCustomer).
 */
export default async function CheckoutPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const query = new URLSearchParams(
    Object.entries(params).filter(([, value]) => typeof value === "string") as [string, string][],
  ).toString();
  const returnTo = `/checkout${query ? `?${query}` : ""}`;

  const sessionUser = await getSessionUser();
  // Renewals and upgrades act on the customer's own subscription: sign in first.
  const user = sessionUser ?? (params.renew || params.upgrade ? await requireCustomer(returnTo) : null);
  const [{ t, lang }, selection] = await Promise.all([getI18n(), resolveCheckoutSelection(user ?? VISITOR, params)]);

  if (!selection.ok && selection.reason === "SUBSCRIPTION_NOT_FOUND") {
    return (
      <div className={`${s.home} -mt-[80px] pt-[80px] pb-16`}>
        <div className={`${s.wrap} py-16`}>
          <EmptyState
          title={t("الاشتراك غير موجود", "Subscription not found")}
          description={t("تأكد من الرابط أو اختار الاشتراك من حسابك.", "Check the link or pick the subscription from your account.")}
          action={<LinkButton href="/subscriptions">{t("اشتراكاتي", "My subscriptions")}</LinkButton>}
          />
        </div>
      </div>
    );
  }

  if (!selection.ok) {
    redirect(selection.choosePath);
  }

  const { mode, plan, option, device, devices: compatibleDevices, initialDeviceId, subscription, contactOptions, initialContact, choosePath } = selection;
  // With several compatible devices, start on the cheapest so the total is
  // known from the first look; the customer can switch. The server prices
  // the order from the chosen device either way.
  const cheapestDevice = compatibleDevices.reduce<(typeof compatibleDevices)[number] | null>(
    (best, item) => (!best || item.price < best.price ? item : best),
    null,
  );
  const initialDevice = initialDeviceId ?? cheapestDevice?.id ?? null;

  const titles: Record<CheckoutMode, [string, string]> = {
    NEW: [t("تأكيد الطلب", "Confirm your order"), t("راجع باقتك وأكّد الطلب.", "Review your plan and confirm the order.")],
    RENEW: [
      t("تأكيد التجديد", "Confirm renewal"),
      subscription
        ? t(`تجديد «${subscription.packageName}». المدة الجديدة تنضاف من تاريخ الانتهاء الحالي إذا الاشتراك بعده نشط.`, `Renewing “${subscription.packageName}”. If it's still active, the new period is added from the current expiry date.`)
        : t("راجع مدة التجديد وأكّد الطلب.", "Review the renewal and confirm."),
    ],
    UPGRADE: [t("تأكيد الترقية", "Confirm upgrade"), t("راجع باقتك الجديدة وأكّد الطلب.", "Review your new plan and confirm the order.")],
    DEVICE_PURCHASE: [t("تأكيد شراء الجهاز", "Confirm device purchase"), t("راجع الجهاز وأكّد الطلب.", "Review the device and confirm the order.")],
  };

  // Back goes to the plan's details with the same length (and the renewal
  // or upgrade), so the choice is kept; "Change" in the form goes to the
  // full plans list.
  const back = new URLSearchParams();
  if (option) back.set("option", String(option.id));
  if (subscription && mode !== "NEW") back.set(mode === "RENEW" ? "renew" : "upgrade", String(subscription.id));
  const backHref =
    plan && mode !== "DEVICE_PURCHASE"
      ? `/plans/${encodeURIComponent(plan.slug)}${back.size ? `?${back.toString()}` : ""}`
      : choosePath;

  const loyalty = plan && plan.serviceType === "IPTV" && mode !== "DEVICE_PURCHASE" ? await getLoyaltyRules() : null;
  // The server's own pricing (createOrder does the same): the active discount on the package part.
  // Without a chosen length the order uses the default (shortest) one, as createOrder does.
  const pricedOption = option ?? plan?.options[0] ?? null;
  const pricing = plan && mode !== "DEVICE_PURCHASE" ? orderPricing(option ?? plan, mode, null, pricedOption?.discount ?? null) : null;
  const orderPoints = loyalty?.enabled && plan && pricing ? orderPointValue(pricing.price, option?.pointsEarned ?? null) : null;

  const steps = [
    t("تأكيد الطلب", "Confirm"),
    t("الدفع", "Payment"),
    mode === "DEVICE_PURCHASE" ? t("التسليم", "Delivery") : t("التفعيل", "Activation"),
  ];

  return (
    // -mt-[80px]/pt-[80px]: the navy ground runs up behind the floating header.
    <div className={`${s.home} -mt-[80px] pt-[80px] pb-32 lg:pb-16`}>
      <div className={s.wrap}>
        <header className={c.head}>
          <Link href={backHref} className={c.back}>
            <ArrowRight size={16} className="ltr:rotate-180" aria-hidden />
            {mode === "DEVICE_PURCHASE" ? t("الأجهزة", "Devices") : t("تفاصيل الباقة", "Plan details")}
          </Link>
          <h1 className={c.title}>{titles[mode][0]}</h1>
          <p className={c.lead}>{titles[mode][1]}</p>
          <ol className={c.steps} aria-label={t("خطوات الطلب", "Order steps")}>
            {steps.map((label, index) => (
              <li key={label} className={cn(c.step, index === 0 && c.stepOn)} aria-current={index === 0 ? "step" : undefined}>
                <b className="nums">{index + 1}</b>
                {label}
              </li>
            ))}
          </ol>
        </header>
        <CheckoutForm
          mode={mode}
          plan={
            plan && mode !== "DEVICE_PURCHASE"
              ? {
                  slug: plan.slug,
                  name: plan.name,
                  serviceType: plan.serviceType,
                  // The chosen length; what this order will cost (renewals use
                  // that length's renewal price when set).
                  optionId: option?.id ?? null,
                  price: pricing?.price ?? planOrderPrice(option ?? plan, mode),
                  listPrice: pricing && pricing.discountIqd > 0 ? pricing.listPrice : null,
                  discountLabel: pricing && pricing.discountIqd > 0 && pricedOption?.discount ? discountBadge(pricedOption.discount, pricing.discountIqd, lang) : null,
                  durationMonths: (option ?? plan).durationMonths,
                  durationLabel: (option ?? plan).durationLabel,
                  description: plan.description,
                  features: plan.features.slice(0, 4),
                  imageUrl: plan.imageUrl,
                  options: plan.options.map((item) => ({ id: item.id, durationMonths: item.durationMonths, price: orderPricing(item, mode, null, item.discount).price })),
                  points: orderPoints,
                }
              : null
          }
          device={device ? { id: device.id, name: device.name, price: device.price, description: device.description, imageUrl: device.imageUrl } : null}
          devices={compatibleDevices.map((item) => ({ id: item.id, name: item.name, price: item.price, description: item.description, imageUrl: item.imageUrl }))}
          initialDevice={initialDevice}
          subscriptionId={subscription?.id ?? null}
          changeHref={choosePath}
          user={user ? { name: user.name, phone: user.phone, email: user.email } : null}
          returnQuery={query}
          contactOptions={contactOptions}
          initialContact={initialContact}
        />
      </div>
    </div>
  );
}
