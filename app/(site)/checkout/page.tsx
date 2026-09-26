import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { LinkButton } from "@/app/ui/Button";
import { Container, PageHeader } from "@/app/ui/Page";
import { EmptyState } from "@/app/ui/States";
import { requireCustomer } from "@/src/server/auth";
import { resolveCheckout, type CheckoutMode } from "@/src/server/checkout";
import { getI18n } from "@/src/server/i18n";

import { CheckoutForm } from "./CheckoutForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "تأكيد الطلب",
  robots: { index: false },
};

type Params = { plan?: string; device?: string; renew?: string; upgrade?: string; type?: string };

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
  const [{ t }, resolved] = await Promise.all([getI18n(), resolveCheckout(user, params)]);

  if (!resolved.ok && resolved.reason === "SUBSCRIPTION_NOT_FOUND") {
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

  if (!resolved.ok) {
    redirect(resolved.choosePath);
  }

  const { mode, plan, device, devices: compatibleDevices, subscription, contactOptions, initialContact, choosePath } = resolved;

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
          initialDevice={resolved.initialDeviceId}
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
