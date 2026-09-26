/**
 * Staff roles and permissions.
 *
 * `ADMIN` is the role every existing administrator account already has; it
 * keeps full access and is treated exactly like `OWNER`.
 */

export const STAFF_ROLES = [
  "OWNER",
  "ADMIN",
  "OPERATOR",
  "SUPPORT",
  "CONTENT",
] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

export type Permission =
  | "orders"
  | "subscriptions"
  | "customers"
  | "catalogue"
  | "support"
  | "content"
  | "notifications"
  | "broadcast"
  | "insights"
  | "staff"
  | "settings"
  | "audit";

const ROLE_PERMISSIONS: Record<StaffRole, readonly Permission[] | "all"> = {
  OWNER: "all",
  ADMIN: "all",
  OPERATOR: ["orders", "subscriptions", "customers", "support", "insights", "notifications", "broadcast"],
  SUPPORT: ["support", "customers", "notifications"],
  CONTENT: ["catalogue", "content", "notifications", "broadcast"],
};

export function normalizeRole(role: unknown) {
  return String(role ?? "")
    .trim()
    .toUpperCase();
}

export function isStaffRole(role: unknown): role is StaffRole {
  return (STAFF_ROLES as readonly string[]).includes(normalizeRole(role));
}

export function hasPermission(role: unknown, permission: Permission) {
  const normalized = normalizeRole(role);

  if (!isStaffRole(normalized)) {
    return false;
  }

  const granted = ROLE_PERMISSIONS[normalized];

  return granted === "all" || granted.includes(permission);
}

/** Roles an owner may assign from the admin console. */
export const ASSIGNABLE_ROLES = [
  "CUSTOMER",
  "OWNER",
  "OPERATOR",
  "SUPPORT",
  "CONTENT",
] as const;

export const ROLE_LABELS: Record<string, { ar: string; en: string }> = {
  CUSTOMER: { ar: "عميل", en: "Customer" },
  OWNER: { ar: "مالك", en: "Owner" },
  ADMIN: { ar: "مدير (كامل الصلاحيات)", en: "Admin (full access)" },
  OPERATOR: { ar: "مشغّل", en: "Operator" },
  SUPPORT: { ar: "دعم فني", en: "Support" },
  CONTENT: { ar: "محتوى", en: "Content" },
};
