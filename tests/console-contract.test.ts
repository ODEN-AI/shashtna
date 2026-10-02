import assert from "node:assert/strict";
import { test } from "node:test";

const api = await import("@/src/lib/console-api");
const client = await import("@/src/lib/console-client");
const links = await import("@/src/lib/console-links");

type Call = { url: string; init: RequestInit };

function fakeFetch(respond: (call: Call) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const fn = (async (url: string | URL | Request, init: RequestInit = {}) => {
    const call = { url: String(url), init };
    calls.push(call);
    return respond(call);
  }) as typeof fetch;
  return { fn, calls };
}

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

// ------------------------------------------------------------------ error contract

test("error kinds cover every documented status", () => {
  const expected: Record<number, string> = { 400: "invalid", 401: "unauthenticated", 403: "forbidden", 404: "not_found", 409: "conflict", 413: "invalid", 415: "invalid", 429: "throttled", 500: "server", 503: "server" };
  for (const [status, kind] of Object.entries(expected)) assert.equal(api.consoleErrorKind(Number(status)), kind, status);
  for (const [code, status] of Object.entries(api.CONSOLE_ERROR_CODES)) assert.ok(api.consoleErrorKind(status) !== undefined, code);
  assert.equal(api.CONSOLE_ERROR_CODES.SERVER_ERROR, 500);
  assert.equal(api.CONSOLE_ERROR_CODES.DEVICE_REVOKED, 409);
});

// ------------------------------------------------------------------ typed client

test("client requests: versioned URL, no-store, cookie credentials, JSON only on POST", async () => {
  const { fn, calls } = fakeFetch(() => json(200, { ok: true, counts: {}, unavailable: [] }));
  const c = client.createConsoleClient({ baseUrl: "https://shashtna.netlify.app/", fetch: fn });
  await c.summary();
  await c.devices.rename(7, "هاتف");
  assert.equal(calls[0].url, "https://shashtna.netlify.app/api/console/v1/summary");
  assert.equal(calls[0].init.method, "GET");
  assert.equal(calls[0].init.cache, "no-store");
  assert.equal(calls[0].init.credentials, "include");
  assert.equal(calls[0].init.body, undefined);
  assert.equal(calls[1].url, "https://shashtna.netlify.app/api/console/v1/devices/7/rename");
  assert.equal((calls[1].init.headers as Record<string, string>)["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(String(calls[1].init.body)), { label: "هاتف" });
});

test("client errors are typed: 401 (and the hook), 403, 400 + field, 404, 409, 429 + retryAfter, 500", async () => {
  const cases: [Response, string, Partial<{ code: string; field: string; retryAfter: number }>][] = [
    [json(401, { ok: false, code: "UNAUTHENTICATED", message: "x" }), "unauthenticated", { code: "UNAUTHENTICATED" }],
    [json(403, { ok: false, code: "FORBIDDEN", message: "x" }), "forbidden", { code: "FORBIDDEN" }],
    [json(400, { ok: false, code: "INVALID", message: "x", field: "label" }), "invalid", { field: "label" }],
    [json(400, { ok: false, code: "INVALID", message: "x" }, { "X-Invalid-Field": "platform" }), "invalid", { field: "platform" }],
    [json(404, { ok: false, code: "NOT_FOUND", message: "x" }), "not_found", { code: "NOT_FOUND" }],
    [json(409, { ok: false, code: "DEVICE_LIMIT", message: "x" }), "conflict", { code: "DEVICE_LIMIT" }],
    [json(429, { ok: false, code: "RATE_LIMITED", message: "x", retryAfter: 300 }), "throttled", { retryAfter: 300 }],
    [json(429, { ok: false, code: "RATE_LIMITED", message: "x" }, { "Retry-After": "120" }), "throttled", { retryAfter: 120 }],
    [new Response("<html>oops</html>", { status: 500 }), "server", { code: "SERVER_ERROR" }],
  ];
  let unauthenticated = 0;
  for (const [response, kind, extra] of cases) {
    const { fn } = fakeFetch(() => response);
    const c = client.createConsoleClient({ fetch: fn, onUnauthenticated: () => (unauthenticated += 1) });
    await assert.rejects(c.session.current(), (error: unknown) => {
      assert.ok(error instanceof client.ConsoleApiError);
      assert.equal(error.kind, kind);
      for (const [key, value] of Object.entries(extra)) assert.equal((error as unknown as Record<string, unknown>)[key], value, `${kind}.${key}`);
      assert.ok(!/stack|at \//.test(error.message));
      return true;
    });
  }
  assert.equal(unauthenticated, 1, "the 401 hook fires once, only for 401");
});

test("network failure and timeout are distinct kinds", async () => {
  const down = client.createConsoleClient({ fetch: (async () => { throw new TypeError("fetch failed"); }) as typeof fetch });
  await assert.rejects(down.summary(), (error: unknown) => error instanceof client.ConsoleApiError && error.kind === "network" && error.status === 0);

  const hang = (async (_url: string, init: RequestInit = {}) =>
    new Promise<Response>((_resolve, reject) => init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))))) as unknown as typeof fetch;
  const slow = client.createConsoleClient({ fetch: hang, timeoutMs: 20 });
  await assert.rejects(slow.summary(), (error: unknown) => error instanceof client.ConsoleApiError && error.kind === "timeout");
});

