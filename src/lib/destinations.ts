/**
 * Where a notification (in-app or push) takes the customer.
 *
 * Notifications store their destination as an internal website path in
 * `Notification.link`, so the website keeps working unchanged. The mobile app
 * never opens that string as a URL: it parses it with `parseDestination` into
 * one of the typed destinations below and ignores anything else. Only paths
 * built by `destinationLink` (or the fixed paths the backend already uses)
 * are accepted.
 */

export const DESTINATION_KINDS = [
  "HOME",
  "PLANS",
  "PLAN",
  "ANNOUNCEMENT",
  "ORDERS",
  "ORDER",
  "SUBSCRIPTIONS",
  "SUBSCRIPTION",
  "SUPPORT",
  "TICKET",
  "STATUS",
  "NOTIFICATIONS",
] as const;

export type DestinationKind = (typeof DESTINATION_KINDS)[number];

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

/** Destinations that point at one customer's own record. */
export const PERSONAL_DESTINATIONS: readonly DestinationKind[] = ["ORDER", "SUBSCRIPTION", "TICKET"];

export const DESTINATION_LABELS: Record<DestinationKind, { ar: string; en: string; param?: "id" | "slug" | "ticket" }> = {
  HOME: { ar: "الرئيسية (حسابي)", en: "Home (dashboard)" },
  PLANS: { ar: "الباقات", en: "Plans" },
  PLAN: { ar: "باقة محددة", en: "A specific plan", param: "slug" },
  ANNOUNCEMENT: { ar: "إعلان / عرض", en: "Announcement / offer", param: "id" },
  ORDERS: { ar: "طلباتي", en: "My orders" },
  ORDER: { ar: "طلب محدد", en: "A specific order", param: "id" },
  SUBSCRIPTIONS: { ar: "اشتراكاتي", en: "My subscriptions" },
  SUBSCRIPTION: { ar: "اشتراك محدد", en: "A specific subscription", param: "id" },
  SUPPORT: { ar: "الدعم الفني", en: "Support" },
  TICKET: { ar: "تذكرة دعم محددة", en: "A specific ticket", param: "ticket" },
  STATUS: { ar: "حالة الخدمة", en: "Service status" },
  NOTIFICATIONS: { ar: "الإشعارات", en: "Notifications" },
};

const SLUG = /^[a-z0-9][a-z0-9-]{0,79}$/i;
const TICKET_ID = /^[A-Za-z0-9_-]{1,80}$/;

function positiveId(value: unknown) {
  const text = String(value ?? "").trim();

  if (!/^\d{1,9}$/.test(text)) {
    return null;
  }

  const id = Number(text);
  return id > 0 ? id : null;
}

/** Builds a destination from untrusted form input; null when invalid. */
export function makeDestination(kind: unknown, param?: unknown): Destination | null {
  const value = String(kind ?? "").trim().toUpperCase() as DestinationKind;

  switch (value) {
    case "HOME":
    case "PLANS":
    case "ORDERS":
    case "SUBSCRIPTIONS":
    case "SUPPORT":
    case "STATUS":
    case "NOTIFICATIONS":
      return { kind: value };
    case "PLAN": {
      const slug = String(param ?? "").trim();
      return SLUG.test(slug) ? { kind: "PLAN", slug } : null;
    }
    case "ANNOUNCEMENT":
    case "ORDER":
    case "SUBSCRIPTION": {
      const id = positiveId(param);
      return id ? { kind: value, id } : null;
    }
    case "TICKET": {
      const id = String(param ?? "").trim();
      return TICKET_ID.test(id) ? { kind: "TICKET", id } : null;
    }
    default:
      return null;
  }
}

/** The internal website path stored in `Notification.link`. */
export function destinationLink(destination: Destination): string {
  switch (destination.kind) {
    case "HOME":
      return "/dashboard";
    case "PLANS":
      return "/plans";
    case "PLAN":
      return `/checkout?plan=${encodeURIComponent(destination.slug)}`;
    case "ANNOUNCEMENT":
      return `/announcements/${destination.id}`;
    case "ORDERS":
      return "/orders";
    case "ORDER":
      return `/orders/${destination.id}`;
    case "SUBSCRIPTIONS":
      return "/subscriptions";
    case "SUBSCRIPTION":
      return `/subscriptions/${destination.id}`;
    case "SUPPORT":
      return "/support";
    case "TICKET":
      return `/support/${encodeURIComponent(destination.id)}`;
    case "STATUS":
      return "/status";
    case "NOTIFICATIONS":
      return "/notifications";
  }
}

/**
 * Parses a stored link back into a typed destination. Anything that is not
 * one of the known internal paths (external URLs, protocol-relative URLs,
 * unknown paths) returns null.
 */
export function parseDestination(link: unknown): Destination | null {
  const raw = String(link ?? "").trim();

  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\") || raw.length > 300) {
    return null;
  }

  let url: URL;

  try {
    url = new URL(raw, "https://shashtna.invalid");
  } catch {
    return null;
  }

  if (url.origin !== "https://shashtna.invalid") {
    return null;
  }

  const parts = url.pathname.split("/").filter(Boolean).map((part) => {
    try {
      return decodeURIComponent(part);
    } catch {
      return "\u0000";
    }
  });

  const [head, second, ...rest] = parts;

  if (rest.length) {
    return null;
  }

  switch (head) {
    case undefined:
    case "dashboard":
      return second === undefined ? { kind: "HOME" } : null;
    case "plans":
      return second === undefined ? { kind: "PLANS" } : null;
    case "checkout": {
      const plan = url.searchParams.get("plan");
      return second === undefined && plan ? makeDestination("PLAN", plan) : second === undefined ? { kind: "PLANS" } : null;
    }
    case "announcements":
      return second === undefined ? null : makeDestination("ANNOUNCEMENT", second);
    case "orders":
      return second === undefined ? { kind: "ORDERS" } : makeDestination("ORDER", second);
    case "subscriptions":
      return second === undefined ? { kind: "SUBSCRIPTIONS" } : makeDestination("SUBSCRIPTION", second);
    case "support":
      return second === undefined ? { kind: "SUPPORT" } : second === "new" ? { kind: "SUPPORT" } : makeDestination("TICKET", second);
    case "status":
      return second === undefined ? { kind: "STATUS" } : null;
    case "notifications":
      return second === undefined ? { kind: "NOTIFICATIONS" } : null;
    default:
      return null;
  }
}

/** Normalizes a link: returns the canonical path for a valid destination, else null. */
export function safeNotificationLink(link: unknown) {
  const destination = parseDestination(link);
  return destination ? destinationLink(destination) : null;
}
