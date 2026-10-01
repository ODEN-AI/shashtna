import assert from "node:assert/strict";
import { test } from "node:test";

const sw = await import("@/src/lib/console-sw");
const { adminFetch, CONSOLE_MESSAGES } = await import("@/app/components/admin/adminFetch");

const ORIGIN = "https://shashtna.example";
const policy = (path: string, method = "GET", mode = "cors") => sw.consolePolicy(`${ORIGIN}${path}`, method, mode, ORIGIN);

test("service worker caches only public, hashed shell files", () => {
  assert.equal(policy("/_next/static/chunks/app-abc123.js"), "static");
  assert.equal(policy("/_next/static/css/def456.css"), "static");
  assert.equal(policy("/console/offline.html"), "static");
  assert.equal(policy("/console/icon-192.png"), "static");
  // Query strings are never cached, even on static paths.
  assert.equal(policy("/_next/static/chunks/app.js?v=1"), "bypass");
});

test("service worker never caches pages, data, APIs, uploads or proofs", () => {
  for (const path of [
    "/api/admin/customers",
    "/api/admin/stats",
    "/api/orders/12/payment-proof",
    "/api/uploads/media/abc",
    "/uploads/media/x.png",
    "/admin/finance?_rsc=1a2b",
    "/admin/orders/5",
    "/_next/image?url=%2Fx.png&w=640",
    "/admin/manifest.webmanifest",
    "/",
    "/dashboard",
  ]) {
    assert.equal(policy(path), "bypass", path);
  }
  // Mutations (server actions, API writes) are never intercepted.
  assert.equal(policy("/admin/finance", "POST", "navigate"), "bypass");
  assert.equal(policy("/_next/static/chunks/a.js", "POST"), "bypass");
  // Other origins are never touched.
  assert.equal(sw.consolePolicy("https://cdn.jsdelivr.net/x.css", "GET", "cors", ORIGIN), "bypass");
});

test("console page loads go to the network (offline page only on failure); site pages are untouched", () => {
  assert.equal(policy("/admin", "GET", "navigate"), "navigate");
  assert.equal(policy("/admin/finance?period=month", "GET", "navigate"), "navigate");
  assert.equal(policy("/administrator", "GET", "navigate"), "bypass");
  assert.equal(policy("/plans", "GET", "navigate"), "bypass");
});

test("the generated worker script is valid JavaScript and embeds the same policy", () => {
  const source = sw.consoleWorkerSource();
  // Parses (throws on a syntax error) without running it.
  new Function("self", "caches", "fetch", "Response", source);
  assert.match(source, /shashtna-console-v1/);
  assert.match(source, /\/console\/offline\.html/);
  assert.doesNotMatch(source, /\/api\//);
});

test("adminFetch turns technical failures into readable messages", async () => {
  const original = globalThis.fetch;

  try {
    globalThis.fetch = async () => {
      throw new TypeError("Failed to fetch");
    };
    await assert.rejects(adminFetch("/api/admin/packages"), { message: CONSOLE_MESSAGES.network });

    globalThis.fetch = async () => new Response("<html>Internal Server Error</html>", { status: 500, headers: { "content-type": "text/html" } });
    const server = await adminFetch("/api/admin/packages");
    assert.equal(server.status, 500);
    assert.deepEqual(await server.json(), { success: false, message: CONSOLE_MESSAGES.server, error: CONSOLE_MESSAGES.server });

    globalThis.fetch = async () => new Response("", { status: 401 });
    assert.equal((await (await adminFetch("/api/admin/packages")).json()).message, CONSOLE_MESSAGES.unauthenticated);

    globalThis.fetch = async () => new Response("", { status: 403 });
    assert.equal((await (await adminFetch("/api/admin/packages")).json()).message, CONSOLE_MESSAGES.forbidden);

    // JSON API errors keep the API's own message.
    globalThis.fetch = async () => Response.json({ success: false, message: "الحالة المطلوبة غير مسموحة." }, { status: 400 });
    assert.equal((await (await adminFetch("/api/admin/packages")).json()).message, "الحالة المطلوبة غير مسموحة.");
  } finally {
    globalThis.fetch = original;
  }
});
