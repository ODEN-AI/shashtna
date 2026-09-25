import assert from "node:assert/strict";
import { test } from "node:test";

process.env.AUTH_SECRET = "test-secret-with-at-least-32-characters!!";
process.env.DATABASE_URL ??= "postgresql://user:pass@127.0.0.1:5432/test";

const { createAuthToken, SESSION_COOKIE } = await import(
  "@/src/lib/mobile-auth"
);
const { requireUser } = await import("@/src/lib/session");

function makeRequest(headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/subscriptions", { headers });
}

test("rejects requests without a session", () => {
  const result = requireUser(makeRequest(), "7");

  assert.equal(result.ok, false);
  assert.equal(result.ok ? 0 : result.response.status, 401);
});

test("rejects a forged token", () => {
  const { token } = createAuthToken(7, "CUSTOMER");
  const forged = `${token.split(".")[0]}.invalidsignature`;

  const result = requireUser(
    makeRequest({ cookie: `${SESSION_COOKIE}=${forged}` }),
  );

  assert.equal(result.ok, false);
});

test("accepts the website session cookie", () => {
  const { token } = createAuthToken(7, "CUSTOMER");

  const result = requireUser(
    makeRequest({ cookie: `theme=dark; ${SESSION_COOKIE}=${token}` }),
    "7",
  );

  assert.deepEqual(result, { ok: true, userId: 7 });
});

test("accepts the mobile Bearer token", () => {
  const { token } = createAuthToken(7);

  const result = requireUser(
    makeRequest({ authorization: `Bearer ${token}` }),
  );

  assert.deepEqual(result, { ok: true, userId: 7 });
});

test("refuses access to another user's data", () => {
  const { token } = createAuthToken(7, "CUSTOMER");

  const result = requireUser(
    makeRequest({ cookie: `${SESSION_COOKIE}=${token}` }),
    "8",
  );

  assert.equal(result.ok, false);
  assert.equal(result.ok ? 0 : result.response.status, 403);
});
