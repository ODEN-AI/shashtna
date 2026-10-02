/**
 * Where a notification or an ad's call-to-action takes the app.
 *
 * The website stores destinations as internal paths (`Notification.link`,
 * `Announcement.ctaUrl`). The app never opens those strings as URLs: they are
 * parsed here into one of the typed destinations its router knows, and
 * anything else becomes null (an https CTA is sent separately as an
 * external URL the app opens in the browser).
 */

export type Destination =
  | { kind: "HOME" }
  | { kind: "PLANS" }
  | { kind: "PLAN"; slug: string }
  | { kind: "ANNOUNCEMENT"; id: number }
  | { kind: "ORDERS" }
  | { kind: "ORDER"; id: number }
  | { kind: "SUBSCRIPTIONS" }
  | { kind: "SUBSCRIPTION"; id: number }
  | { kind: "SUPPORT" }
  | { kind: "TICKET"; id: string }
  | { kind: "STATUS" }
  | { kind: "NOTIFICATIONS" };

const SLUG = /^[a-z0-9][a-z0-9-]{0,79}$/i;
const TICKET_ID = /^[A-Za-z0-9_-]{1,80}$/;

function positiveId(value: string | undefined) {
  if (!value || !/^\d{1,9}$/.test(value)) return null;
  const id = Number(value);
  return id > 0 ? id : null;
}

export function parseDestination(link: unknown): Destination | null {
  const raw = String(link ?? "").trim();

  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\") || raw.length > 300) return null;

  let url: URL;
  try {
    url = new URL(raw, "https://shashtna.invalid");
  } catch {
    return null;
  }
  if (url.origin !== "https://shashtna.invalid") return null;

  const parts = url.pathname
    .split("/")
    .filter(Boolean)
    .map((part) => {
      try {
        return decodeURIComponent(part);
      } catch {
        return "\u0000";
      }
    });
  const [head, second, ...rest] = parts;
  if (rest.length) return null;

  const id = positiveId(second);

  switch (head) {
    case undefined:
    case "dashboard":
      return second === undefined ? { kind: "HOME" } : null;
    case "plans":
    case "devices":
      return second === undefined ? { kind: "PLANS" } : null;
    case "checkout": {
      if (second !== undefined) return null;
      const plan = url.searchParams.get("plan") ?? "";
      return SLUG.test(plan) ? { kind: "PLAN", slug: plan } : { kind: "PLANS" };
    }
    case "announcements":
      return id ? { kind: "ANNOUNCEMENT", id } : null;
    case "orders":
      return second === undefined ? { kind: "ORDERS" } : id ? { kind: "ORDER", id } : null;
    case "subscriptions":
      return second === undefined ? { kind: "SUBSCRIPTIONS" } : id ? { kind: "SUBSCRIPTION", id } : null;
    case "support":
    case "help":
      if (second === undefined || second === "new" || head === "help") return { kind: "SUPPORT" };
      return TICKET_ID.test(second) ? { kind: "TICKET", id: second } : null;
    case "status":
      return second === undefined ? { kind: "STATUS" } : null;
    case "notifications":
      return second === undefined ? { kind: "NOTIFICATIONS" } : null;
    default:
      return null;
  }
}
