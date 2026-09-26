import { getLiveAnnouncement } from "@/src/server/content";
import { serializeAnnouncement } from "@/src/server/mobile";
import { fail, ok, positiveInt, withPublic } from "@/src/server/mobile-api";

export const dynamic = "force-dynamic";

/** 404 once the item is deactivated, expired or deleted on the website. */
export const GET = withPublic<{ id: string }>(async ({ request, params }) => {
  const item = await getLiveAnnouncement(positiveInt(params.id) ?? 0, "MOBILE");

  return item
    ? ok({ item: serializeAnnouncement(request, item) }, { headers: { "Cache-Control": "public, max-age=30" } })
    : fail(404, "NOT_FOUND", "هذا الإعلان انتهى أو لم يعد متاحًا.");
});
