import { getActiveDevices, getActivePackages } from "@/src/server/catalog";
import { ok, withPublic } from "@/src/server/mobile/http";
import { absoluteUrl } from "@/src/server/mobile/shape";

export const dynamic = "force-dynamic";

/**
 * Plans and VIP devices exactly as the website sells them right now (the
 * catalogue Admin edits). Only active items; prices come from the database
 * on every request, so a price change needs no app update.
 */
export const GET = withPublic(async ({ request }) => {
  const [packages, devices] = await Promise.all([getActivePackages(), getActiveDevices()]);

  return ok({
    packages: packages.map((pkg) => ({
      id: pkg.id,
      name: pkg.name,
      slug: pkg.slug,
      serviceType: pkg.serviceType,
      price: pkg.price,
      durationMonths: pkg.durationMonths,
      durationLabel: pkg.durationLabel,
      description: pkg.description,
      features: pkg.features,
      notes: pkg.notes,
      imageUrl: absoluteUrl(request, pkg.imageUrl),
      isPopular: pkg.isPopular,
      requiresDevice: pkg.serviceType === "VIP",
    })),
    devices: devices
      .filter((device) => device.serviceType.toUpperCase() === "VIP")
      .map((device) => ({
        id: device.id,
        name: device.name,
        slug: device.slug,
        price: device.price,
        description: device.description,
        features: device.features,
        notes: device.notes,
        imageUrl: absoluteUrl(request, device.imageUrl),
        packageIds: device.packageIds,
      })),
    currency: "IQD",
  });
});
