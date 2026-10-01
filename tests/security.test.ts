import assert from "node:assert/strict";
import { test } from "node:test";

const rules = await import("@/src/lib/staff-session");
const { maskedPassword } = await import("@/src/server/credentials");

const NOW = Date.parse("2026-10-01T12:00:00Z");
const sec = (ms: number) => Math.floor(ms / 1000);

test("staff sessions end after the staff maximum age", () => {
  const max = rules.STAFF_SESSION_MAX_AGE_SECONDS;
  assert.equal(max, 7 * 24 * 60 * 60);
  assert.equal(rules.checkStaffSession(sec(NOW) - 60, NOW, null), "ok");
  assert.equal(rules.checkStaffSession(sec(NOW) - max, NOW, null), "ok");
  assert.equal(rules.checkStaffSession(sec(NOW) - max - 1, NOW, null), "expired");
  assert.equal(rules.checkStaffSession(Number.NaN, NOW, null), "expired");
});

test("a revocation invalidates every staff token issued at or before it", () => {
  const revokedAt = NOW - 10_000;
  assert.equal(rules.checkStaffSession(sec(revokedAt) - 3600, NOW, revokedAt), "revoked");
  // Same second as the revocation: fail closed.
  assert.equal(rules.checkStaffSession(sec(revokedAt), NOW, revokedAt), "revoked");
  // A fresh sign-in after the revocation is accepted.
  assert.equal(rules.checkStaffSession(sec(revokedAt) + 1, NOW, revokedAt), "ok");
});

test("the staff session end is the earlier of token expiry and the staff maximum", () => {
  const iat = sec(NOW);
  assert.equal(rules.staffSessionEndsAt(iat, iat + 30 * 86400), (iat + rules.STAFF_SESSION_MAX_AGE_SECONDS) * 1000);
  assert.equal(rules.staffSessionEndsAt(iat, iat + 3600), (iat + 3600) * 1000);
});

test("admin responses never carry the stored password", () => {
  assert.deepEqual(maskedPassword("s3cret-pass"), { password: null, hasPassword: true });
  assert.deepEqual(maskedPassword(""), { password: null, hasPassword: false });
  assert.deepEqual(maskedPassword(null), { password: null, hasPassword: false });
});
