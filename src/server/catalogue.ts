import { loadSection } from "@/src/lib/dashboard-section";
import {
  matchesText,
  needsCompatibleDevice,
  normalizeServiceType,
  type CatalogueQuery,
  type DeviceView,
  type PackageView,
} from "@/src/lib/catalogue";
import { hasPermission, type Permission } from "@/src/lib/roles";
import { db } from "@/src/prisma/db";
import { logActivity } from "@/src/server/activity";

/**
 * Catalogue data for the console. Package / Device / PackageDevice stay the
 * single source of truth and the existing /api/admin/packages and
 * /api/admin/devices routes stay the only writers; this module reads them
 * for the console views and gives those routes their safety checks
 * (historical references) and audit trail.
 *
 * "Where used" numbers are aggregates computed in SQL (GROUP BY), never
 * order or customer rows: catalogue staff see how many orders and
 * subscriptions depend on a product, not who placed them.
 */

// ------------------------------------------------------------------ references (used by the APIs)

async function total(query: PromiseLike<{ n: number }>) {
  return Number((await query).n);
}

/** Orders and subscriptions that reference a package (by slug, id or — for older rows — name). */
export async function packageReferences(pkg: { id: number; slug: string; name: string }) {
  const [orders, byId, byName] = await Promise.all([
    total(db.orm.public.SubscriptionRequest.where({ planSlug: pkg.slug }).aggregate((a) => ({ n: a.count() }))),
    total(db.orm.public.Subscription.where({ packageId: pkg.id }).aggregate((a) => ({ n: a.count() }))),
    total(db.orm.public.Subscription.where((sub) => sub.packageId.isNull()).where({ packageName: pkg.name }).aggregate((a) => ({ n: a.count() }))),
  ]);

  return { orders, subscriptions: byId + byName };
}

/** Orders that reference a device (purchases and VIP bundles store its id). */
export async function deviceReferences(deviceId: number) {
  return { orders: await total(db.orm.public.SubscriptionRequest.where({ deviceId: String(deviceId) }).aggregate((a) => ({ n: a.count() }))) };
}

/** Catalogue audit events — the existing activity log, entity PACKAGE / DEVICE. */
export async function auditCatalogue(input: {
  actor: { id: number; role?: string | null };
  entityType: "PACKAGE" | "DEVICE";
  entityId: number;
  action: string;
  summary: string;
  changes?: string[];
}) {
  await logActivity({
    actor: input.actor,
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    summary: input.summary,
    details: input.changes?.length ? input.changes.join("\n") : null,
  });
}

// ------------------------------------------------------------------ shared loaders

const PACKAGE_FIELDS = ["id", "name", "slug", "serviceType", "price", "durationMonths", "durationLabel", "description", "imageUrl", "isActive", "updatedAt"] as const;
const DEVICE_FIELDS = ["id", "name", "slug", "serviceType", "price", "description", "imageUrl", "isActive", "updatedAt"] as const;

