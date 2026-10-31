import { db } from "@/src/prisma/db";
import { defaultOption } from "@/src/lib/package-options";
import { safeHref } from "@/src/lib/safe-href";
import { daysLeft, discountAmount } from "@/src/lib/discounts";
import { activeDiscounts } from "@/src/server/discounts";
import { optionsByPackage } from "@/src/server/package-options";

/** One length a package is sold in, with its own price. */
export type CatalogOption = {
  id: number;
  durationMonths: number;
  durationLabel: string;
  price: number;
  /** Price of a renewal order for this length; null = same as price. */
  renewalPrice: number | null;
  /** Loyalty points override (null = price ÷ 1,000). */
  pointsEarned: number | null;
  /** The option's active discount right now, with the prices it gives (null = none). */
  discount: CatalogDiscount | null;
};

export type CatalogDiscount = {
  id: number;
  kind: "PERCENT" | "AMOUNT";
  value: number;
  appliesToRenewals: boolean;
  endsAt: string | null;
  /** Whole days until endsAt, computed on the server (null without an end). */
  endsInDays: number | null;
  /** What a NEW order of this length costs after the discount (package part). */
  price: number;
  /** What a renewal costs after the discount, or null when renewals keep their price. */
  renewalPrice: number | null;
};

export type CatalogPackage = {
  id: number;
  name: string;
  slug: string;
  serviceType: "IPTV" | "VIP";
  /** price, renewalPrice and duration* are the package's default option (its shortest one). */
  price: number;
  /** Price of a renewal order; null = same as price. */
  renewalPrice: number | null;
  durationMonths: number;
  durationLabel: string;
  /** Every length on sale, shortest first (at least one). */
  options: CatalogOption[];
  description: string;
  features: string[];
  notes: string | null;
  imageUrl: string | null;
  /** Number of subscriptions sold (used only for ordering, never shown). */
  salesCount: number;
  isPopular: boolean;
};

export type CatalogDevice = {
  id: number;
  name: string;
  slug: string;
  serviceType: string;
  price: number;
  description: string;
  features: string[];
  notes: string | null;
  imageUrl: string | null;
  packageIds: number[];
};

export type CatalogApp = {
  id: number;
  name: string;
  slug: string;
  description: string;
  platform: string;
  version: string | null;
  downloadUrl: string;
  imageUrl: string | null;
  instructions: string[];
  notes: string | null;
  isPlayer: boolean;
};

export function splitLines(value: string | null | undefined) {
  return String(value ?? "")
    .split(/\r?\n|\\n|•/)
    .map((line) => line.replace(/^[-*\s]+/, "").trim())
    .filter(Boolean);
}

export function normalizeServiceType(value: unknown): "IPTV" | "VIP" {
  return String(value ?? "").trim().toUpperCase() === "VIP" ? "VIP" : "IPTV";
}

export { safeHref };

async function salesByPackageName() {
  const groups = await db.orm.public.Subscription.where((subscription) =>
    subscription.status.neq("CANCELLED"),
  )
    .groupBy("packageName")
    .aggregate((aggregate) => ({ sold: aggregate.count() }));

  return new Map(
    groups.map((group) => [String(group.packageName).trim(), group.sold]),
  );
}

