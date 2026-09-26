import { getActiveDevices, getActivePackages } from "@/src/server/catalog";
import { absoluteUrl } from "@/src/server/mobile";
import { ok, withPublic } from "@/src/server/mobile-api";

export const dynamic = "force-dynamic";

/**
 * Plans and VIP devices exactly as the website sells them. Only active
 * items are returned, so a plan an admin disables disappears from the app
 * on the next refresh (and the order API refuses it either way).
 */
export const GET = withPublic(async ({ request }) => {
  const [packages, devices] = await Promise.all([getActivePackages(), getActiveDevices()]);

  return ok(
    {
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
    },
    { headers: { "Cache-Control": "public, max-age=60" } },
  );
});
