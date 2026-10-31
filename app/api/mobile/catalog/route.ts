import { getActiveDevices, getActiveGroups, getActivePackages } from "@/src/server/catalog";
import { ok, withPublic } from "@/src/server/mobile/http";
import { absoluteUrl } from "@/src/server/mobile/shape";

export const dynamic = "force-dynamic";

/**
 * Plans and VIP devices exactly as the website sells them right now (the
 * catalogue Admin edits). Only active items; prices come from the database
 * on every request, so a price change needs no app update.
 */
export const GET = withPublic(async ({ request }) => {
  const [packages, devices, groups] = await Promise.all([getActivePackages(), getActiveDevices(), getActiveGroups()]);

  return ok({
    packages: packages.map((pkg) => ({
      id: pkg.id,
      name: pkg.name,
      slug: pkg.slug,
      serviceType: pkg.serviceType,
      price: pkg.price,
      renewalPrice: pkg.renewalPrice ?? pkg.price,
      durationMonths: pkg.durationMonths,
      durationLabel: pkg.durationLabel,
      // Additive: every length on sale with its own price (the fields above are the default one).
      options: pkg.options.map((option) => ({ ...option, renewalPrice: option.renewalPrice ?? option.price })),
      description: pkg.description,
      features: pkg.features,
      notes: pkg.notes,
      imageUrl: absoluteUrl(request, pkg.imageUrl),
      isPopular: pkg.isPopular,
      requiresDevice: pkg.serviceType === "VIP",
      // Additive: the /plans group (IPTV, VIP or a digital platform).
      groupId: pkg.groupId,
    })),
    // Additive: the sections of the plans page, in display order, with their colours and delivery.
    groups: groups.map((group) => ({
      id: group.id,
      slug: group.slug,
      name: group.name,
      nameEn: group.nameEn,
      description: group.description,
      descriptionEn: group.descriptionEn,
      logoUrl: absoluteUrl(request, group.logoUrl),
      serviceType: group.serviceType,
      delivery: group.delivery,
      accent: group.accent,
      surface: group.surface,
      accentText: group.accentText,
      builtIn: group.builtIn,
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
