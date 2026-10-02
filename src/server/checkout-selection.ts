import { getActiveDevices, getActivePackages, type CatalogDevice, type CatalogPackage } from "@/src/server/catalog";
import { getSettings, safeExternalUrl, whatsappLink } from "@/src/server/settings";
import { getSubscriptionForUser, type CustomerSubscription } from "@/src/server/subscriptions";

/**
 * What the checkout confirms for one selection (?plan, ?renew, ?upgrade,
 * ?device), resolved on the server. Shared by the website checkout page and
 * the mobile checkout (/api/mobile/checkout) so both show the same package,
 * device choices and contact channels. This only previews the order:
 * createOrder() re-validates and prices everything from the catalogue.
 */

export type CheckoutMode = "NEW" | "RENEW" | "UPGRADE" | "DEVICE_PURCHASE";
export type ContactOption = "TELEGRAM" | "WHATSAPP" | "FACEBOOK" | "PHONE";

export type CheckoutParams = { plan?: unknown; device?: unknown; renew?: unknown; upgrade?: unknown; type?: unknown };

export type CheckoutSelection =
  | {
      ok: true;
      mode: CheckoutMode;
      plan: CatalogPackage | null;
      /** Fixed device for a device purchase. */
      device: CatalogDevice | null;
      /** Compatible VIP devices to choose from (VIP new/upgrade orders). */
      devices: CatalogDevice[];
      initialDeviceId: number | null;
      subscription: CustomerSubscription | null;
      contactOptions: ContactOption[];
      initialContact: ContactOption;
      /** Where "change plan" (and an invalid selection) sends the customer on the website. */
      choosePath: string;
    }
  | { ok: false; reason: "SUBSCRIPTION_NOT_FOUND" | "CHOOSE_AGAIN"; choosePath: string };

function positive(value: unknown) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

/** The contact channels the site actually offers (Admin → Settings); phone is always available. */
export function contactOptionsFrom(settings: Awaited<ReturnType<typeof getSettings>>): ContactOption[] {
  return [
    safeExternalUrl(settings["contact.telegram"]) ? ("TELEGRAM" as const) : null,
    whatsappLink(settings["contact.whatsapp"]) ? ("WHATSAPP" as const) : null,
    safeExternalUrl(settings["contact.facebook"]) ? ("FACEBOOK" as const) : null,
    "PHONE" as const,
  ].filter((option): option is ContactOption => option !== null);
}

export async function resolveCheckoutSelection(
  user: { id: number; preferredContact: string | null },
  params: CheckoutParams,
): Promise<CheckoutSelection> {
  const [packages, devices, settings] = await Promise.all([getActivePackages(), getActiveDevices(), getSettings()]);

  const renewId = positive(params.renew);
  const upgradeId = positive(params.upgrade);
  const deviceParam = positive(params.device);
  const planSlug = typeof params.plan === "string" ? params.plan : "";
  const subscription = renewId || upgradeId ? await getSubscriptionForUser(user.id, (renewId ?? upgradeId)!) : null;

  let mode: CheckoutMode = "NEW";

  if (renewId) {
    mode = "RENEW";
  } else if (upgradeId) {
    mode = "UPGRADE";
  } else if (deviceParam && !planSlug) {
    mode = "DEVICE_PURCHASE";
  } else if (String(params.type ?? "").toUpperCase() === "RENEW") {
    // Old links: /contact?plan=x&type=RENEW without a subscription.
    mode = "RENEW";
  }

  if ((renewId || upgradeId) && !subscription) {
    return { ok: false, reason: "SUBSCRIPTION_NOT_FOUND", choosePath: "/subscriptions" };
  }

  const choosePath =
    mode === "RENEW" && subscription
      ? `/plans?renew=${subscription.id}`
      : mode === "UPGRADE" && subscription
        ? `/plans?upgrade=${subscription.id}`
        : mode === "DEVICE_PURCHASE"
          ? "/devices"
          : "/plans";

  const requested = planSlug ? packages.find((pkg) => pkg.slug === planSlug) : undefined;
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

  let device: CatalogDevice | null = null;

  if (mode === "DEVICE_PURCHASE") {
    device = devices.find((item) => item.id === deviceParam) ?? null;

    if (!device) {
      return { ok: false, reason: "CHOOSE_AGAIN", choosePath };
    }
  } else if (!plan) {
    return { ok: false, reason: "CHOOSE_AGAIN", choosePath };
  }

  const compatibleDevices =
    mode !== "DEVICE_PURCHASE" && mode !== "RENEW" && plan?.serviceType === "VIP"
      ? devices.filter((item) => item.packageIds.includes(plan.id))
      : [];

  // The customer's saved preference is the default contact channel.
  const contactOptions = contactOptionsFrom(settings);

  return {
    ok: true,
    mode,
    plan: mode === "DEVICE_PURCHASE" ? null : (plan ?? null),
    device,
    devices: compatibleDevices,
    initialDeviceId: compatibleDevices.some((item) => item.id === deviceParam)
      ? deviceParam
      : compatibleDevices.length === 1
        ? compatibleDevices[0].id
        : null,
    subscription,
    contactOptions,
    initialContact: contactOptions.find((option) => option === user.preferredContact) ?? contactOptions[0],
    choosePath,
  };
}
