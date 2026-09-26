import { resolveCheckout } from "@/src/server/checkout";
import { absoluteUrl } from "@/src/server/mobile";
import { fail, ok, withMobileUser } from "@/src/server/mobile-api";

export const dynamic = "force-dynamic";

/**
 * The order confirmation for ONE selected package (or device), resolved by
 * the same service as the website checkout: ?plan=slug, ?renew=subId,
 * ?upgrade=subId&plan=slug, or ?device=id for a device purchase.
 */
export const GET = withMobileUser(async ({ request, user }) => {
  const url = new URL(request.url);
  const resolved = await resolveCheckout(user, {
    plan: url.searchParams.get("plan") ?? undefined,
    device: url.searchParams.get("device") ?? undefined,
    renew: url.searchParams.get("renew") ?? undefined,
    upgrade: url.searchParams.get("upgrade") ?? undefined,
  });

  if (!resolved.ok) {
    return resolved.reason === "SUBSCRIPTION_NOT_FOUND"
      ? fail(404, "SUBSCRIPTION_NOT_FOUND", "الاشتراك غير موجود.")
      : fail(404, "UNAVAILABLE", "هذه الباقة أو الجهاز غير متاح حاليًا. اختار من المتاح.");
  }

  const shapeDevice = (device: NonNullable<typeof resolved.device>) => ({
    id: device.id,
    name: device.name,
    price: device.price,
    description: device.description,
    imageUrl: absoluteUrl(request, device.imageUrl),
  });

  return ok({
    mode: resolved.mode,
    customer: { name: user.name, phone: user.phone },
    plan: resolved.plan
      ? {
          slug: resolved.plan.slug,
          name: resolved.plan.name,
          serviceType: resolved.plan.serviceType,
          price: resolved.plan.price,
          durationLabel: resolved.plan.durationLabel,
          description: resolved.plan.description,
          features: resolved.plan.features.slice(0, 4),
          imageUrl: absoluteUrl(request, resolved.plan.imageUrl),
        }
      : null,
    device: resolved.device ? shapeDevice(resolved.device) : null,
    devices: resolved.devices.map(shapeDevice),
    initialDeviceId: resolved.initialDeviceId,
    subscription: resolved.subscription ? { id: resolved.subscription.id, packageName: resolved.subscription.packageName } : null,
    contactOptions: resolved.contactOptions,
    initialContact: resolved.initialContact,
  });
});