async function loadCatalogue() {
  const [packages, devices, links] = await Promise.all([
    db.orm.public.Package.select(...PACKAGE_FIELDS).all(),
    db.orm.public.Device.select(...DEVICE_FIELDS).all(),
    db.orm.public.PackageDevice.select("packageId", "deviceId").all(),
  ]);

  const devicesOf = new Map<number, number[]>();
  const packagesOf = new Map<number, number[]>();
  for (const link of links) {
    devicesOf.set(link.packageId, [...(devicesOf.get(link.packageId) ?? []), link.deviceId]);
    packagesOf.set(link.deviceId, [...(packagesOf.get(link.deviceId) ?? []), link.packageId]);
  }

  const deviceById = new Map(devices.map((device) => [device.id, device]));
  const packageById = new Map(packages.map((pkg) => [pkg.id, pkg]));

  const packageRows = packages.map((pkg) => {
    const linked = (devicesOf.get(pkg.id) ?? []).map((id) => deviceById.get(id)).filter((device) => device !== undefined);
    const activeLinked = linked.filter((device) => device.isActive);

    return {
      ...pkg,
      serviceType: normalizeServiceType(pkg.serviceType),
      updatedAt: String(pkg.updatedAt),
      devices: linked.map((device) => ({ id: device.id, name: device.name, isActive: device.isActive })),
      // VIP packages can't be ordered without an active compatible device (createOrder's rule).
      unsellable: needsCompatibleDevice(pkg) && activeLinked.length === 0,
    };
  });
  const deviceRows = devices.map((device) => ({
    ...device,
    serviceType: normalizeServiceType(device.serviceType),
    updatedAt: String(device.updatedAt),
    packages: (packagesOf.get(device.id) ?? []).map((id) => packageById.get(id)).filter((pkg) => pkg !== undefined).map((pkg) => ({ id: pkg.id, name: pkg.name, isActive: pkg.isActive })),
  }));

  return { packages: packageRows, devices: deviceRows };
}

/** Usage aggregates for every product at once (one GROUP BY per source). */
async function loadUsage() {
  const [ordersBySlug, ordersByDevice, subsById, subsByName, announcements] = await Promise.all([
    db.orm.public.SubscriptionRequest.groupBy("planSlug").aggregate((a) => ({ n: a.count() })),
    db.orm.public.SubscriptionRequest.where((order) => order.deviceId.isNotNull()).groupBy("deviceId").aggregate((a) => ({ n: a.count() })),
    db.orm.public.Subscription.where((sub) => sub.packageId.isNotNull()).groupBy("packageId").aggregate((a) => ({ n: a.count() })),
    db.orm.public.Subscription.where((sub) => sub.packageId.isNull()).groupBy("packageName").aggregate((a) => ({ n: a.count() })),
    db.orm.public.Announcement.where((item) => item.ctaUrl.isNotNull()).select("id", "title", "ctaUrl", "isActive").all(),
  ]);

  return {
    packageOrders: (slug: string) => Number(ordersBySlug.find((row) => row.planSlug === slug)?.n ?? 0),
    deviceOrders: (id: number) => Number(ordersByDevice.find((row) => row.deviceId === String(id))?.n ?? 0),
    packageSubscriptions: (id: number, name: string) =>
      Number(subsById.find((row) => row.packageId === id)?.n ?? 0) + Number(subsByName.find((row) => String(row.packageName).trim() === name.trim())?.n ?? 0),
    // Offers that link straight to a product (checkout?plan=slug / ?device=id).
    packageOffers: (slug: string) => announcements.filter((item) => new URLSearchParams(String(item.ctaUrl).split("?")[1] ?? "").get("plan") === slug).map(({ id, title, isActive }) => ({ id, title, isActive })),
    deviceOffers: (id: number) => announcements.filter((item) => new URLSearchParams(String(item.ctaUrl).split("?")[1] ?? "").get("device") === String(id)).map(({ id: offerId, title, isActive }) => ({ id: offerId, title, isActive })),
  };
}

function can(role: string) {
  return (permission: Permission) => hasPermission(role, permission);
}

function byRecent<T extends { updatedAt: string }>(a: T, b: T) {
  return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
}

// ------------------------------------------------------------------ overview

export async function getCatalogueOverview(role: string) {
  const catalogue = await loadSection(true, "CATALOGUE", loadCatalogue);

  if (!catalogue?.ok) return { ok: false as const, can: can(role) };

  const { packages, devices } = catalogue.data;
  const recent = [
    ...packages.map((pkg) => ({ kind: "package" as const, id: pkg.id, name: pkg.name, isActive: pkg.isActive, updatedAt: pkg.updatedAt })),
    ...devices.map((device) => ({ kind: "device" as const, id: device.id, name: device.name, isActive: device.isActive, updatedAt: device.updatedAt })),
  ]
    .sort(byRecent)
    .slice(0, 6);

  return {
    ok: true as const,
    can: can(role),
    packages: {
      active: packages.filter((pkg) => pkg.isActive).length,
      inactive: packages.filter((pkg) => !pkg.isActive).length,
      noDevices: packages.filter((pkg) => pkg.unsellable),
    },
    devices: {
      total: devices.length,
      active: devices.filter((device) => device.isActive).length,
      unlinked: devices.filter((device) => device.packages.length === 0),
    },
    recent,
  };
}

