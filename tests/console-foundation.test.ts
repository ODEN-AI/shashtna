import assert from "node:assert/strict";
import { test } from "node:test";

process.env.AUTH_SECRET ??= "test-secret-for-console-foundation-0123456789";

const api = await import("@/src/lib/console-api");
const throttle = await import("@/src/lib/login-throttle");
const auth = await import("@/src/lib/mobile-auth");
const staff = await import("@/src/lib/staff-session");
const system = await import("@/src/lib/system");

const SECRET = "A".repeat(43);

// ------------------------------------------------------------------ device credential

test("device credential: strict format, the id alone is never enough", () => {
  assert.deepEqual(api.parseDeviceCredential(api.formatDeviceCredential(42, SECRET)), { deviceId: 42, secret: SECRET });
  for (const bad of [null, 42, "", "scd1.42", `scd1.42.${SECRET.slice(1)}`, `scd1.0.${SECRET}`, `scd1.-1.${SECRET}`, `scd2.42.${SECRET}`, `scd1.42.${SECRET}x`, `scd1.42.${"+".repeat(43)}`, `scd1.042.${SECRET}`, `${"x".repeat(70)}`]) {
    assert.equal(api.parseDeviceCredential(bad), null, String(bad));
  }
});

test("device registration input: platform enum, label, version, never a userId", () => {
  const ok = api.parseDeviceInput({ platform: "ANDROID", label: "  هاتف   العمل ", appVersion: "1.2.0-beta+3", userId: 999 });
  assert.deepEqual(ok, { ok: true, value: { platform: "ANDROID", label: "هاتف العمل", appVersion: "1.2.0-beta+3", deviceId: null } });
  assert.ok(!("userId" in (ok.ok ? ok.value : {})), "userId from the body is ignored");
  assert.deepEqual(api.parseDeviceInput({ platform: "LINUX", label: "x" }), { ok: false, field: "platform" });
  assert.deepEqual(api.parseDeviceInput({ platform: "WINDOWS", label: "" }), { ok: false, field: "label" });
  assert.deepEqual(api.parseDeviceInput({ platform: "WINDOWS", label: "x".repeat(61) }), { ok: false, field: "label" });
  assert.deepEqual(api.parseDeviceInput({ platform: "WINDOWS", label: "PC", appVersion: "1.0 <script>" }), { ok: false, field: "appVersion" });
  assert.deepEqual(api.parseDeviceInput({ platform: "WINDOWS", label: "PC", deviceId: "7" }), { ok: false, field: "deviceId" });
  assert.deepEqual(api.parseDeviceInput({ platform: "WINDOWS", label: "PC", deviceId: 7 }), { ok: true, value: { platform: "WINDOWS", label: "PC", appVersion: null, deviceId: 7 } });
  assert.deepEqual(api.parseDeviceInput([]), { ok: false, field: "body" });
  assert.equal(api.cleanDeviceLabel("a\u0000b\nc"), "abc", "control characters (incl. newlines) are dropped");
  assert.equal(api.cleanDeviceLabel("a \t  b"), "a b");
});

test("device session never outlives the 7-day staff maximum of the sign-in it is bound to", () => {
  const max = staff.STAFF_SESSION_MAX_AGE_SECONDS;
  const signedIn = 1_000_000;
  assert.equal(api.deviceSessionExpiry(signedIn, signedIn + 60, max), signedIn + 60 + api.DEVICE_SESSION_TTL_SECONDS);
  assert.equal(api.deviceSessionExpiry(signedIn, signedIn + max - 100, max), signedIn + max, "capped at sign-in + 7 days");
  assert.ok(api.deviceSessionExpiry(signedIn, signedIn + max + 10, max) <= signedIn + max + 10, "past the maximum: already expired");
});

test("device status and the reserved scheme", () => {
  assert.equal(api.deviceStatus({ revokedAt: null, credentialHash: "h" }), "ACTIVE");
  assert.equal(api.deviceStatus({ revokedAt: null, credentialHash: null }), "SIGNED_OUT");
  assert.equal(api.deviceStatus({ revokedAt: "2026-10-01", credentialHash: "h" }), "REVOKED");
  assert.equal(api.CONSOLE_URL_SCHEME, "shashtna-console", "not shashtna:// (the customer app's scheme)");
  assert.deepEqual([...api.CONSOLE_PLATFORMS], ["WINDOWS", "ANDROID", "IOS", "WEB"]);
});

// ------------------------------------------------------------------ tokens

test("tokens: device sessions carry the device and the original sign-in time; tampering fails", () => {
  const plain = auth.createAuthToken(5, "OWNER");
  const plainPayload = auth.verifyAuthToken(plain.token)!;
  assert.equal(plainPayload.did, undefined, "browser sessions are unchanged");

  const now = Math.floor(Date.now() / 1000);
  const device = auth.createAuthToken(5, "OWNER", { deviceId: 9, issuedAt: now - 3600, expiresAt: now + 600 });
  const payload = auth.verifyAuthToken(device.token)!;
  assert.deepEqual({ sub: payload.sub, did: payload.did, iat: payload.iat, exp: payload.exp }, { sub: 5, did: 9, iat: now - 3600, exp: now + 600 });

  const [body, signature] = device.token.split(".");
  const forged = Buffer.from(JSON.stringify({ ...payload, did: 10 })).toString("base64url");
  assert.equal(auth.verifyAuthToken(`${forged}.${signature}`), null, "changing the device id breaks the signature");
  assert.equal(auth.verifyAuthToken(`${body}.${signature.slice(0, -2)}xx`), null);
  const expired = auth.createAuthToken(5, "OWNER", { deviceId: 9, issuedAt: now - 7200, expiresAt: now - 1 });
  assert.equal(auth.verifyAuthToken(expired.token), null, "expired device session");
});

