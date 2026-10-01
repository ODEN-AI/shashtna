/**
 * Shashtna Console service worker — caching policy.
 *
 * The console is an online management tool. The worker caches ONLY the
 * app shell's public, immutable files (hashed /_next/static assets, the
 * console icons and the offline page). It never stores a page, an RSC
 * payload, an API response, a server action, an upload or a payment proof:
 *  - "static"   → cache-first (public, content-hashed files only)
 *  - "navigate" → network-only; if the network fails, the offline page
 *  - "bypass"   → the worker does not touch the request at all
 *
 * `consolePolicy` must stay self-contained (no imports, no outer
 * references): its source is inlined into the worker script.
 */
export type ConsolePolicy = "static" | "navigate" | "bypass";

export function consolePolicy(url: string, method: string, mode: string, origin: string): ConsolePolicy {
  if (method !== "GET") return "bypass";

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "bypass";
  }

  if (parsed.origin !== origin) return "bypass";
  // Hashed build assets and the console's own public files only.
  if (parsed.pathname.startsWith("/_next/static/") && !parsed.search) return "static";
  if (parsed.pathname.startsWith("/console/") && !parsed.search) return "static";
  // Full page loads inside the console: always from the network.
  if (mode === "navigate" && (parsed.pathname === "/admin" || parsed.pathname.startsWith("/admin/"))) return "navigate";

  return "bypass";
}

/** Bump to drop every previously cached shell file on the next activation. */
export const CONSOLE_CACHE_VERSION = "shashtna-console-v1";
export const CONSOLE_OFFLINE_URL = "/console/offline.html";
export const CONSOLE_PRECACHE = [CONSOLE_OFFLINE_URL, "/console/icon-192.png"];
const MAX_STATIC_ENTRIES = 250;

/** The worker script served at /admin/sw.js. */
export function consoleWorkerSource() {
  return `/* Shashtna Console service worker — app shell only. Never caches pages, data or API responses. */
"use strict";
const CACHE = ${JSON.stringify(CONSOLE_CACHE_VERSION)};
const OFFLINE_URL = ${JSON.stringify(CONSOLE_OFFLINE_URL)};
const PRECACHE = ${JSON.stringify(CONSOLE_PRECACHE)};
const MAX_STATIC_ENTRIES = ${MAX_STATIC_ENTRIES};
const consolePolicy = ${consolePolicy.toString()};

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("shashtna-console-") && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "CLEAR_CACHE") {
    event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith("shashtna-console-")).map((key) => caches.delete(key)))));
  }
});

function cacheable(response) {
  if (!response || !response.ok || response.type !== "basic") return false;
  const control = (response.headers.get("cache-control") || "").toLowerCase();
  return !control.includes("no-store") && !control.includes("private");
}

async function trim(cache) {
  const keys = await cache.keys();
  for (const key of keys.slice(0, Math.max(0, keys.length - MAX_STATIC_ENTRIES))) {
    if (!PRECACHE.some((path) => key.url.endsWith(path))) await cache.delete(key);
  }
}

async function fromCacheFirst(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (cacheable(response)) {
    await cache.put(request, response.clone());
    trim(cache);
  }
  return response;
}

async function networkOrOffline(request) {
  try {
    return await fetch(request);
  } catch (error) {
    const offline = await caches.match(OFFLINE_URL);
    return offline || Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const policy = consolePolicy(request.url, request.method, request.mode, self.location.origin);
  if (policy === "static") event.respondWith(fromCacheFirst(request));
  else if (policy === "navigate") event.respondWith(networkOrOffline(request));
  // "bypass": not handled — the browser fetches it normally and nothing is stored.
});
`;
}
