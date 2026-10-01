import {
  CONTENT_GROUPS,
  ENDING_SOON_DAYS,
  matchesContent,
  matchesView,
  surfacesOf,
  type ContentGroup,
  type ContentQuery,
  type Lifecycle,
} from "@/src/lib/content-console";
import { loadSection } from "@/src/lib/dashboard-section";
import { toDate } from "@/src/lib/i18n";
import { hasPermission, type Permission } from "@/src/lib/roles";
import { db } from "@/src/prisma/db";
import { customersById } from "@/src/server/admin-data";
import { announcementLifecycle } from "@/src/server/content";

/**
 * Promotions & content console — a read layer over the existing stores:
 * Announcement (ads, offers, news, announcements; written by
 * saveAnnouncementAction) and Notification (in-app messages; written by
 * notify() / sendNotificationAction). Sections load only with their
 * permission (content for announcements and media, support for
 * notifications) and report failure separately from "empty".
 */

const FIELDS = ["id", "kind", "title", "description", "highlight", "imageUrl", "videoUrl", "mediaType", "ctaLabel", "ctaUrl", "target", "placement", "audience", "style", "priority", "isActive", "startsAt", "endsAt", "createdAt", "updatedAt"] as const;

const time = (value: unknown) => (value ? (toDate(String(value))?.getTime() ?? null) : null);

export async function loadContent() {
  const rows = await db.orm.public.Announcement.select(...FIELDS)
    .orderBy([(item) => item.priority.desc(), (item) => item.id.desc()])
    .all();

  return rows.map((row) => {
    const item = {
      ...row,
      startsAt: row.startsAt ? String(row.startsAt) : null,
      endsAt: row.endsAt ? String(row.endsAt) : null,
      createdAt: String(row.createdAt),
      updatedAt: String(row.updatedAt),
    };

    return { ...item, lifecycle: announcementLifecycle(item) as Lifecycle, surfaces: surfacesOf(item) };
  });
}

export type ContentRow = Awaited<ReturnType<typeof loadContent>>[number];

function can(role: string) {
  return (permission: Permission) => hasPermission(role, permission);
}

const DAY = 86_400_000;

// ------------------------------------------------------------------ overview

export async function getPromotionsOverview(role: string) {
  const allowed = can(role);
  const now = Date.now();

  const [content, activity, notifications] = await Promise.all([
    loadSection(allowed("content"), "PROMO_CONTENT", loadContent),
    loadSection(allowed("content"), "PROMO_ACTIVITY", async () =>
      (await db.orm.public.ActivityEvent.where({ entityType: "ANNOUNCEMENT" }).orderBy((event) => event.id.desc()).limit(6).all()).map((event) => ({
        id: event.id,
        entityId: event.entityId,
        action: event.action,
        summary: event.summary,
        createdAt: String(event.createdAt),
      })),
    ),
    loadSection(allowed("support"), "PROMO_NOTIFICATIONS", async () => {
      const since = new Date(now - 7 * DAY).toISOString();
      const [week, unread, byType, recent] = await Promise.all([
        db.orm.public.Notification.where((item) => item.createdAt.gte(since)).aggregate((a) => ({ n: a.count() })),
        db.orm.public.Notification.where((item) => item.readAt.isNull()).aggregate((a) => ({ n: a.count() })),
        db.orm.public.Notification.where((item) => item.createdAt.gte(since)).groupBy("type").aggregate((a) => ({ n: a.count() })),
        db.orm.public.Notification.select("id", "type", "title", "createdAt", "readAt").orderBy((item) => item.id.desc()).limit(5).all(),
      ]);

      return {
        week: Number(week.n),
        unread: Number(unread.n),
        byType: byType.map((row) => ({ type: String(row.type), count: Number(row.n) })).sort((a, b) => b.count - a.count),
        recent: recent.map((item) => ({ ...item, createdAt: String(item.createdAt), read: Boolean(item.readAt) })),
      };
    }),
  ]);

  const summary = content?.ok
    ? (() => {
        const rows = content.data;
        const live = rows.filter((row) => row.lifecycle === "LIVE");
        const tally = (key: (row: ContentRow) => string) => {
          const map = new Map<string, number>();
          for (const row of live) map.set(key(row), (map.get(key(row)) ?? 0) + 1);
          return [...map.entries()].sort((a, b) => b[1] - a[1]);
        };

        return {
          ok: true as const,
          counts: {
            live: live.length,
            scheduled: rows.filter((row) => row.lifecycle === "SCHEDULED").length,
            ended: rows.filter((row) => row.lifecycle === "ENDED").length,
            inactive: rows.filter((row) => row.lifecycle === "INACTIVE").length,
            ending: rows.filter((row) => matchesView("ending", row.lifecycle, time(row.endsAt), now)).length,
            offers: rows.filter((row) => (CONTENT_GROUPS.offers as readonly string[]).includes(row.kind)).length,
            announcements: rows.filter((row) => !(CONTENT_GROUPS.offers as readonly string[]).includes(row.kind)).length,
          },
          byPlacement: tally((row) => row.placement),
          byAudience: tally((row) => row.audience),
          player: live.filter((row) => row.surfaces.player).length,
          ending: rows.filter((row) => matchesView("ending", row.lifecycle, time(row.endsAt), now)).slice(0, 5).map(({ id, title, endsAt }) => ({ id, title, endsAt })),
        };
      })()
    : content === null
      ? null
      : { ok: false as const };

  return { can: allowed, content: summary, activity, notifications, endingSoonDays: ENDING_SOON_DAYS };
}