export async function getActivePackages(): Promise<CatalogPackage[]> {
  const [packages, sales] = await Promise.all([
    db.orm.public.Package.where({ isActive: true }).all(),
    salesByPackageName(),
  ]);
  const optionMap = await optionsByPackage(packages.map((pkg) => pkg.id));
  const discounts = await activeDiscounts([...optionMap.values()].flat().filter((option) => option.isActive).map((option) => option.id)).catch(() => new Map());
  const discountFor = (option: { id: number; price: number; renewalPrice: number | null }): CatalogDiscount | null => {
    const rule = discounts.get(option.id);
    if (!rule) return null;
    const renewalBase = option.renewalPrice ?? option.price;
    return {
      id: rule.id,
      kind: rule.kind,
      value: rule.value,
      appliesToRenewals: rule.appliesToRenewals,
      endsAt: rule.endsAt,
      endsInDays: daysLeft(rule.endsAt),
      price: option.price - discountAmount(option.price, rule),
      renewalPrice: rule.appliesToRenewals ? renewalBase - discountAmount(renewalBase, rule) : null,
    };
  };

  const mapped = packages.flatMap((pkg) => {
    const onSale = (optionMap.get(pkg.id) ?? []).filter((option) => option.isActive);
    const main = defaultOption(onSale);

    // A package with no length on sale can't be bought: it isn't listed.
    if (!main) return [];

    return [
      {
        id: pkg.id,
        name: pkg.name,
        slug: pkg.slug,
        serviceType: normalizeServiceType(pkg.serviceType),
        price: main.price,
        renewalPrice: main.renewalPrice,
        durationMonths: main.durationMonths,
        durationLabel: main.durationLabel,
        options: onSale.map((option) => ({
          id: option.id,
          durationMonths: option.durationMonths,
          durationLabel: option.durationLabel,
          price: option.price,
          renewalPrice: option.renewalPrice,
          pointsEarned: option.pointsEarned ?? null,
          discount: discountFor(option),
        })),
        description: pkg.description,
        features: splitLines(pkg.specifications),
        notes: pkg.notes,
        imageUrl: safeHref(pkg.imageUrl),
        salesCount: sales.get(pkg.name.trim()) ?? 0,
        isPopular: false,
      },
    ];
  });

  // One "most popular" badge per service type, only when there are real sales.
  for (const type of ["IPTV", "VIP"] as const) {
    const top = mapped
      .filter((pkg) => pkg.serviceType === type && pkg.salesCount > 0)
      .sort((a, b) => b.salesCount - a.salesCount)[0];

    if (top) {
      top.isPopular = true;
    }
  }

  return mapped.sort((a, b) =>
    a.serviceType !== b.serviceType
      ? a.serviceType === "IPTV"
        ? -1
        : 1
      : // Shortest to longest, so durations and prices read side by side.
        a.durationMonths - b.durationMonths || a.price - b.price || a.id - b.id,
  );
}

export async function getPackageBySlug(slug: string) {
  const packages = await getActivePackages();

  return packages.find((pkg) => pkg.slug === slug) ?? null;
}

/** Popular first (by real sales), then cheapest. */
export function rankPopular(packages: CatalogPackage[], limit = 3) {
  return [...packages]
    .sort((a, b) => b.salesCount - a.salesCount || a.price - b.price)
    .slice(0, limit);
}

export async function getActiveDevices(): Promise<CatalogDevice[]> {
  const [devices, links] = await Promise.all([
    db.orm.public.Device.where({ isActive: true }).all(),
    db.orm.public.PackageDevice.all(),
  ]);

  return devices
    .map((device) => ({
      id: device.id,
      name: device.name,
      slug: device.slug,
      serviceType: device.serviceType,
      price: device.price,
      description: device.description,
      features: splitLines(device.specifications),
      notes: device.notes,
      imageUrl: safeHref(device.imageUrl),
      packageIds: links
        .filter((link) => link.deviceId === device.id)
        .map((link) => link.packageId),
    }))
    .sort((a, b) => a.price - b.price || a.id - b.id);
}

export function isPlayerApp(app: { name: string; slug: string }) {
  const text = `${app.name} ${app.slug}`.toLowerCase();

  return text.includes("shashtna") || text.includes("شاشتنا");
}

export async function getActiveApps(): Promise<CatalogApp[]> {
  const apps = await db.orm.public.App.where({ isActive: true }).all();

  return apps
    .map((app) => ({
      id: app.id,
      name: app.name,
      slug: app.slug,
      description: app.description,
      platform: app.platform,
      version: app.version,
      downloadUrl: safeHref(app.downloadUrl) ?? "",
      imageUrl: safeHref(app.imageUrl),
      instructions: splitLines(app.instructions),
      notes: app.notes,
      isPlayer: isPlayerApp(app),
    }))
    .sort((a, b) => Number(b.isPlayer) - Number(a.isPlayer) || a.id - b.id);
}

/** Groups apps by platform for the Watch On hub. */
export function platformsOf(apps: CatalogApp[]) {
  const map = new Map<string, CatalogApp[]>();

  for (const app of apps) {
    const key = app.platform.trim() || "—";
    map.set(key, [...(map.get(key) ?? []), app]);
  }

  return [...map.entries()].map(([platform, items]) => ({ platform, apps: items }));
}

// Platform names as customers say them (the catalogue stores codes such as ANDROID).
const PLATFORM_NAMES: Record<string, string> = { ANDROID_TV: "Android TV", ANDROID: "Android", IOS: "iOS", WINDOWS: "Windows" };

export function platformName(platform: string) {
  return PLATFORM_NAMES[platform.toUpperCase().replace(/[\s-]+/g, "_")] ?? platform;
}
