import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { LinkButton } from "@/app/ui/Button";
import { Container, PageHeader } from "@/app/ui/Page";
import { EmptyState } from "@/app/ui/States";
import { requireCustomer } from "@/src/server/auth";
import { getActiveDevices, getActivePackages } from "@/src/server/catalog";
import { getI18n } from "@/src/server/i18n";
import { getSettings, safeExternalUrl, whatsappLink } from "@/src/server/settings";
import { getSubscriptionForUser } from "@/src/server/subscriptions";

import { CheckoutForm, type CheckoutMode, type ContactOption } from "./CheckoutForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "تأكيد الطلب",
  robots: { index: false },
};

type Params = { plan?: string; device?: string; renew?: string; upgrade?: string; type?: string };

function positive(value: unknown) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

/**
 * Confirms ONE order the customer already chose on the Packages page (or on
 * a device / renewal link). Nothing to pick here except, for VIP plans, the
 * compatible device. Without a valid selection the customer goes back to
 * choose. Payment happens after the order exists, from the account.
 */
export default async function CheckoutPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const query = new URLSearchParams(
    Object.entries(params).filter(([, value]) => typeof value === "string") as [string, string][],
  ).toString();

  // Visitors without a session sign in (or register) and come straight back
  // here with the same selection.
  const user = await requireCustomer(`/checkout${query ? `?${query}` : ""}`);
  const [{ t }, packages, devices, settings] = await Promise.all([getI18n(), getActivePackages(), getActiveDevices(), getSettings()]);

  const renewId = positive(params.renew);
  const upgradeId = positive(params.upgrade);
  const deviceParam = positive(params.device);
  const subscription = renewId || upgradeId ? await getSubscriptionForUser(user.id, (renewId ?? upgradeId)!) : null;

  let mode: CheckoutMode = "NEW";

  if (renewId) {
    mode = "RENEW";
  } else if (upgradeId) {
    mode = "UPGRADE";
  } else if (deviceParam && !params.plan) {
    mode = "DEVICE_PURCHASE";
  } else if (String(params.type ?? "").toUpperCase() === "RENEW") {
    // Old links: /contact?plan=x&type=RENEW without a subscription.
    mode = "RENEW";
  }

  if ((renewId || upgradeId) && !subscription) {
    return (
      <Container className="py-16">
        <EmptyState
          title={t("الاشتراك غير موجود", "Subscription not found")}
          description={t("تأكد من الرابط أو اختار الاشتراك من حسابك.", "Check the link or pick the subscription from your account.")}
          action={<LinkButton href="/subscriptions">{t("اشتراكاتي", "My subscriptions")}</LinkButton>}
        />
      </Container>
    );
  }

  // Where "change plan" (and a missing/invalid selection) sends the customer.
  const choosePath =
    mode === "RENEW" && subscription
      ? `/plans?renew=${subscription.id}`
      : mode === "UPGRADE" && subscription
        ? `/plans?upgrade=${subscription.id}`
        : mode === "DEVICE_PURCHASE"
          ? "/devices"
          : "/plans";

  const requested = params.plan ? packages.find((pkg) => pkg.slug === params.plan) : undefined;
  let plan = requested;

  if (mode === "RENEW") {
    // Renewals stay on the same service; default to the current package.
    plan =
      requested && (!subscription || requested.serviceType === subscription.serviceType)
        ? requested
        : subscription?.packageSlug
          ? packages.find((pkg) => pkg.slug === subscription.packageSlug)
          : undefined;
  } else if (mode === "UPGRADE") {
    plan = requested && requested.id !== subscription?.packageId ? requested : undefined;
  }

  let device = null as (typeof devices)[number] | null;

  if (mode === "DEVICE_PURCHASE") {
    device = devices.find((item) => item.id === deviceParam) ?? null;

    if (!device) {
      redirect(choosePath);
    }
  } else if (!plan) {
    redirect(choosePath);
  }

  const compatibleDevices =
    mode !== "DEVICE_PURCHASE" && mode !== "RENEW" && plan?.serviceType === "VIP"
      ? devices.filter((item) => item.packageIds.includes(plan.id))
      : [];

  // The contact channels the site actually offers (same rules as before the
  // payment change); the customer's saved preference is the default.
  const contactOptions = [
    safeExternalUrl(settings["contact.telegram"]) ? ("TELEGRAM" as const) : null,
    whatsappLink(settings["contact.whatsapp"]) ? ("WHATSAPP" as const) : null,
    safeExternalUrl(settings["contact.facebook"]) ? ("FACEBOOK" as const) : null,
    "PHONE" as const,
  ].filter((option): option is ContactOption => option !== null);
  const initialContact = contactOptions.find((option) => option === user.preferredContact) ?? contactOptions[0];

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

  return (
    <Container className="pb-32 pt-8 sm:pt-12 lg:pb-16">
      <LinkButton href={choosePath} variant="ghost" size="sm" className="-ms-3">
        <ArrowRight size={16} className="ltr:rotate-180" aria-hidden />
        {mode === "DEVICE_PURCHASE" ? t("الأجهزة", "Devices") : t("الباقات", "Plans")}
      </LinkButton>
      <PageHeader className="mt-4" title={titles[mode][0]} description={titles[mode][1]} />
      <div className="mt-8">
        <CheckoutForm
          mode={mode}
          plan={
            plan && mode !== "DEVICE_PURCHASE"
              ? {
                  slug: plan.slug,
                  name: plan.name,
                  serviceType: plan.serviceType,
                  price: plan.price,
                  durationLabel: plan.durationLabel,
                  description: plan.description,
                  features: plan.features.slice(0, 4),
                  imageUrl: plan.imageUrl,
                }
              : null
          }
          device={device ? { id: device.id, name: device.name, price: device.price, description: device.description } : null}
          devices={compatibleDevices.map((item) => ({ id: item.id, name: item.name, price: item.price, description: item.description }))}
          initialDevice={compatibleDevices.some((item) => item.id === deviceParam) ? deviceParam : compatibleDevices.length === 1 ? compatibleDevices[0].id : null}
          subscriptionId={subscription?.id ?? null}
          changeHref={choosePath}
          user={{ name: user.name, phone: user.phone, email: user.email }}
          contactOptions={contactOptions}
          initialContact={initialContact}
        />
      </div>
    </Container>
  );
}
