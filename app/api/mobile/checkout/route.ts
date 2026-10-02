import { resolveCheckoutSelection } from "@/src/server/checkout-selection";
import { fail, ok, withMobileUser } from "@/src/server/mobile/http";
import { absoluteUrl } from "@/src/server/mobile/shape";

export const dynamic = "force-dynamic";

/**
 * The order confirmation for ONE selection (?plan=slug, ?renew=subId,
 * ?upgrade=subId&plan=slug or ?device=id), resolved by the same function as
 * the website checkout page. A preview only: the order itself is priced and
 * validated again by createOrder (POST /api/mobile/orders).
 */
export const GET = withMobileUser(async ({ request, user }) => {
  const url = new URL(request.url);
  const selection = await resolveCheckoutSelection(user, {
    plan: url.searchParams.get("plan") ?? undefined,
    device: url.searchParams.get("device") ?? undefined,
    renew: url.searchParams.get("renew") ?? undefined,
    upgrade: url.searchParams.get("upgrade") ?? undefined,
  });

  if (!selection.ok) {
    return selection.reason === "SUBSCRIPTION_NOT_FOUND"
      ? fail(404, "SUBSCRIPTION_NOT_FOUND", "الاشتراك غير موجود.")
      : fail(404, "UNAVAILABLE", "هذه الباقة أو الجهاز غير متاح حاليًا. اختار من المتاح.");
  }

  const shapeDevice = (device: NonNullable<typeof selection.device>) => ({
    id: device.id,
    name: device.name,
    price: device.price,
    description: device.description,
    imageUrl: absoluteUrl(request, device.imageUrl),
  });

  return ok({
    mode: selection.mode,
    customer: { name: user.name, phone: user.phone },
    plan: selection.plan
      ? {
          slug: selection.plan.slug,
          name: selection.plan.name,
          serviceType: selection.plan.serviceType,
          price: selection.plan.price,
          durationLabel: selection.plan.durationLabel,
          description: selection.plan.description,
          features: selection.plan.features.slice(0, 4),
          imageUrl: absoluteUrl(request, selection.plan.imageUrl),
        }
      : null,
    device: selection.device ? shapeDevice(selection.device) : null,
    devices: selection.devices.map(shapeDevice),
    initialDeviceId: selection.initialDeviceId,
    subscription: selection.subscription ? { id: selection.subscription.id, packageName: selection.subscription.packageName } : null,
    contactOptions: selection.contactOptions,
    initialContact: selection.initialContact,
  });
});