// ------------------------------------------------------------------ lists

export async function listPackagesForConsole(query: CatalogueQuery<PackageView>) {
  const catalogue = await loadSection(true, "CATALOGUE_PACKAGES", loadCatalogue);

  if (!catalogue?.ok) return { ok: false as const };

  const rows = catalogue.data.packages
    .filter((pkg) => matchesText(query.q, pkg.name, pkg.slug, pkg.description) || query.q === `#${pkg.id}`)
    .filter((pkg) => query.type === "all" || pkg.serviceType === query.type)
    .filter((pkg) => (query.view === "active" ? pkg.isActive : query.view === "inactive" ? !pkg.isActive : query.view === "no-devices" ? pkg.unsellable : true))
    .sort((a, b) => (a.serviceType === b.serviceType ? a.price - b.price || a.id - b.id : a.serviceType === "IPTV" ? -1 : 1));

  return { ok: true as const, rows };
}

export async function listDevicesForConsole(query: CatalogueQuery<DeviceView>) {
  const catalogue = await loadSection(true, "CATALOGUE_DEVICES", loadCatalogue);

  if (!catalogue?.ok) return { ok: false as const };

  const rows = catalogue.data.devices
    .filter((device) => matchesText(query.q, device.name, device.slug, device.description) || query.q === `#${device.id}`)
    .filter((device) => query.type === "all" || device.serviceType === query.type)
    .filter((device) => (query.view === "active" ? device.isActive : query.view === "inactive" ? !device.isActive : query.view === "unlinked" ? device.packages.length === 0 : true))
    .sort((a, b) => (a.serviceType === b.serviceType ? a.price - b.price || a.id - b.id : a.serviceType === "IPTV" ? -1 : 1));

  return { ok: true as const, rows };
}

// ------------------------------------------------------------------ detail

async function catalogueActivity(entityType: "PACKAGE" | "DEVICE", id: number) {
  return (
    await db.orm.public.ActivityEvent.where({ entityType, entityId: String(id) })
      .orderBy((event) => event.id.desc())
      .limit(15)
      .all()
  ).map((event) => ({ id: event.id, action: event.action, summary: event.summary, details: event.details, createdAt: String(event.createdAt) }));
}

export async function getPackageDetail(role: string, id: number) {
  const pkg = await db.orm.public.Package.where({ id }).first();

  if (!pkg) return null;

  const [catalogue, usage, activity] = await Promise.all([
    loadSection(true, "PACKAGE_DEVICES", loadCatalogue),
    loadSection(true, "PACKAGE_USAGE", loadUsage),
    loadSection(true, "PACKAGE_ACTIVITY", () => catalogueActivity("PACKAGE", id)),
  ]);
  const row = catalogue?.ok ? catalogue.data.packages.find((item) => item.id === id) : undefined;

  return {
    can: can(role),
    pkg: { ...pkg, serviceType: normalizeServiceType(pkg.serviceType), createdAt: String(pkg.createdAt), updatedAt: String(pkg.updatedAt) },
    compatibility: catalogue?.ok
      ? {
          ok: true as const,
          linked: row?.devices ?? [],
          unsellable: row?.unsellable ?? false,
          // Devices that may be linked: same service type (the API's rule).
          candidates: catalogue.data.devices.filter((device) => device.serviceType === normalizeServiceType(pkg.serviceType)).map((device) => ({ id: device.id, name: device.name, isActive: device.isActive })),
        }
      : { ok: false as const },
    usage: usage?.ok
      ? { ok: true as const, orders: usage.data.packageOrders(pkg.slug), subscriptions: usage.data.packageSubscriptions(pkg.id, pkg.name), offers: usage.data.packageOffers(pkg.slug) }
      : { ok: false as const },
    activity: activity ?? { ok: false as const },
  };
}

