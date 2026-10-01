import assert from "node:assert/strict";
import { test } from "node:test";

const system = await import("@/src/lib/system");
const roles = await import("@/src/lib/roles");

const change = (over: Partial<Parameters<typeof system.checkRoleChange>[0]>) =>
  system.checkRoleChange({ actorId: 1, actorRole: "OWNER", targetId: 2, targetRole: "SUPPORT", nextRole: "OPERATOR", fullAccessCount: 2, ...over });

test("privilege rules for role changes", () => {
  assert.deepEqual(change({}), { ok: true });
  assert.deepEqual(change({ targetId: 1 }), { ok: false, reason: "SELF" }, "nobody changes their own role");
  assert.deepEqual(change({ actorRole: "OPERATOR" }), { ok: false, reason: "NOT_ALLOWED" }, "the staff permission is required");
  assert.deepEqual(change({ actorRole: "CONTENT", nextRole: "OWNER" }), { ok: false, reason: "NOT_ALLOWED" });
  assert.deepEqual(change({ targetRole: "OWNER", nextRole: "CUSTOMER", fullAccessCount: 1 }), { ok: false, reason: "LAST_OWNER" }, "the last full-access account can't be demoted");
  assert.deepEqual(change({ targetRole: "OWNER", nextRole: "CUSTOMER", fullAccessCount: 2 }), { ok: true });
  assert.deepEqual(change({ targetRole: "ADMIN", nextRole: "OWNER", fullAccessCount: 1 }), { ok: true }, "ADMIN → OWNER keeps full access");
});

test("full access = every permission (OWNER and legacy ADMIN only)", () => {
  assert.ok(system.isFullAccess("OWNER"));
  assert.ok(system.isFullAccess("admin"));
  for (const role of ["OPERATOR", "SUPPORT", "CONTENT", "CUSTOMER", ""]) assert.ok(!system.isFullAccess(role), role);
});

test("role matrix mirrors hasPermission()", () => {
  const matrix = system.roleMatrix();
  assert.deepEqual(matrix.map((row) => row.role), [...roles.STAFF_ROLES]);
  for (const row of matrix) for (const permission of roles.PERMISSIONS) assert.equal(row.permissions[permission], roles.hasPermission(row.role, permission));
  assert.ok(!matrix.find((row) => row.role === "SUPPORT")!.permissions.staff);
});

test("audit query: SQL filters from the URL, legacy params kept", () => {
  assert.deepEqual(system.parseAuditQuery({}), { q: "", entity: "all", action: "all", actor: null, since: "all", page: 1 });
  assert.equal(system.parseAuditQuery({ type: "FINANCE" }).entity, "FINANCE", "legacy ?type=");
  assert.equal(system.parseAuditQuery({ staff: "1" }).actor, "staff", "legacy ?staff=1");
  assert.equal(system.parseAuditQuery({ actor: "7", staff: "1" }).actor, 7);
  assert.equal(system.parseAuditQuery({ entity: "package" }).entity, "PACKAGE");
  assert.equal(system.parseAuditQuery({ entity: "BOGUS", action: "drop table;", since: "1y", page: "-1", actor: "x" }).entity, "all");
  assert.equal(system.parseAuditQuery({ action: "drop table;" }).action, "all");
  assert.equal(system.parseAuditQuery({ since: "1y" }).since, "all");
  assert.equal(system.sinceDate("all"), null);
  assert.equal(system.sinceDate("24h", Date.parse("2026-10-02T00:00:00Z")), "2026-10-01T00:00:00.000Z");
});

test("settings validation and audit descriptions", () => {
  assert.equal(system.settingProblem("contact.whatsapp", ""), null, "empty is allowed");
  assert.equal(system.settingProblem("contact.whatsapp", "+964 770 000 0000"), null);
  assert.ok(system.settingProblem("contact.whatsapp", "call me"));
  assert.ok(system.settingProblem("payment.transferNumber", "IBAN-XYZ"));
  assert.equal(system.settingProblem("payment.transferNumber", "9286253712"), null);
  assert.ok(system.settingProblem("contact.telegram", "https://evil.example"));
  assert.deepEqual(
    system.describeSettingChanges([
      { key: "contact.phone", group: "contact", before: "", after: "07700000000" },
      { key: "legal.terms", group: "legal", before: "abc", after: "abcdef" },
    ]),
    ["contact.phone: — → 07700000000", "legal.terms: changed (3 → 6 chars)"],
  );
});

test("configuration status never carries values", () => {
  const status = system.configurationStatus({ DATABASE_URL: "postgres://user:secret@host/db", AUTH_SECRET: "x".repeat(40), ANTHROPIC_API_KEY: "" }, false);
  assert.deepEqual(status.map((item) => [item.key, item.configured]), [["DATABASE_URL", true], ["AUTH_SECRET", true], ["ANTHROPIC_API_KEY", false], ["NETLIFY_BLOBS", false]]);
  assert.ok(!JSON.stringify(status).includes("secret"), "no value is returned");
  assert.equal(system.configurationStatus({ AUTH_SECRET: "short" }, true).find((item) => item.key === "AUTH_SECRET")!.configured, false, "a short secret counts as not configured");
});

test("staff query", () => {
  assert.deepEqual(system.parseStaffQuery({}), { q: "", role: "all", page: 1 });
  assert.deepEqual(system.parseStaffQuery({ q: " Ali ", role: "support", page: "2" }), { q: "Ali", role: "SUPPORT", page: 2 });
  assert.equal(system.parseStaffQuery({ role: "CUSTOMER" }).role, "all", "customers aren't a staff filter");
});
