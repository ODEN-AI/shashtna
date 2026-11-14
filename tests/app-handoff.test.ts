import assert from "node:assert/strict";
import { test } from "node:test";

process.env.AUTH_SECRET ??= "test-secret-that-is-long-enough-for-hmac-signing";

const h = await import("@/src/lib/app-handoff");
const auth = await import("@/src/lib/mobile-auth");

test("handoff: a fresh code verifies to its user and expires after 60 seconds", () => {
  const now = Date.UTC(2026, 10, 14, 12, 0, 0);
  const { code, expiresIn } = h.createHandoffCode(42, now);

  assert.equal(expiresIn, 60);
  assert.equal(h.verifyHandoffCode(code, now), 42);
  assert.equal(h.verifyHandoffCode(code, now + 59_000), 42);
  assert.equal(h.verifyHandoffCode(code, now + 61_000), null, "expired");
});

test("handoff: tampered, malformed and foreign values are refused", () => {
  const now = Date.now();
  const { code } = h.createHandoffCode(42, now);
  const [payload, signature] = code.split(".");
  const forged = Buffer.from(JSON.stringify({ sub: 1, iat: Math.floor(now / 1000), exp: Math.floor(now / 1000) + 60, n: "x" })).toString("base64url");

  assert.equal(h.verifyHandoffCode(`${forged}.${signature}`, now), null, "another user with the old signature");
  assert.equal(h.verifyHandoffCode(`${payload}.x${signature.slice(1)}`, now), null);
  assert.equal(h.verifyHandoffCode(`${code}.extra`, now), null);
  assert.equal(h.verifyHandoffCode("", now), null);
  assert.equal(h.verifyHandoffCode(null, now), null);
  assert.equal(h.verifyHandoffCode("a".repeat(500), now), null);
});

test("handoff: a code is never a session token, and a session token is never a code", () => {
  const { code } = h.createHandoffCode(42);
  const session = auth.createAuthToken(42, "CUSTOMER");

  assert.equal(auth.verifyAuthToken(code), null, "the handoff code can't sign anyone in by itself");
  assert.equal(h.verifyHandoffCode(session.token), null, "the app's long-lived token can't be posted as a code");
});

test("handoff: only the customer's own pages and the store are allowed as the destination", () => {
  assert.equal(h.safeNext("/plans"), "/plans");
  assert.equal(h.safeNext("/checkout?plan=iptv-1y&renew=12"), "/checkout?plan=iptv-1y&renew=12");
  assert.equal(h.safeNext("/support/chat"), "/support/chat");
  assert.equal(h.safeNext("/points"), "/points");
  assert.equal(h.safeNext("/admin"), "/dashboard", "never the console");
  assert.equal(h.safeNext("//evil.example"), "/dashboard");
  assert.equal(h.safeNext("https://evil.example/plans"), "/dashboard");
  assert.equal(h.safeNext("/plansevil"), "/dashboard");
  assert.equal(h.safeNext("/plans\\..\\admin"), "/dashboard");
  assert.equal(h.safeNext(undefined), "/dashboard");
});
