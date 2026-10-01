import { PERMISSIONS, STAFF_ROLES, hasPermission, normalizeRole, type Permission } from "@/src/lib/roles";

/**
 * System / admin console — pure parts (unit-tested). Roles, permissions,
 * sessions, the audit log and settings all stay in their existing modules;
 * this only describes them for display, parses URL state and holds the
 * privilege rules the role action enforces.
 */

/** Audit entity types written by logActivity() (src/server/activity.ts). */
export const AUDIT_ENTITIES = ["ORDER", "SUBSCRIPTION", "TICKET", "PACKAGE", "DEVICE", "APP", "ANNOUNCEMENT", "INCIDENT", "SETTING", "STAFF", "USER", "LEAD", "PASSWORD_RESET", "NOTIFICATION", "FINANCE", "INTELLIGENCE"] as const;

/** Actions that matter for security reviews. */
export const SECURITY_ACTIONS = ["ROLE_CHANGED", "STAFF_SESSIONS_REVOKED", "SUBSCRIPTION_CREDENTIALS_REVEALED", "SETTINGS_UPDATED", "PASSWORD_RESET_CODE_ISSUED", "PASSWORD_CHANGED"] as const;

export const AUDIT_SINCE = ["all", "24h", "7d", "30d"] as const;
export type AuditSince = (typeof AUDIT_SINCE)[number];

export const AUDIT_PAGE = 40;

export type AuditQuery = { q: string; entity: string; action: string; actor: number | "staff" | null; since: AuditSince; page: number };

/**
 * Audit filters from the URL. `type` and `staff=1` are the legacy /admin/audit
 * parameters and keep working. Unknown values fall back to "everything".
 */
export function parseAuditQuery(params: { q?: string; entity?: string; type?: string; action?: string; actor?: string; staff?: string; since?: string; page?: string }): AuditQuery {
  const entity = String(params.entity ?? params.type ?? "").toUpperCase();
  const action = String(params.action ?? "").toUpperCase();
  const actor = Number(params.actor);
  const page = Number(params.page);

  return {
    q: String(params.q ?? "").trim().slice(0, 80),
    entity: (AUDIT_ENTITIES as readonly string[]).includes(entity) ? entity : "all",
    action: /^[A-Z_]{2,60}$/.test(action) ? action : "all",
    actor: Number.isInteger(actor) && actor > 0 ? actor : params.staff === "1" ? "staff" : null,
    since: AUDIT_SINCE.find((value) => value === params.since) ?? "all",
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

export function sinceDate(since: AuditSince, now = Date.now()) {
  const hours = { all: 0, "24h": 24, "7d": 168, "30d": 720 }[since];

  return hours ? new Date(now - hours * 3_600_000).toISOString() : null;
}

/** Role × permission matrix, straight from hasPermission(). */
export function roleMatrix() {
  return STAFF_ROLES.map((role) => ({ role, permissions: Object.fromEntries(PERMISSIONS.map((permission) => [permission, hasPermission(role, permission)])) as Record<Permission, boolean> }));
}

/** Full access = holds every permission (OWNER, and the legacy ADMIN). */
export function isFullAccess(role: unknown) {
  return PERMISSIONS.every((permission) => hasPermission(role, permission));
}

/**
 * Whether `actor` may move `target` from its current role to `next`.
 * The rules the existing role action adds to its "staff" permission check:
 * nobody changes their own role; only full-access staff grant or remove full
 * access; the last full-access account can't lose it.
 */
export function checkRoleChange(input: { actorId: number; actorRole: string; targetId: number; targetRole: string; nextRole: string; fullAccessCount: number }): { ok: true } | { ok: false; reason: "SELF" | "NOT_ALLOWED" | "ESCALATION" | "LAST_OWNER" } {
  if (input.actorId === input.targetId) return { ok: false, reason: "SELF" };
  if (!hasPermission(input.actorRole, "staff")) return { ok: false, reason: "NOT_ALLOWED" };

  const targetFull = isFullAccess(input.targetRole);
  const nextFull = isFullAccess(input.nextRole);

  if ((targetFull || nextFull) && !isFullAccess(input.actorRole)) return { ok: false, reason: "ESCALATION" };
  if (targetFull && !nextFull && input.fullAccessCount <= 1) return { ok: false, reason: "LAST_OWNER" };

  return { ok: true };
}

export const STAFF_ROLE_FILTERS = ["all", ...STAFF_ROLES] as const;

export function parseStaffQuery(params: { q?: string; role?: string; page?: string }) {
  const role = normalizeRole(params.role);
  const page = Number(params.page);

  return {
    q: String(params.q ?? "").trim().slice(0, 80),
    role: (STAFF_ROLES as readonly string[]).includes(role) ? role : "all",
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

// ------------------------------------------------------------------ settings

/** Keys whose values are long texts: audited as "changed", not by value. */
export const LONG_SETTING_GROUPS = ["legal"] as const;

/** Server-side format checks for the settings that have one (empty is always allowed). */
export function settingProblem(key: string, value: string): string | null {
  if (!value) return null;
  if (key === "contact.telegram" && !/^https:\/\/t\.me\//.test(value)) return "رابط تيليجرام يجب أن يبدأ بـ https://t.me/";
  if ((key === "contact.facebook" || key === "player.downloadUrl") && !/^https:\/\//.test(value)) return "الروابط يجب أن تبدأ بـ https://";
  if ((key === "contact.whatsapp" || key === "contact.phone") && !/^\+?[\d\s-]{7,20}$/.test(value)) return "رقم الهاتف/واتساب يجب أن يحتوي أرقامًا فقط (مع + أو مسافات).";
  if (key === "payment.transferNumber" && !/^[\d\s-]{4,40}$/.test(value)) return "رقم التحويل يجب أن يحتوي أرقامًا فقط.";

  return null;
}

/** "contact.phone: — → 0770…" lines for the audit details; long texts only say they changed. */
export function describeSettingChanges(changes: { key: string; group: string; before: string; after: string }[]) {
  return changes.map((change) =>
    (LONG_SETTING_GROUPS as readonly string[]).includes(change.group)
      ? `${change.key}: changed (${change.before.length} → ${change.after.length} chars)`
      : `${change.key}: ${change.before || "—"} → ${change.after || "—"}`,
  );
}

// ------------------------------------------------------------------ configuration

/**
 * Configuration status without values: whether each environment-backed piece
 * is configured. Values are never returned.
 */
export function configurationStatus(env: Record<string, string | undefined>, blobStorage: boolean) {
  const present = (key: string) => Boolean(String(env[key] ?? "").trim());

  return [
    { key: "DATABASE_URL", required: true, configured: present("DATABASE_URL") },
    { key: "AUTH_SECRET", required: true, configured: String(env.AUTH_SECRET ?? "").trim().length >= 32 },
    { key: "ANTHROPIC_API_KEY", required: false, configured: present("ANTHROPIC_API_KEY") },
    // Uploads and support tickets: Netlify Blobs in production, local files otherwise (shouldUseBlobStorage()).
    { key: "NETLIFY_BLOBS", required: false, configured: blobStorage },
  ];
}