test("the client keeps no credential: register returns it to the caller only", async () => {
  const credential = `scd1.5.${"Z".repeat(43)}`;
  const { fn, calls } = fakeFetch(() => json(201, { ok: true, device: { id: 5 }, credential, rebound: false }));
  const c = client.createConsoleClient({ fetch: fn });
  const result = await c.devices.register({ platform: "ANDROID", label: "هاتف" });
  assert.equal(result.credential, credential);
  const later = fakeFetch(() => json(200, { ok: true }));
  const c2 = client.createConsoleClient({ fetch: later.fn });
  await c2.summary();
  assert.ok(!JSON.stringify(later.calls).includes(credential));
  assert.ok(!JSON.stringify(Object.entries(c)).includes(credential), "no credential kept on the client object");
  assert.ok(!JSON.stringify(calls[0].init.headers).includes(credential), "never sent as a header");
});

// ------------------------------------------------------------------ deep links

test("deep links map 1:1 to existing Console routes", () => {
  const map: [string, string][] = [
    ["shashtna-console://admin", "https://shashtna.netlify.app/admin"],
    ["shashtna-console://admin/operations?queue=payments", "https://shashtna.netlify.app/admin/operations?queue=payments"],
    ["shashtna-console://admin/orders/42", "https://shashtna.netlify.app/admin/orders/42"],
    ["shashtna-console://admin/orders/SH-000042", "https://shashtna.netlify.app/admin/orders/42"],
    ["shashtna-console://admin/customers/123", "https://shashtna.netlify.app/admin/customers/123"],
    ["shashtna-console://admin/support/0f8fad5b-d9cb-469f-a165-70867728950e", "https://shashtna.netlify.app/admin/support/0f8fad5b-d9cb-469f-a165-70867728950e"],
    ["shashtna-console://admin/intelligence/revenue?period=last30&evil=<x>", "https://shashtna.netlify.app/admin/intelligence/revenue?period=last30"],
  ];
  for (const [link, web] of map) assert.equal(links.deepLinkToWebUrl(link), web, link);
  assert.equal(links.webUrlToDeepLink("https://shashtna.netlify.app/admin/customers/7?period=last30"), "shashtna-console://admin/customers/7?period=last30");
  assert.equal(links.webUrlToDeepLink("https://shashtna.netlify.app/admin"), "shashtna-console://admin");
});

test("deep links reject other schemes, unknown routes, traversal, bad ids and foreign origins", () => {
  for (const bad of ["shashtna://admin", "https://shashtna.netlify.app/admin", "shashtna-console://admin/nope", "shashtna-console://admin/../etc/passwd", "shashtna-console://admin/orders/0", "shashtna-console://admin/orders/abc", "shashtna-console://admin/customers/1.5", "shashtna-console://user:pw@admin", "shashtna-console://dashboard", "not a url", ""]) {
    assert.equal(links.deepLinkToWebUrl(bad), null, bad);
  }
  assert.equal(links.webUrlToDeepLink("https://evil.example/admin/orders/1"), null);
  assert.equal(links.webUrlToDeepLink("https://shashtna.netlify.app/dashboard"), null, "customer pages are not Console destinations");
});

test("every mapped route exists as a page", async () => {
  const { existsSync } = await import("node:fs");
  for (const route of links.CONSOLE_ROUTES) {
    const dir = route.pattern.replace(/:uuid|:id/g, "[id]");
    assert.ok(existsSync(`app${dir}/page.tsx`), `app${dir}/page.tsx`);
  }
});

test("the Android shell's route table is generated from console-links (not hand-copied)", async () => {
  const { readFileSync } = await import("node:fs");
  const { consoleRoutesFile } = await import("@/scripts/console-routes");
  const asset = readFileSync("shells/mobile/android/app/src/main/assets/console-routes.txt", "utf8");
  assert.equal(asset, consoleRoutesFile(), "run `npm run routes` in shells/mobile");
  assert.equal(asset.match(/^route /gm)?.length, links.CONSOLE_ROUTES.length);
  assert.ok(asset.includes(`origin ${api.CONSOLE_ORIGIN}\n`) && asset.includes(`scheme ${api.CONSOLE_URL_SCHEME}\n`));
});
