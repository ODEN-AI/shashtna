import { loadSection } from "@/src/lib/dashboard-section";
import { toDate } from "@/src/lib/i18n";
import { STAFF_ROLES, hasPermission, normalizeRole, type Permission } from "@/src/lib/roles";
import { shouldUseBlobStorage } from "@/src/lib/runtime";
import { STAFF_SESSION_MAX_AGE_SECONDS } from "@/src/lib/staff-session";
import { AUDIT_PAGE, SECURITY_ACTIONS, configurationStatus, isFullAccess, sinceDate, type AuditQuery } from "@/src/lib/system";
import { db } from "@/src/prisma/db";
import { customersById } from "@/src/server/admin-data";
import { SETTING_DEFINITIONS, SETTING_KEYS } from "@/src/server/settings";

/**
 * System / admin console — a read layer over the existing infrastructure:
 * User.role (staff and roles), StaffSessionRevocation (session revocation),
 * ActivityEvent (audit), SiteSetting (settings) and the environment
 * (configuration status only — never values). Every query is SQL-side
 * (filters, aggregates, LIMIT/OFFSET) and every section loads only with its
 * permission. Password hashes and tokens are never selected.
 */

const STAFF = [...STAFF_ROLES] as string[];
const DAY = 86_400_000;
const iso = (value: unknown) => (value ? (toDate(String(value))?.toISOString() ?? String(value)) : null);

function can(role: string) {
  return (permission: Permission) => hasPermission(role, permission);
}

/** Display fields only (never passwordHash). */
const STAFF_FIELDS = ["id", "name", "phone", "email", "role", "createdAt"] as const;

// ------------------------------------------------------------------ overview

export async function getSystemOverview(role: string) {
  const allowed = can(role);
  const now = Date.now();

  const [staff, security, activity, settings, database] = await Promise.all([
    loadSection(allowed("staff"), "SYSTEM_STAFF", async () => {
      const groups = await db.orm.public.User.where((user) => user.role.in(STAFF)).groupBy("role").aggregate((a) => ({ n: a.count() }));
      const byRole = STAFF_ROLES.map((value) => ({ role: value, count: Number(groups.find((group) => normalizeRole(group.role) === value)?.n ?? 0) }));

      return { total: byRole.reduce((sum, row) => sum + row.count, 0), fullAccess: byRole.filter((row) => isFullAccess(row.role)).reduce((sum, row) => sum + row.count, 0), byRole };
    }),
    loadSection(allowed("audit"), "SYSTEM_SECURITY", async () => {
      const since = new Date(now - 7 * DAY).toISOString();
      const groups = await db.orm.public.ActivityEvent.where((event) => event.action.in([...SECURITY_ACTIONS]))
        .where((event) => event.createdAt.gte(since))
        .groupBy("action")
        .aggregate((a) => ({ n: a.count() }));

      return SECURITY_ACTIONS.map((action) => ({ action, count: Number(groups.find((group) => group.action === action)?.n ?? 0) }));
    }),
    loadSection(allowed("audit"), "SYSTEM_ACTIVITY", async () =>
      (await db.orm.public.ActivityEvent.where((event) => event.entityType.in(["STAFF", "SETTING"]))
        .select("id", "action", "summary", "actorUserId", "actorRole", "createdAt")
        .orderBy((event) => event.id.desc())
        .limit(8)
        .all()).map((event) => ({ ...event, createdAt: String(event.createdAt) })),
    ),
    loadSection(allowed("settings"), "SYSTEM_SETTINGS", async () => {
      const rows = await db.orm.public.SiteSetting.select("key", "value").all();
      const saved = new Map(rows.map((row) => [row.key, row.value]));

      return {
        total: SETTING_KEYS.length,
        set: SETTING_KEYS.filter((key) => String(saved.get(key) ?? SETTING_DEFINITIONS[key].default).trim()).length,
        transferConfigured: Boolean(String(saved.get("payment.transferNumber") ?? SETTING_DEFINITIONS["payment.transferNumber"].default).trim()),
      };
    }),
    loadSection(allowed("settings") || allowed("staff") || allowed("audit"), "SYSTEM_DATABASE", async () => {
      const started = Date.now();
      await db.orm.public.User.aggregate((a) => ({ n: a.count() }));
      return { ok: true, ms: Date.now() - started };
    }),
  ]);

  return {
    can: allowed,
    staff,
    security,
    activity,
    settings,
    database,
    configuration: allowed("settings") ? configurationStatus(process.env, shouldUseBlobStorage()) : null,
    deployId: allowed("settings") ? (process.env.DEPLOY_ID ?? null) : null,
    sessionDays: STAFF_SESSION_MAX_AGE_SECONDS / 86400,
  };
}

