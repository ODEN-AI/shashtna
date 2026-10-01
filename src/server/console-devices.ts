import { randomBytes } from "node:crypto";

import {
  MAX_DEVICES_PER_USER,
  deviceSessionExpiry,
  deviceStatus,
  formatDeviceCredential,
  parseDeviceCredential,
  type DeviceInput,
  type DeviceView,
} from "@/src/lib/console-api";
import { toDate } from "@/src/lib/i18n";
import { createAuthToken, sameDigest, secretVerifier } from "@/src/lib/mobile-auth";
import { hasPermission, isStaffRole, normalizeRole } from "@/src/lib/roles";
import { STAFF_SESSION_MAX_AGE_SECONDS } from "@/src/lib/staff-session";
import { db } from "@/src/prisma/db";
import { logActivity } from "@/src/server/activity";
import { staffSessionState } from "@/src/server/staff-sessions";

/**
 * Console devices (native shells). See src/lib/console-api for the
 * contract. Every function here checks ownership/permission itself: an id
 * alone never grants access, and a device the caller may not see is
 * reported as "not found".
 *
 * Who may manage a device: its owner, or a staff member with the "staff"
 * permission (OWNER / legacy ADMIN — the same people who can end other
 * people's sessions today).
 */

export type Actor = { id: number; role: string | null | undefined };
export type DeviceError = "NOT_FOUND" | "FORBIDDEN" | "LIMIT" | "REVOKED" | "INVALID";

const FIELDS = ["id", "userId", "platform", "label", "appVersion", "credentialHash", "createdAt", "lastSeenAt", "revokedAt"] as const;

type DeviceRow = { id: number; userId: number; platform: string; label: string; appVersion: string | null; credentialHash: string | null; createdAt: unknown; lastSeenAt: unknown; revokedAt: unknown };

export function toDeviceView(row: DeviceRow): DeviceView {
  return {
    id: row.id,
    userId: row.userId,
    platform: row.platform,
    label: row.label,
    appVersion: row.appVersion,
    createdAt: String(row.createdAt),
    lastSeenAt: row.lastSeenAt ? String(row.lastSeenAt) : null,
    revokedAt: row.revokedAt ? String(row.revokedAt) : null,
    status: deviceStatus(row),
  };
}

const canManageAll = (actor: Actor) => hasPermission(actor.role, "staff");
const seconds = (value: unknown) => Math.floor((toDate(String(value))?.getTime() ?? NaN) / 1000);

async function visibleDevice(actor: Actor, id: number) {
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  const row = await db.orm.public.ConsoleDevice.where({ id }).select(...FIELDS).first();

  return row && (row.userId === actor.id || canManageAll(actor)) ? row : null;
}

/**
 * Register a device — or re-bind one of the caller's own devices after a
 * new password sign-in (input.deviceId). The credential is generated here,
 * returned once and never again; only its verifier is stored. The device is
 * bound to the sign-in time of the caller's current session (`sessionIat`),
 * so it can never outlive that sign-in's 7-day staff maximum.
 */
export async function registerDevice(actor: Actor, sessionIat: number, input: DeviceInput): Promise<{ ok: true; device: DeviceView; credential: string; rebound: boolean } | { ok: false; error: DeviceError }> {
  if (!isStaffRole(normalizeRole(actor.role))) return { ok: false, error: "FORBIDDEN" };

  const secret = randomBytes(32).toString("base64url");
  const verifier = secretVerifier(secret);
  const authenticatedAt = new Date(sessionIat * 1000).toISOString();

  if (input.deviceId !== null) {
    const existing = await db.orm.public.ConsoleDevice.where({ id: input.deviceId }).select(...FIELDS).first();
    if (!existing || existing.userId !== actor.id) return { ok: false, error: "NOT_FOUND" };
    if (existing.revokedAt) return { ok: false, error: "REVOKED" };

    await db.orm.public.ConsoleDevice.where({ id: existing.id }).update({
      credentialHash: verifier,
      authenticatedAt,
      platform: input.platform,
      label: input.label,
      appVersion: input.appVersion,
      lastSeenAt: new Date().toISOString(),
    });
    const row = (await db.orm.public.ConsoleDevice.where({ id: existing.id }).select(...FIELDS).first())!;
    await logActivity({ actor, userId: actor.id, entityType: "STAFF", entityId: actor.id, action: "CONSOLE_DEVICE_REGISTERED", summary: `Console device signed in again: ${row.label}`, details: JSON.stringify({ deviceId: row.id, platform: row.platform, rebound: true }) });

    return { ok: true, device: toDeviceView(row), credential: formatDeviceCredential(row.id, secret), rebound: true };
  }

  const active = await db.orm.public.ConsoleDevice.where({ userId: actor.id })
    .where((row) => row.revokedAt.isNull())
    .aggregate((a) => ({ n: a.count() }));
  if (active.n >= MAX_DEVICES_PER_USER) return { ok: false, error: "LIMIT" };

  const created = await db.orm.public.ConsoleDevice.create({
    userId: actor.id,
    platform: input.platform,
    label: input.label,
    appVersion: input.appVersion,
    credentialHash: verifier,
    authenticatedAt,
    lastSeenAt: new Date().toISOString(),
  });
  const row = (await db.orm.public.ConsoleDevice.where({ id: created.id }).select(...FIELDS).first())!;
  await logActivity({ actor, userId: actor.id, entityType: "STAFF", entityId: actor.id, action: "CONSOLE_DEVICE_REGISTERED", summary: `Console device registered: ${row.label}`, details: JSON.stringify({ deviceId: row.id, platform: row.platform, rebound: false }) });

  return { ok: true, device: toDeviceView(row), credential: formatDeviceCredential(row.id, secret), rebound: false };
}

