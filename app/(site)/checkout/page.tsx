import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";

import { LinkButton } from "@/app/ui/Button";
import { Container, PageHeader } from "@/app/ui/Page";
import { EmptyState } from "@/app/ui/States";
import { requireCustomer } from "@/src/server/auth";
import { getActiveDevices, getActivePackages } from "@/src/server/catalog";
import { getI18n } from "@/src/server/i18n";
import { getSettings, manualTransferDetails, safeExternalUrl, whatsappLink } from "@/src/server/settings";
import { getSubscriptionForUser } from "@/src/server/subscriptions";

import { CheckoutForm, type CheckoutMode } from "./CheckoutForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "إتمام الطلب",
  robots: { index: false },
};

type Params = { plan?: string; device?: string; renew?: string; upgrade?: string; type?: string };

function positive(value: unknown) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const query = new URLSearchParams(
    Object.entries(params).filter(([, value]) => typeof value === "string") as [string, string][],
  ).toString();

  // Visitors without a session sign in (or register) and come straight back
  // here with the same selection.
  const user = await requireCustomer(`/checkout${query ? `?${query}` : ""}`);
  const [{ t }, packages, devices, settings] = await Promise.all([
    getI18n(),
    getActivePackages(),
    getActiveDevices(),
    getSettings(),
  ]);

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

  let plans = packages;

  if (mode === "RENEW") {
    const serviceType = subscription?.serviceType ?? packages.find((pkg) => pkg.slug === params.plan)?.serviceType;
    plans = serviceType ? packages.filter((pkg) => pkg.serviceType === serviceType) : packages;
  } else if (mode === "UPGRADE" && subscription) {
    plans = packages.filter((pkg) => pkg.id !== subscription.packageId);
  }

  const initialPlan =
    (params.plan && plans.some((pkg) => pkg.slug === params.plan) ? params.plan : null) ??
    (mode === "RENEW" && subscription?.packageSlug && plans.some((pkg) => pkg.slug === subscription.packageSlug)
      ? subscription.packageSlug
      : null) ??
    (plans.length === 1 ? plans[0].slug : null);

  const contactOptions = [
    safeExternalUrl(settings["contact.telegram"]) ? ("TELEGRAM" as const) : null,
    whatsappLink(settings["contact.whatsapp"]) ? ("WHATSAPP" as const) : null,
    safeExternalUrl(settings["contact.facebook"]) ? ("FACEBOOK" as const) : null,
    "PHONE" as const,
  ].filter((option): option is "TELEGRAM" | "WHATSAPP" | "FACEBOOK" | "PHONE" => option !== null);

  const titles: Record<CheckoutMode, [string, string]> = {
    NEW: [t("إتمام الطلب", "Checkout"), t("اختار باقتك، حوّل المبلغ، وارفع صورة إثبات الدفع.", "Choose your plan, transfer the amount, and upload the payment proof.")],
    RENEW: [
      t("تجديد الاشتراك", "Renew subscription"),
      subscription
        ? t(`تجديد «${subscription.packageName}». المدة الجديدة تنضاف من تاريخ الانتهاء الحالي إذا الاشتراك بعده نشط.`, `Renewing “${subscription.packageName}”. If it's still active, the new period is added from the current expiry date.`)
        : t("اختار مدة التجديد.", "Choose the renewal period."),
    ],
    UPGRADE: [t("ترقية الاشتراك", "Upgrade subscription"), t("اختار الباقة الجديدة وفريقنا يرتب الانتقال.", "Choose the new plan and our team handles the switch.")],
    DEVICE_PURCHASE: [t("شراء جهاز VIP", "Buy a VIP device"), t("اطلب الجهاز لوحده.", "Order the device on its own.")],
  };

  return (
    <Container className="pb-32 pt-8 sm:pt-12 lg:pb-16">
      <LinkButton href={mode === "RENEW" || mode === "UPGRADE" ? "/subscriptions" : "/plans"} variant="ghost" size="sm" className="-ms-3">
        <ArrowRight size={16} className="ltr:rotate-180" aria-hidden />
        {mode === "RENEW" || mode === "UPGRADE" ? t("اشتراكاتي", "My subscriptions") : t("الباقات", "Plans")}
      </LinkButton>
      <PageHeader className="mt-4" title={titles[mode][0]} description={titles[mode][1]} />
      <div className="mt-8">
        {mode !== "DEVICE_PURCHASE" && packages.length === 0 ? (
          <EmptyState title={t("ماكو باقات متاحة حاليًا", "No plans are available right now")} action={<LinkButton href="/help/contact">{t("تواصل ويانا", "Contact us")}</LinkButton>} />
        ) : (
          <CheckoutForm
            mode={mode}
            plans={plans.map((pkg) => ({
              slug: pkg.slug,
              id: pkg.id,
              name: pkg.name,
              serviceType: pkg.serviceType,
              price: pkg.price,
              durationLabel: pkg.durationLabel,
              isPopular: pkg.isPopular,
            }))}
            devices={devices.map((device) => ({
              id: device.id,
              name: device.name,
              price: device.price,
              description: device.description,
              packageIds: device.packageIds,
            }))}
            initialPlan={initialPlan}
            initialDevice={deviceParam}
            subscriptionId={subscription?.id ?? null}
            user={{ name: user.name, phone: user.phone }}
            contactOptions={contactOptions}
            transfer={manualTransferDetails(settings)}
          />
        )}
      </div>
    </Container>
  );
}