/** Database reachability plus environment status (configured / not — never values). */
export async function getConfiguration() {
  const database = await loadSection(true, "SYSTEM_DATABASE", async () => {
    await db.orm.public.User.aggregate((a) => ({ n: a.count() }));
    return true;
  });

  return { database, configuration: configurationStatus(process.env, shouldUseBlobStorage()), deployId: process.env.DEPLOY_ID ?? null };
}

// ------------------------------------------------------------------ staff

export const STAFF_PAGE = 25;

/** Staff directory: SQL-filtered and paged; last revocation and 30-day activity for the page's rows only. */
export async function listStaff(query: { q: string; role: string; page: number }) {
  return loadSection(true, "SYSTEM_STAFF_LIST", async () => {
    let scope = db.orm.public.User.where((user) => user.role.in(query.role === "all" ? STAFF : [query.role]));
    if (query.q) {
      const like = `%${query.q.replace(/[%_\\]/g, (char) => `\\${char}`)}%`;
      scope = /^[\d+\s]+$/.test(query.q) ? scope.where((user) => user.phone.like(like.replace(/\s/g, ""))) : scope.where((user) => user.name.ilike(like));
    }

    const [total, rows] = await Promise.all([
      scope.aggregate((a) => ({ n: a.count() })),
      scope.select(...STAFF_FIELDS).orderBy((user) => user.id.asc()).offset((query.page - 1) * STAFF_PAGE).limit(STAFF_PAGE).all(),
    ]);
    const ids = rows.map((row) => row.id);
    const since = new Date(Date.now() - 30 * DAY).toISOString();
    const [revocations, activity] = ids.length
      ? await Promise.all([
          db.orm.public.StaffSessionRevocation.where((row) => row.userId.in(ids)).select("userId", "revokedAt").all(),
          db.orm.public.ActivityEvent.where((event) => event.actorUserId.in(ids))
            .where((event) => event.createdAt.gte(since))
            .groupBy("actorUserId")
            .aggregate((a) => ({ n: a.count(), last: a.max("createdAt") })),
        ])
      : [[], []];

    return {
      total: Number(total.n),
      rows: rows.map((row) => {
        const used = activity.find((group) => group.actorUserId === row.id);

        return {
          ...row,
          role: normalizeRole(row.role),
          createdAt: String(row.createdAt),
          fullAccess: isFullAccess(row.role),
          sessionsEndedAt: iso(revocations.find((revocation) => revocation.userId === row.id)?.revokedAt),
          actions30d: Number(used?.n ?? 0),
          lastActionAt: iso(used?.last),
        };
      }),
    };
  });
}

/** Find any account by exact phone (to add a team member) — name, role and id only. */
export async function findAccountByPhone(phone: string) {
  const clean = phone.trim();
  if (!/^\+?\d{7,15}$/.test(clean)) return null;

  return db.orm.public.User.where({ phone: clean }).select("id", "name", "phone", "role").first();
}

// ------------------------------------------------------------------ audit