// ------------------------------------------------------------------ lists

/** Which group (offers / announcements) a kind belongs to. */
export function groupOf(kind: string): Exclude<ContentGroup, "all"> {
  return (CONTENT_GROUPS.offers as readonly string[]).includes(kind) ? "offers" : "announcements";
}

export async function listContent(group: ContentGroup, query: ContentQuery) {
  const content = await loadSection(true, "PROMO_LIST", loadContent);

  if (!content?.ok) return { ok: false as const };

  const kinds = CONTENT_GROUPS[group] as readonly string[];
  const now = Date.now();
  const inGroup = content.data.filter((row) => kinds.includes(row.kind));
  const rows = inGroup
    .filter((row) => matchesContent(query.q, row))
    .filter((row) => matchesView(query.view, row.lifecycle, time(row.endsAt), now))
    .filter((row) => query.placement === "all" || row.placement === query.placement)
    .filter((row) => query.audience === "all" || row.audience === query.audience);

  const views = { all: inGroup.length, live: 0, scheduled: 0, ended: 0, inactive: 0, ending: 0 };
  for (const row of inGroup) {
    if (row.lifecycle === "LIVE") views.live += 1;
    if (row.lifecycle === "SCHEDULED") views.scheduled += 1;
    if (row.lifecycle === "ENDED") views.ended += 1;
    if (row.lifecycle === "INACTIVE") views.inactive += 1;
    if (matchesView("ending", row.lifecycle, time(row.endsAt), now)) views.ending += 1;
  }

  return { ok: true as const, rows, views };
}

// ------------------------------------------------------------------ detail

export async function getContentItem(id: number) {
  const row = await db.orm.public.Announcement.where({ id }).first();

  if (!row) return null;

  const history = await loadSection(true, "PROMO_HISTORY", async () =>
    (await db.orm.public.ActivityEvent.where({ entityType: "ANNOUNCEMENT", entityId: String(id) }).orderBy((event) => event.id.desc()).limit(20).all()).map((event) => ({
      id: event.id,
      action: event.action,
      summary: event.summary,
      details: event.details,
      createdAt: String(event.createdAt),
    })),
  );
  const item = { ...row, startsAt: row.startsAt ? String(row.startsAt) : null, endsAt: row.endsAt ? String(row.endsAt) : null, createdAt: String(row.createdAt), updatedAt: String(row.updatedAt) };

  return { item: { ...item, lifecycle: announcementLifecycle(item) as Lifecycle, surfaces: surfacesOf(item) }, history: history ?? { ok: false as const } };
}

// ------------------------------------------------------------------ media

/** Media in use: every image / video URL referenced by an announcement, with its users. */
export async function listContentMedia() {
  const content = await loadSection(true, "PROMO_MEDIA", loadContent);

  if (!content?.ok) return { ok: false as const };

  const media = new Map<string, { url: string; type: "IMAGE" | "VIDEO"; usedBy: { id: number; title: string; lifecycle: Lifecycle; role: "image" | "poster" | "video" }[] }>();
  const add = (url: string | null, type: "IMAGE" | "VIDEO", row: ContentRow, role: "image" | "poster" | "video") => {
    if (!url) return;
    const entry = media.get(url) ?? { url, type, usedBy: [] };
    entry.usedBy.push({ id: row.id, title: row.title, lifecycle: row.lifecycle, role });
    media.set(url, entry);
  };

  for (const row of content.data) {
    const video = String(row.mediaType).toUpperCase() === "VIDEO" && row.videoUrl;
    add(row.imageUrl, "IMAGE", row, video ? "poster" : "image");
    if (video) add(row.videoUrl, "VIDEO", row, "video");
  }

  return { ok: true as const, items: [...media.values()], total: content.data.length };
}

// ------------------------------------------------------------------ notifications

export const NOTIFICATION_PAGE = 25;

/** Notifications log for support staff: newest first, SQL-paged; customer names only for the rows shown. */
export async function listNotificationsConsole(query: { q: string; type: string; page: number }) {
  return loadSection(true, "PROMO_NOTIFICATION_LIST", async () => {
    let scope = db.orm.public.Notification.where((item) => item.id.gt(0));
    if (query.q) scope = scope.where((item) => item.title.ilike(`%${query.q.replace(/[%_\\]/g, (char) => `\\${char}`)}%`));
    if (query.type !== "all") scope = scope.where({ type: query.type });

    const [total, rows, types] = await Promise.all([
      scope.aggregate((a) => ({ n: a.count() })),
      scope
        .select("id", "userId", "type", "title", "body", "link", "readAt", "createdAt")
        .orderBy((item) => item.id.desc())
        .offset((query.page - 1) * NOTIFICATION_PAGE)
        .limit(NOTIFICATION_PAGE)
        .all(),
      db.orm.public.Notification.groupBy("type").aggregate((a) => ({ n: a.count() })),
    ]);
    const customers = await customersById(rows.map((row) => row.userId));

    return {
      total: Number(total.n),
      types: types.map((row) => String(row.type)).sort(),
      rows: rows.map((row) => ({
        id: row.id,
        type: row.type,
        title: row.title,
        body: row.body,
        link: row.link,
        read: Boolean(row.readAt),
        createdAt: String(row.createdAt),
        // Name and id only — never phone numbers or account data in this log.
        customer: customers.get(row.userId) ? { id: row.userId, name: customers.get(row.userId)!.name } : { id: row.userId, name: `#${row.userId}` },
      })),
    };
  });
}
