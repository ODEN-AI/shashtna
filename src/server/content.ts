import { db } from "@/src/prisma/db";
import { toDate } from "@/src/lib/i18n";

export const ANNOUNCEMENT_TARGETS = ["ALL", "WEBSITE", "MOBILE", "PLAYER"] as const;
export const ANNOUNCEMENT_PLACEMENTS = ["HOME_CAROUSEL", "BANNER", "DASHBOARD"] as const;
export const ANNOUNCEMENT_STYLES = ["STANDARD", "HIGHLIGHT", "INFO", "WARNING"] as const;
export const ANNOUNCEMENT_KINDS = ["AD", "ANNOUNCEMENT"] as const;

export const INCIDENT_STATUSES = ["DEGRADED", "OUTAGE", "MAINTENANCE"] as const;
export const INCIDENT_COMPONENTS = ["ALL", "IPTV", "VIP", "PLAYER", "WEBSITE"] as const;

type Surface = "WEBSITE" | "PLAYER" | "MOBILE";

function isLive(
  item: { isActive: boolean; startsAt: string | null; endsAt: string | null },
  now: number,
) {
  if (!item.isActive) {
    return false;
  }

  const starts = toDate(item.startsAt)?.getTime();
  const ends = toDate(item.endsAt)?.getTime();

  return (starts === undefined || starts <= now) && (ends === undefined || ends >= now);
}

/** Live ads / announcements for one surface and placement, highest priority first. */
export async function getLiveAnnouncements(surface: Surface, placement?: string) {
  const rows = await db.orm.public.Announcement.where((item) =>
    item.target.in(["ALL", surface]),
  )
    .orderBy([(item) => item.priority.desc(), (item) => item.id.desc()])
    .all();
  const now = Date.now();

  return rows.filter(
    (item) => isLive(item, now) && (!placement || item.placement === placement),
  );
}

/**
 * One announcement if it is live on the given surface (used by the website
 * page /announcements/[id] and the mobile detail screen). Returns null once
 * it is deactivated, expired or removed, so both clients follow the same
 * lifecycle.
 */
export async function getLiveAnnouncement(id: number, surface: Surface) {
  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  const item = await db.orm.public.Announcement.first({ id });

  if (!item || !(item.target === "ALL" || item.target === surface) || !isLive(item, Date.now())) {
    return null;
  }

  return item;
}

export async function getActiveIncidents() {
  const rows = await db.orm.public.ServiceIncident.where({ isPublished: true })
    .where((item) => item.resolvedAt.isNull())
    .orderBy((item) => item.startsAt.desc())
    .all();
  const now = Date.now();

  // Scheduled maintenance that hasn't started yet is shown as upcoming.
  return rows.map((item) => ({
    ...item,
    upcoming: (toDate(item.startsAt)?.getTime() ?? 0) > now,
  }));
}

export async function getRecentResolvedIncidents(limit = 10) {
  return db.orm.public.ServiceIncident.where({ isPublished: true })
    .where((item) => item.resolvedAt.isNotNull())
    .orderBy((item) => item.resolvedAt.desc())
    .limit(limit)
    .all();
}

/** Where an announcement is in its lifecycle right now (for admin lists). */
export function announcementLifecycle(item: { isActive: boolean; startsAt: string | null; endsAt: string | null }) {
  const now = Date.now();

  if (!item.isActive) return "INACTIVE" as const;
  if ((toDate(item.startsAt)?.getTime() ?? 0) > now) return "SCHEDULED" as const;
  if (item.endsAt && (toDate(item.endsAt)?.getTime() ?? Infinity) < now) return "ENDED" as const;
  return "LIVE" as const;
}