/** Audit log: filters and paging in SQL; names only for the rows shown. */
export async function listAudit(query: AuditQuery) {
  return loadSection(true, "SYSTEM_AUDIT", async () => {
    let scope = db.orm.public.ActivityEvent.where((event) => event.id.gt(0));
    if (query.entity !== "all") scope = scope.where({ entityType: query.entity });
    if (query.action !== "all") scope = scope.where({ action: query.action });
    if (query.actor === "staff") scope = scope.where((event) => event.actorRole.neq("CUSTOMER"));
    else if (typeof query.actor === "number") scope = scope.where({ actorUserId: query.actor });
    const since = sinceDate(query.since);
    if (since) scope = scope.where((event) => event.createdAt.gte(since));
    if (query.q) scope = scope.where((event) => event.summary.ilike(`%${query.q.replace(/[%_\\]/g, (char) => `\\${char}`)}%`));

    const [total, rows, actions] = await Promise.all([
      scope.aggregate((a) => ({ n: a.count() })),
      scope
        .select("id", "actorUserId", "actorRole", "userId", "entityType", "entityId", "action", "summary", "details", "createdAt")
        .orderBy((event) => event.id.desc())
        .offset((query.page - 1) * AUDIT_PAGE)
        .limit(AUDIT_PAGE)
        .all(),
      db.orm.public.ActivityEvent.groupBy("action").aggregate((a) => ({ n: a.count() })),
    ]);
    const people = await customersById(rows.flatMap((row) => [row.actorUserId ?? 0, row.userId ?? 0]).filter(Boolean));

    return {
      total: Number(total.n),
      actions: actions.map((row) => String(row.action)).sort(),
      rows: rows.map((row) => ({
        ...row,
        createdAt: String(row.createdAt),
        actorName: row.actorUserId ? (people.get(row.actorUserId)?.name ?? `#${row.actorUserId}`) : null,
        userName: row.userId ? (people.get(row.userId)?.name ?? `#${row.userId}`) : null,
      })),
    };
  });
}

// ------------------------------------------------------------------ security

/** Session policy, revocations and recent security events. */
export async function getSecurityOverview() {
  const [revocations, events] = await Promise.all([
    loadSection(true, "SYSTEM_REVOCATIONS", async () => {
      const rows = await db.orm.public.StaffSessionRevocation.select("userId", "revokedAt", "revokedBy").orderBy((row) => row.revokedAt.desc()).limit(20).all();
      const people = await customersById(rows.flatMap((row) => [row.userId, row.revokedBy ?? 0]).filter(Boolean));

      return rows.map((row) => ({
        userId: row.userId,
        name: people.get(row.userId)?.name ?? `#${row.userId}`,
        role: normalizeRole(people.get(row.userId)?.role),
        revokedAt: iso(row.revokedAt),
        by: row.revokedBy ? (row.revokedBy === row.userId ? "SELF" : (people.get(row.revokedBy)?.name ?? `#${row.revokedBy}`)) : null,
      }));
    }),
    loadSection(true, "SYSTEM_SECURITY_EVENTS", async () => {
      const rows = await db.orm.public.ActivityEvent.where((event) => event.action.in([...SECURITY_ACTIONS]))
        .select("id", "action", "summary", "actorUserId", "actorRole", "createdAt")
        .orderBy((event) => event.id.desc())
        .limit(25)
        .all();
      const people = await customersById(rows.map((row) => row.actorUserId ?? 0).filter(Boolean));

      return rows.map((row) => ({ ...row, createdAt: String(row.createdAt), actorName: row.actorUserId ? (people.get(row.actorUserId)?.name ?? `#${row.actorUserId}`) : null }));
    }),
  ]);

  return { revocations, events, sessionDays: STAFF_SESSION_MAX_AGE_SECONDS / 86400 };
}

// ------------------------------------------------------------------ settings summary

/** Which settings are set (values of public settings only), who changed them last and when. */
export async function getSettingsSummary() {
  return loadSection(true, "SYSTEM_SETTINGS_SUMMARY", async () => {
    const rows = await db.orm.public.SiteSetting.select("key", "value", "updatedBy", "updatedAt").all();
    const people = await customersById(rows.map((row) => row.updatedBy ?? 0).filter(Boolean));

    return SETTING_KEYS.map((key) => {
      const row = rows.find((item) => item.key === key);
      const value = String(row?.value ?? SETTING_DEFINITIONS[key].default).trim();

      return {
        key,
        group: SETTING_DEFINITIONS[key].group,
        labelAr: SETTING_DEFINITIONS[key].labelAr,
        labelEn: SETTING_DEFINITIONS[key].labelEn,
        set: Boolean(value),
        usingDefault: !row,
        // Every setting is public site content (contact links, the transfer number customers pay to,
        // legal text); long texts are summarised by length.
        preview: SETTING_DEFINITIONS[key].multiline ? (value ? `${value.length}` : "") : value,
        updatedAt: row ? iso(row.updatedAt) : null,
        updatedBy: row?.updatedBy ? (people.get(row.updatedBy)?.name ?? `#${row.updatedBy}`) : null,
      };
    });
  });
}
