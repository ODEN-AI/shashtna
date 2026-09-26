import { mobileContent } from "@/src/server/mobile";
import { ok, withPublic } from "@/src/server/mobile-api";

export const dynamic = "force-dynamic";

/**
 * Live offers (kind AD) and announcements (kind ANNOUNCEMENT) targeted at
 * ALL or MOBILE — the same Announcement records the website shows. Short
 * cache so admin edits and expiry reach the app within a minute.
 */
export const GET = withPublic(async ({ request }) =>
  ok(await mobileContent(request), { headers: { "Cache-Control": "public, max-age=30" } }),
);