test("revocation applies to device sessions through the original sign-in time", () => {
  const signedIn = 1_700_000_000;
  assert.equal(staff.checkStaffSession(signedIn, (signedIn + 60) * 1000, null), "ok");
  assert.equal(staff.checkStaffSession(signedIn, (signedIn + 60) * 1000, (signedIn + 30) * 1000), "revoked", "sign-out-everywhere after the device was bound");
  assert.equal(staff.checkStaffSession(signedIn, (signedIn + staff.STAFF_SESSION_MAX_AGE_SECONDS + 1) * 1000, null), "expired");
});

test("verifiers and keyed digests", () => {
  assert.equal(auth.secretVerifier("abc"), auth.secretVerifier("abc"));
  assert.notEqual(auth.secretVerifier("abc"), auth.secretVerifier("abd"));
  assert.ok(!auth.secretVerifier(SECRET).includes(SECRET));
  assert.ok(auth.sameDigest("aa", "aa") && !auth.sameDigest("aa", "ab") && !auth.sameDigest("aa", "aaa"));
  const key = auth.keyedDigest("login:account:07900000001");
  assert.match(key, /^[0-9a-f]{64}$/);
  assert.ok(!key.includes("07900000001"), "no raw phone in the stored key");
});

// ------------------------------------------------------------------ login throttle

test("lock is progressive, capped and never permanent", () => {
  const pair = throttle.THROTTLE_POLICIES.PAIR;
  assert.equal(throttle.lockDurationMs(pair.limit - 1, pair), 0, "below the limit: no lock");
  assert.equal(throttle.lockDurationMs(pair.limit, pair), pair.baseLockMs);
  assert.equal(throttle.lockDurationMs(pair.limit + 1, pair), pair.baseLockMs * 2);
  assert.equal(throttle.lockDurationMs(pair.limit + 50, pair), pair.maxLockMs, "capped");
  for (const policy of Object.values(throttle.THROTTLE_POLICIES)) {
    assert.ok(policy.maxLockMs <= 60 * 60_000 && policy.windowMs <= 60 * 60_000, "bounded");
  }
  assert.ok(throttle.THROTTLE_POLICIES.ACCOUNT.limit > throttle.THROTTLE_POLICIES.PAIR.limit, "locking a real user out from elsewhere takes many more attempts");
  assert.equal(throttle.retryAfterSeconds(Date.now() + 90_000, Date.now()), 120);
  assert.equal(throttle.retryAfterSeconds(Date.now() + 1, Date.now()), 60);
});

test("identifier normalisation folds formatting and the +964 prefix", () => {
  for (const phone of ["07900000001", "0790 000 0001", "+9647900000001", "009647900000001", "964-790-000-0001"]) {
    assert.equal(throttle.normalizeIdentifier(phone), "07900000001", phone);
  }
  assert.notEqual(throttle.normalizeIdentifier("07900000002"), throttle.normalizeIdentifier("07900000001"));
});

test("separate identifiers and sources get separate counters", () => {
  const a = throttle.throttleDimensions("07900000001", "1.1.1.1");
  const b = throttle.throttleDimensions("07900000002", "1.1.1.1");
  const c = throttle.throttleDimensions("07900000001", "2.2.2.2");
  assert.notEqual(a.PAIR, b.PAIR);
  assert.notEqual(a.ACCOUNT, b.ACCOUNT);
  assert.equal(a.SOURCE, b.SOURCE, "one source spraying accounts shares the source counter");
  assert.notEqual(a.PAIR, c.PAIR, "another source doesn't inherit the pair lock");
  assert.equal(a.ACCOUNT, c.ACCOUNT, "the account counter spans sources");
  assert.notEqual(throttle.throttleDimensions("1", "x", "exchange").SOURCE, throttle.throttleDimensions("1", "x").SOURCE, "exchange and login are counted apart");
});

test("client address: platform header first, then forwarded-for", () => {
  const headers = (values: Record<string, string>) => ({ get: (name: string) => values[name] ?? null });
  assert.equal(throttle.clientAddress(headers({ "x-nf-client-connection-ip": "5.5.5.5", "x-forwarded-for": "6.6.6.6" })), "5.5.5.5");
  assert.equal(throttle.clientAddress(headers({ "x-forwarded-for": "6.6.6.6, 10.0.0.1" })), "6.6.6.6");
  assert.equal(throttle.clientAddress(headers({})), "unknown");
});

test("device events are security events", () => {
  assert.ok(system.SECURITY_ACTIONS.includes("CONSOLE_DEVICE_REVOKED"));
  assert.ok(system.SECURITY_ACTIONS.includes("CONSOLE_DEVICE_REGISTERED"));
});
