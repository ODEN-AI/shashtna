import { safeHref } from "@/src/lib/safe-href";

/**
 * Catalogue — pure parts (unit-tested). The catalogue's data lives in the
 * existing Package / Device / PackageDevice tables; these helpers only parse
 * the console's URL state, validate values the existing APIs accept, and
 * describe what changed for the audit log.
 */

export const STATUS_FILTERS = ["all", "active", "inactive"] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];
export const TYPE_FILTERS = ["all", "IPTV", "VIP"] as const;
export type TypeFilter = (typeof TYPE_FILTERS)[number];
/** Package views with a business meaning (VIP packages need a compatible device to be sold). */
export const PACKAGE_VIEWS = ["all", "active", "inactive", "no-devices"] as const;
export type PackageView = (typeof PACKAGE_VIEWS)[number];
export const DEVICE_VIEWS = ["all", "active", "inactive", "unlinked"] as const;
export type DeviceView = (typeof DEVICE_VIEWS)[number];

export type CatalogueQuery<View extends string> = { q: string; view: View; type: TypeFilter; page: number };

function pick<T extends string>(values: readonly T[], value: unknown, fallback: T): T {
  return values.find((item) => item === value) ?? fallback;
}

export function parseCatalogueQuery<View extends string>(views: readonly View[], params: { q?: string; view?: string; type?: string; page?: string }): CatalogueQuery<View> {
  const page = Number(params.page);

  return {
    q: String(params.q ?? "").trim().slice(0, 80),
    view: pick(views, params.view, views[0]),
    type: pick(TYPE_FILTERS, String(params.type ?? "").toUpperCase() === "ALL" ? "all" : String(params.type ?? "").toUpperCase(), "all"),
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

export function normalizeServiceType(value: unknown): "IPTV" | "VIP" {
  return String(value ?? "").trim().toUpperCase() === "VIP" ? "VIP" : "IPTV";
}

/** Prices are whole Iraqi dinars (Int columns): no fractions, no negatives, no strings. */
export function isValidPrice(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 100_000_000;
}

/**
 * An image URL the catalogue may store: an uploaded file (relative path) or
 * an http(s) URL. Returns null for "no image", false for an invalid value.
 */
export function catalogueImageUrl(value: unknown): string | null | false {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return false;
  const text = value.trim();
  if (!text) return null;

  return safeHref(text) ?? false;
}

/**
 * A VIP package can only be ordered (NEW/UPGRADE) with an active VIP device
 * linked through PackageDevice — the rule createOrder() enforces. IPTV
 * packages don't use devices.
 */
export function needsCompatibleDevice(pkg: { serviceType: string; isActive: boolean }) {
  return pkg.isActive && normalizeServiceType(pkg.serviceType) === "VIP";
}

type Comparable = Record<string, unknown>;

/** "price: 35000 → 40000; isActive: true → false" — for the audit summary/details. */
export function describeChanges(before: Comparable, after: Comparable, fields: readonly string[]) {
  return fields
    .filter((field) => field in after && String(before[field] ?? "") !== String(after[field] ?? ""))
    .map((field) => `${field}: ${before[field] ?? "—"} → ${after[field] ?? "—"}`);
}

export function describeLinks(before: number[], after: number[]) {
  const added = after.filter((id) => !before.includes(id)).sort((a, b) => a - b);
  const removed = before.filter((id) => !after.includes(id)).sort((a, b) => a - b);

  return { added, removed, changed: added.length > 0 || removed.length > 0 };
}

/** Free-text match over the fields staff search by (name, slug, description). */
export function matchesText(q: string, ...fields: (string | null | undefined)[]) {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  if (/^#\d+$/.test(needle)) return false;

  return fields.some((field) => String(field ?? "").toLowerCase().includes(needle));
}
