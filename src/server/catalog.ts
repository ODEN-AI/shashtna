import { db } from "@/src/prisma/db";

export type CatalogPackage = {
  id: number;
  name: string;
  slug: string;
  serviceType: "IPTV" | "VIP";
  price: number;
  durationMonths: number;
  durationLabel: string;
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
    .split(/\r?\n|•/)
    .map((line) => line.replace(/^[-*\s]+/, "").trim())
    .filter(Boolean);
}

export function normalizeServiceType(value: unknown): "IPTV" | "VIP" {
  return String(value ?? "").trim().toUpperCase() === "VIP" ? "VIP" : "IPTV";
}

/** Only http(s) download links are rendered, never javascript: or data: URLs. */
export function safeHref(value: string | null | undefined) {
  const text = String(value ?? "").trim();

  if (/^https?:\/\//i.test(text)) {
    return text;
  }

  if (text.startsWith("/") && !text.startsWith("//")) {
    return text;
  }

  return null;
}

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

  const mapped = packages.map((pkg) => ({
    id: pkg.id,
    name: pkg.name,
    slug: pkg.slug,
    serviceType: normalizeServiceType(pkg.serviceType),
    price: pkg.price,
    durationMonths: pkg.durationMonths,
    durationLabel: pkg.durationLabel,
    description: pkg.description,
    features: splitLines(pkg.specifications),
    notes: pkg.notes,
    imageUrl: safeHref(pkg.imageUrl),
    salesCount: sales.get(pkg.name.trim()) ?? 0,
    isPopular: false,
  }));

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
      : a.price - b.price || a.id - b.id,
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
