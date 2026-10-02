/**
 * Console deep-link contract (pure, unit-tested). Phase 10C/10D consume it;
 * nothing here registers a scheme or handles intents yet.
 *
 * The canonical form of every Console destination is its web URL on the
 * Console origin (https://shashtna.netlify.app/admin/...). The custom
 * scheme is a 1:1 alias of the path:
 *
 *   shashtna-console://admin/orders/42  ⇄  https://shashtna.netlify.app/admin/orders/42
 *
 * Only routes that exist in app/admin are listed. Anything else maps to
 * null and the shell opens the Console home instead. Links carry ids only,
 * never data; the destination page performs the normal permission check,
 * so a link to a section the role can't open shows "no permission".
 */

import { CONSOLE_ORIGIN, CONSOLE_URL_SCHEME } from "@/src/lib/console-api";
import { parseOrderNumber } from "@/src/lib/order-status";

type Param = "id" | "uuid";

/** Console destinations (paths as in app/admin). `:id` = positive integer, `:uuid` = support ticket id. */
export const CONSOLE_ROUTES: readonly { pattern: string; params?: Param[] }[] = [
  { pattern: "/admin" },
  { pattern: "/admin/operations" },
  { pattern: "/admin/orders" },
  { pattern: "/admin/orders/:id", params: ["id"] },
  { pattern: "/admin/activations" },
  { pattern: "/admin/renewals" },
  { pattern: "/admin/customers" },
  { pattern: "/admin/customers/:id", params: ["id"] },
  { pattern: "/admin/subscriptions" },
  { pattern: "/admin/lookup" },
  { pattern: "/admin/password-resets" },
  { pattern: "/admin/support" },
  { pattern: "/admin/support/:uuid", params: ["uuid"] },
  { pattern: "/admin/leads" },
  { pattern: "/admin/catalogue" },
  { pattern: "/admin/catalogue/packages" },
  { pattern: "/admin/catalogue/packages/:id", params: ["id"] },
  { pattern: "/admin/catalogue/devices" },
  { pattern: "/admin/catalogue/devices/:id", params: ["id"] },
  { pattern: "/admin/catalogue/compatibility" },
  { pattern: "/admin/apps" },
  { pattern: "/admin/promotions" },
  { pattern: "/admin/promotions/offers" },
  { pattern: "/admin/promotions/announcements" },
  { pattern: "/admin/promotions/content" },
  { pattern: "/admin/promotions/media" },
  { pattern: "/admin/promotions/notifications" },
  { pattern: "/admin/promotions/items/:id", params: ["id"] },
  { pattern: "/admin/status" },
  { pattern: "/admin/finance" },
  { pattern: "/admin/finance/expenses" },
  { pattern: "/admin/finance/reports" },
  { pattern: "/admin/finance/reports/:id", params: ["id"] },
  { pattern: "/admin/intelligence" },
  { pattern: "/admin/intelligence/revenue" },
  { pattern: "/admin/intelligence/customers" },
  { pattern: "/admin/intelligence/subscriptions" },
  { pattern: "/admin/intelligence/products" },
  { pattern: "/admin/intelligence/operations" },
  { pattern: "/admin/intelligence/promotions" },
  { pattern: "/admin/intelligence/analyst" },
  { pattern: "/admin/intelligence/analyst/:id", params: ["id"] },
  { pattern: "/admin/reports" },
  { pattern: "/admin/security" },
  { pattern: "/admin/system" },
  { pattern: "/admin/system/staff" },
  { pattern: "/admin/system/roles" },
  { pattern: "/admin/system/security" },
  { pattern: "/admin/system/settings" },
  { pattern: "/admin/audit" },
];

/** Query parameters the Console pages read (filters, periods); everything else is dropped. */
export const CONSOLE_QUERY_KEYS = ["queue", "period", "from", "to", "view", "q", "status", "page", "scope"] as const;

const ID = /^[1-9]\d{0,9}$/;
const UUID = /^[A-Za-z0-9-]{8,64}$/;

/** The canonical /admin path for a candidate path, or null if it isn't a Console destination. */
export function canonicalConsolePath(path: string): string | null {
  const clean = path.replace(/\/+$/, "") || "/";
  if (clean.includes("..") || clean.includes("//")) return null;
  const parts = clean.split("/");

  for (const route of CONSOLE_ROUTES) {
    const pattern = route.pattern.split("/");
    if (pattern.length !== parts.length) continue;

    const out: string[] = [];
    let ok = true;
    for (let i = 0; i < pattern.length && ok; i += 1) {
      const want = pattern[i];
      const got = parts[i];
      if (want === ":id") {
        // Orders also accept the customer-facing number (SH-000042).
        const id = route.pattern.startsWith("/admin/orders/") ? parseOrderNumber(got) : ID.test(got) ? Number(got) : null;
        ok = id !== null && ID.test(String(id));
        out.push(String(id));
      } else if (want === ":uuid") {
        ok = UUID.test(got);
        out.push(got);
      } else {
        ok = want === got;
        out.push(got);
      }
    }
    if (ok) return out.join("/");
  }

  return null;
}

function keepQuery(search: URLSearchParams) {
  const kept = new URLSearchParams();
  for (const key of CONSOLE_QUERY_KEYS) {
    const value = search.get(key);
    if (value !== null && value.length <= 100) kept.set(key, value);
  }
  const text = kept.toString();

  return text ? `?${text}` : "";
}

/**
 * shashtna-console://admin/orders/42?queue=payments → "/admin/orders/42?queue=payments".
 * Null for another scheme, an unknown route or a malformed link.
 */
export function deepLinkToConsolePath(link: string): string | null {
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return null;
  }
  if (url.protocol !== `${CONSOLE_URL_SCHEME}:` || url.username || url.password || url.port) return null;

  const path = canonicalConsolePath(`/${url.hostname}${url.pathname === "/" ? "" : url.pathname}`);

  return path ? `${path}${keepQuery(url.searchParams)}` : null;
}

/** The canonical web URL for a deep link (what the shell actually loads), or null. */
export function deepLinkToWebUrl(link: string, origin: string = CONSOLE_ORIGIN): string | null {
  const path = deepLinkToConsolePath(link);

  return path ? `${origin}${path}` : null;
}

/** A Console web URL (on the Console origin) → its deep link, or null for anything else. */
export function webUrlToDeepLink(webUrl: string, origin: string = CONSOLE_ORIGIN): string | null {
  let url: URL;
  try {
    url = new URL(webUrl);
  } catch {
    return null;
  }
  if (url.origin !== new URL(origin).origin) return null;

  const path = canonicalConsolePath(url.pathname);

  return path ? `${CONSOLE_URL_SCHEME}://${path.slice(1)}${keepQuery(url.searchParams)}` : null;
}
