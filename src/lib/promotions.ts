/**
 * Website promotions — the shared vocabulary and the pure selection rules for
 * the editorial hero board and the full-screen entry experiences (guest /
 * expired promotion and active-member spotlight). Server code builds the
 * candidates from real records; this module only filters and orders them,
 * so it can run on the server and in the browser and is unit-tested.
 *
 * Content lives in the existing Announcement records (Admin → Ads &
 * announcements). These placements are website surfaces; they never reach
 * Shashtna Player or the mobile app feeds (their `target` is forced to
 * WEBSITE when saved).
 */

export const EDITORIAL_KINDS = ["AD", "OFFER", "NEWS", "ANNOUNCEMENT"] as const;
export type EditorialKind = (typeof EDITORIAL_KINDS)[number];

/** Website-only placements added alongside HOME_CAROUSEL / BANNER / DASHBOARD. */
export const WEBSITE_PLACEMENTS = ["HERO_EDITORIAL", "HOME_LATEST", "ENTRY_GUEST", "ENTRY_MEMBER"] as const;
export type WebsitePlacement = (typeof WEBSITE_PLACEMENTS)[number];

export const AUDIENCES = ["ALL", "GUEST", "EXPIRED", "ACTIVE", "EXPIRING", "VIP"] as const;
export type Audience = (typeof AUDIENCES)[number];

export const MEDIA_TYPES = ["IMAGE", "VIDEO"] as const;
export type MediaType = (typeof MEDIA_TYPES)[number];

/** Who is looking, derived from the account state (see subscription-state.ts). */
export type Viewer = {
  state: "GUEST" | "NONE" | "PENDING" | "EXPIRED" | "ACTIVE" | "EXPIRING";
  vip: boolean;
};

export function isMember(viewer: Viewer) {
  return viewer.state === "ACTIVE" || viewer.state === "EXPIRING";
}

/** Whether a record's audience includes this viewer. Unknown audiences match nobody. */
export function audienceMatches(audience: string | null | undefined, viewer: Viewer) {
  switch (String(audience ?? "ALL").toUpperCase()) {
    case "ALL":
      return true;
    case "GUEST":
      // Visitors and signed-in customers who have never subscribed.
      return viewer.state === "GUEST" || viewer.state === "NONE" || viewer.state === "PENDING";
    case "EXPIRED":
      return viewer.state === "EXPIRED";
    case "ACTIVE":
      return isMember(viewer);
    case "EXPIRING":
      return viewer.state === "EXPIRING";
    case "VIP":
      return isMember(viewer) && viewer.vip;
    default:
      return false;
  }
}

/** Live on the schedule right now (inactive, not started or ended → false). */
export function isScheduledLive(item: { isActive: boolean; startsAt: string | null; endsAt: string | null }, now = Date.now()) {
  if (!item.isActive) {
    return false;
  }

  const time = (value: string | null) => {
    if (!value) {
      return undefined;
    }

    const parsed = new Date(String(value).replace(" ", "T")).getTime();

    return Number.isFinite(parsed) ? parsed : undefined;
  };
  const starts = time(item.startsAt);
  const ends = time(item.endsAt);

  return (starts === undefined || starts <= now) && (ends === undefined || ends >= now);
}

/** Video only when the record says VIDEO and has a usable video URL. */
export function mediaOf(item: { mediaType?: string | null; videoUrl?: string | null; imageUrl?: string | null }) {
  const video = String(item.mediaType ?? "").toUpperCase() === "VIDEO" && item.videoUrl ? item.videoUrl : null;

  return { type: (video ? "VIDEO" : "IMAGE") as MediaType, videoUrl: video, imageUrl: item.imageUrl ?? null };
}

// ------------------------------------------------------------ entry experiences

export type EntryTone = "brand" | "vip" | "warning" | "danger" | "success" | "info";

export type EntryItem = {
  key: string;
  /** Where it came from — for tests and analytics, never shown. */
  source: "admin" | "package" | "device" | "incident" | "renewal" | "order" | "onboarding" | "upgrade" | "news";
  /** Urgent member items (incident, renewal, unpaid order) always come first. */
  urgent?: boolean;
  eyebrow: string;
  title: string;
  body: string | null;
  facts: string[];
  price: string | null;
  priceNote: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
  visual: "iptv" | "vip" | "device" | "player" | "offer" | "status" | "renewal" | "order";
  tone: EntryTone;
  cta: { label: string; href: string; external?: boolean } | null;
};

export type EntryPayload =
  | { mode: "none" }
  | { mode: "guest"; items: EntryItem[] }
  | { mode: "member"; items: EntryItem[] };

export type EntryHistory = { recent: string[]; sessions: number };

export const EMPTY_ENTRY_HISTORY: EntryHistory = { recent: [], sessions: 0 };
const RECENT_LIMIT = 12;

export function sanitizeHistory(value: unknown): EntryHistory {
  const raw = value as Partial<EntryHistory> | null;

  return {
    recent: Array.isArray(raw?.recent) ? raw.recent.filter((key): key is string => typeof key === "string").slice(0, RECENT_LIMIT) : [],
    sessions: typeof raw?.sessions === "number" && Number.isFinite(raw.sessions) ? Math.max(0, Math.floor(raw.sessions)) : 0,
  };
}

/** Least recently shown first; never-shown items keep their priority order. */
export function byFreshness<T extends { key: string }>(items: T[], recent: string[]) {
  const rank = (item: T) => {
    const position = recent.indexOf(item.key);

    return position === -1 ? Number.MAX_SAFE_INTEGER : position;
  };

  return items
    .map((item, order) => ({ item, order, rank: rank(item) }))
    .sort((a, b) => b.rank - a.rank || a.order - b.order)
    .map((entry) => entry.item);
}

/**
 * This session's entry experience. Guests / expired: the least recently shown
 * promotion. Members: urgent items first (in the order given), otherwise the
 * least recently shown of the rest; up to two further items ride along as
 * secondary cards. The shown keys go to the front of the history.
 */
export function planEntry(payload: EntryPayload, history: EntryHistory = EMPTY_ENTRY_HISTORY) {
  const sessions = history.sessions + 1;

  if (payload.mode === "none" || !payload.items.length) {
    return { plan: null, history: { ...history, sessions } };
  }

  let primary: EntryItem;
  let rest: EntryItem[];

  if (payload.mode === "member") {
    const urgent = payload.items.filter((item) => item.urgent);
    const others = byFreshness(
      payload.items.filter((item) => !item.urgent),
      history.recent,
    );

    primary = urgent[0] ?? others[0];
    rest = [...urgent.slice(1), ...others.filter((item) => item !== primary)];
  } else {
    const ordered = byFreshness(payload.items, history.recent);

    primary = ordered[0];
    rest = [];
  }

  const secondary = rest.slice(0, 2);
  const shown = [primary.key];
  const recent = [...shown, ...history.recent.filter((key) => !shown.includes(key))].slice(0, RECENT_LIMIT);

  return { plan: { mode: payload.mode, primary, secondary }, history: { recent, sessions } };
}

/** Pages where an entry experience must never interrupt (forms, payment, auth). */
export function isQuietPath(pathname: string) {
  return ["/checkout", "/login", "/register", "/forgot-password", "/reset-password"].some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}
