import { toDate } from "@/src/lib/i18n";

/**
 * Promotions & content console — pure parts (unit-tested). Content lives in
 * the existing Announcement records and the existing Notification table;
 * these helpers only describe where each placement is shown, parse the
 * console's URL state and validate form values strictly (no silent defaults).
 */

export const OFFER_KINDS = ["AD", "OFFER"] as const;
export const NEWS_KINDS = ["NEWS", "ANNOUNCEMENT"] as const;
export const CONTENT_GROUPS = { all: [...OFFER_KINDS, ...NEWS_KINDS], offers: OFFER_KINDS, announcements: NEWS_KINDS } as const;
export type ContentGroup = keyof typeof CONTENT_GROUPS;

/**
 * Where each placement is rendered on the website — taken from the public
 * consumers (src/server/promotions.ts and the pages calling
 * getLiveAnnouncements). null = no website page renders it.
 */
export const PLACEMENT_WEBSITE: Record<string, string | null> = {
  HERO_EDITORIAL: "/ — hero offers & news board",
  HOME_CAROUSEL: "/ — hero board (after HERO_EDITORIAL items)",
  HOME_LATEST: "/ — latest announcements",
  ENTRY_GUEST: "entry screen — guests & expired",
  ENTRY_MEMBER: "entry screen — members",
  DASHBOARD: "/dashboard — customer notices",
  BANNER: null,
};

/**
 * Surfaces an item reaches. Shashtna Player reads every live item whose
 * target isn't WEBSITE (/api/announcements?surface=PLAYER), whatever the
 * placement. News/announcements outside the reserved placements also feed
 * the home "latest" list (latestItems()).
 */
export function surfacesOf(item: { placement: string; target: string; kind: string }) {
  const target = item.target.toUpperCase();
  const onWebsite = target !== "PLAYER";
  const latest = onWebsite && (item.kind === "NEWS" || item.kind === "ANNOUNCEMENT") && !["HERO_EDITORIAL", "ENTRY_GUEST", "ENTRY_MEMBER", "DASHBOARD", "HOME_LATEST"].includes(item.placement);

  return {
    website: [onWebsite ? (PLACEMENT_WEBSITE[item.placement] ?? null) : null, latest ? "/ — latest announcements" : null].filter((value): value is string => Boolean(value)),
    player: target !== "WEBSITE",
  };
}

export const LIFECYCLE_VIEWS = ["all", "live", "scheduled", "ended", "inactive", "ending"] as const;
export type LifecycleView = (typeof LIFECYCLE_VIEWS)[number];
export type Lifecycle = "LIVE" | "SCHEDULED" | "ENDED" | "INACTIVE";

/** "Ending soon": live and ending within this many days. */
export const ENDING_SOON_DAYS = 7;

export function matchesView(view: LifecycleView, lifecycle: Lifecycle, endsAt: number | null, now = Date.now()) {
  switch (view) {
    case "live":
      return lifecycle === "LIVE";
    case "scheduled":
      return lifecycle === "SCHEDULED";
    case "ended":
      return lifecycle === "ENDED";
    case "inactive":
      return lifecycle === "INACTIVE";
    case "ending":
      return lifecycle === "LIVE" && endsAt !== null && endsAt - now <= ENDING_SOON_DAYS * 86_400_000;
    default:
      return true;
  }
}

export type ContentQuery = { q: string; view: LifecycleView; placement: string; audience: string; page: number };

export function parseContentQuery(params: { q?: string; view?: string; placement?: string; audience?: string; page?: string }, placements: readonly string[], audiences: readonly string[]): ContentQuery {
  const page = Number(params.page);
  const upper = (value: unknown) => String(value ?? "").trim().toUpperCase();

  return {
    q: String(params.q ?? "").trim().slice(0, 80),
    view: LIFECYCLE_VIEWS.find((view) => view === params.view) ?? "all",
    placement: placements.includes(upper(params.placement)) ? upper(params.placement) : "all",
    audience: audiences.includes(upper(params.audience)) ? upper(params.audience) : "all",
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

/** Free-text over title / description / highlight / CTA, or #id. */
export function matchesContent(q: string, item: { id: number; title: string; description: string | null; highlight?: string | null; ctaLabel?: string | null }) {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  if (/^#\d+$/.test(needle)) return item.id === Number(needle.slice(1));

  return [item.title, item.description, item.highlight, item.ctaLabel].some((field) => String(field ?? "").toLowerCase().includes(needle));
}

/**
 * Strict choice: empty → the default; a value outside the allowed list is an
 * error (returned as null), never silently replaced by the default.
 */
export function strictChoice<T extends string>(raw: unknown, allowed: readonly T[], fallback: T): T | null {
  const value = String(raw ?? "").trim().toUpperCase();
  if (!value) return fallback;

  return (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

/** Whole-number priority in −100…100; empty → 0; anything else → null (invalid). */
export function strictPriority(raw: unknown): number | null {
  const text = String(raw ?? "").trim();
  if (!text) return 0;
  if (!/^-?\d+$/.test(text)) return null;
  const value = Number(text);

  return value >= -100 && value <= 100 ? value : null;
}

/** Links staff may attach: site paths ("/plans") or https URLs. */
export function isSafeLink(value: string) {
  return /^https:\/\//.test(value) || (value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\"));
}

/** Internal site path only (notifications open inside the customer's account). */
export function isInternalPath(value: string) {
  return value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\");
}

/** A stored instant as the value of a datetime-local input (server local time, as the editor has always used). */
export function toLocalInput(value: string | null) {
  const date = toDate(value);

  if (!date) {
    return "";
  }

  const pad = (number: number) => String(number).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