export async function getDeviceDetail(role: string, id: number) {
  const device = await db.orm.public.Device.where({ id }).first();

  if (!device) return null;

  const [catalogue, usage, activity] = await Promise.all([
    loadSection(true, "DEVICE_PACKAGES", loadCatalogue),
    loadSection(true, "DEVICE_USAGE", loadUsage),
    loadSection(true, "DEVICE_ACTIVITY", () => catalogueActivity("DEVICE", id)),
  ]);
  const row = catalogue?.ok ? catalogue.data.devices.find((item) => item.id === id) : undefined;

  return {
    can: can(role),
    device: { ...device, serviceType: normalizeServiceType(device.serviceType), updatedAt: String(device.updatedAt) },
    compatibility: catalogue?.ok
      ? {
          ok: true as const,
          linked: row?.packages ?? [],
          candidates: catalogue.data.packages.filter((pkg) => pkg.serviceType === normalizeServiceType(device.serviceType)).map((pkg) => ({ id: pkg.id, name: pkg.name, isActive: pkg.isActive })),
        }
      : { ok: false as const },
    usage: usage?.ok ? { ok: true as const, orders: usage.data.deviceOrders(device.id), offers: usage.data.deviceOffers(device.id) } : { ok: false as const },
    activity: activity ?? { ok: false as const },
  };
}

/** Products a new package/device may be linked to (name, type, status only). */
export async function getLinkOptions() {
  return loadSection(true, "CATALOGUE_OPTIONS", async () => {
    const { packages, devices } = await loadCatalogue();

    return {
      packages: packages.map((pkg) => ({ id: pkg.id, name: pkg.name, isActive: pkg.isActive, serviceType: pkg.serviceType })),
      devices: devices.map((device) => ({ id: device.id, name: device.name, isActive: device.isActive, serviceType: device.serviceType })),
    };
  });
}

// ------------------------------------------------------------------ compatibility

export async function getCompatibility(q: string) {
  const catalogue = await loadSection(true, "CATALOGUE_COMPATIBILITY", loadCatalogue);

  if (!catalogue?.ok) return { ok: false as const };

  // Compatibility is a VIP concept: VIP packages are sold with a linked VIP device.
  const packages = catalogue.data.packages.filter((pkg) => pkg.serviceType === "VIP");
  const devices = catalogue.data.devices.filter((device) => device.serviceType === "VIP");
  const visiblePackages = packages.filter((pkg) => matchesText(q, pkg.name, pkg.slug) || pkg.devices.some((device) => matchesText(q, device.name)));
  const visibleDevices = devices.filter((device) => matchesText(q, device.name, device.slug) || device.packages.some((pkg) => matchesText(q, pkg.name)));

  return {
    ok: true as const,
    packages: visiblePackages.map((pkg) => ({ id: pkg.id, name: pkg.name, isActive: pkg.isActive, unsellable: pkg.unsellable, deviceIds: pkg.devices.map((device) => device.id) })),
    devices: visibleDevices.map((device) => ({ id: device.id, name: device.name, isActive: device.isActive, packages: device.packages })),
    allDevices: devices.map((device) => ({ id: device.id, name: device.name, isActive: device.isActive })),
    total: { packages: packages.length, devices: devices.length },
  };
}

export type PackageDetail = NonNullable<Awaited<ReturnType<typeof getPackageDetail>>>;
export type DeviceDetail = NonNullable<Awaited<ReturnType<typeof getDeviceDetail>>>;