/** The caller's own devices, or (scope "team", "staff" permission only) every staff device. */
export async function listDevices(actor: Actor, scope: "mine" | "team" = "mine") {
  if (scope === "team" && !canManageAll(actor)) return null;

  const base = scope === "team" ? db.orm.public.ConsoleDevice : db.orm.public.ConsoleDevice.where({ userId: actor.id });
  const rows = await base.select(...FIELDS).orderBy((row) => row.id.desc()).limit(200).all();

  return rows.map(toDeviceView);
}

export async function renameDevice(actor: Actor, id: number, label: string): Promise<{ ok: true; device: DeviceView; changed: boolean } | { ok: false; error: DeviceError }> {
  const row = await visibleDevice(actor, id);
  if (!row) return { ok: false, error: "NOT_FOUND" };
  if (row.label === label) return { ok: true, device: toDeviceView(row), changed: false };

  await db.orm.public.ConsoleDevice.where({ id }).update({ label });
  await logActivity({ actor, userId: row.userId, entityType: "STAFF", entityId: row.userId, action: "CONSOLE_DEVICE_RENAMED", summary: `Console device renamed: ${row.label} → ${label}`, details: JSON.stringify({ deviceId: id, from: row.label, to: label }) });

  return { ok: true, device: toDeviceView({ ...row, label }), changed: true };
}

/** Permanently block a device: no exchange, and its live session stops on the next request. */
export async function revokeDevice(actor: Actor, id: number): Promise<{ ok: true; device: DeviceView; changed: boolean } | { ok: false; error: DeviceError }> {
  const row = await visibleDevice(actor, id);
  if (!row) return { ok: false, error: "NOT_FOUND" };
  if (row.revokedAt) return { ok: true, device: toDeviceView(row), changed: false };

  const revokedAt = new Date().toISOString();
  await db.orm.public.ConsoleDevice.where({ id }).update({ revokedAt, revokedBy: actor.id, credentialHash: null, pushToken: null });
  await logActivity({ actor, userId: row.userId, entityType: "STAFF", entityId: row.userId, action: "CONSOLE_DEVICE_REVOKED", summary: `Console device revoked: ${row.label}`, details: JSON.stringify({ deviceId: id, platform: row.platform, by: actor.id === row.userId ? "SELF" : "ADMIN" }) });

  return { ok: true, device: toDeviceView({ ...row, revokedAt, credentialHash: null }), changed: true };
}

/**
 * Device sign-out: clear the credential (the shell must sign in with the
 * password again) without revoking the device. Only for the session's own
 * device; other devices are untouched.
 */
export async function signOutDevice(userId: number, deviceId: number) {
  const row = await db.orm.public.ConsoleDevice.where({ id: deviceId }).select("id", "userId", "credentialHash").first();
  if (!row || row.userId !== userId || !row.credentialHash) return false;

  await db.orm.public.ConsoleDevice.where({ id: deviceId }).update({ credentialHash: null, pushToken: null });
  await logActivity({ actor: { id: userId }, userId, entityType: "STAFF", entityId: userId, action: "CONSOLE_DEVICE_SIGNED_OUT", summary: "Console device signed out", details: JSON.stringify({ deviceId }) });

  return true;
}

/**
 * Exchange a device credential for a normal staff session token. Fails
 * (null, one generic outcome) unless: the credential parses and matches,
 * the device is not revoked or signed out, the account exists and is
 * staff, the sign-in it is bound to is inside the 7-day staff maximum and
 * not before a sign-out-everywhere.
 */
export async function exchangeCredential(credential: unknown) {
  const parsed = parseDeviceCredential(credential);
  if (!parsed) return null;

  const device = await db.orm.public.ConsoleDevice.where({ id: parsed.deviceId })
    .select("id", "userId", "platform", "label", "credentialHash", "authenticatedAt", "revokedAt")
    .first();
  // Compare against something even when the device is missing (uniform timing).
  const stored = device?.credentialHash ?? "0".repeat(64);
  const matches = sameDigest(secretVerifier(parsed.secret), stored);
  if (!device || !matches || !device.credentialHash || device.revokedAt || !device.authenticatedAt) return null;

  const user = await db.orm.public.User.where({ id: device.userId }).select("id", "name", "role").first();
  const role = normalizeRole(user?.role);
  if (!user || !isStaffRole(role)) return null;

  const boundAt = seconds(device.authenticatedAt);
  if (!Number.isFinite(boundAt) || (await staffSessionState(user.id, role, boundAt)) !== "ok") return null;

  const nowSec = Math.floor(Date.now() / 1000);
  const expiresAt = deviceSessionExpiry(boundAt, nowSec, STAFF_SESSION_MAX_AGE_SECONDS);
  if (expiresAt <= nowSec) return null;

  await db.orm.public.ConsoleDevice.where({ id: device.id }).update({ lastSeenAt: new Date().toISOString() });
  const session = createAuthToken(user.id, role, { deviceId: device.id, issuedAt: boundAt, expiresAt });

  return { session, user: { id: user.id, name: user.name, role }, device: { id: device.id, platform: device.platform, label: device.label } };
}
