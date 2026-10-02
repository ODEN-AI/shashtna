import { fail, ok, positiveInt, withPublic } from "@/src/server/mobile/http";
import { liveContentItem } from "@/src/server/mobile/shape";

export const dynamic = "force-dynamic";

/** One live item; 404 once it is deactivated, ended or deleted on the website. */
export const GET = withPublic<{ id: string }>(async ({ request, params }) => {
  const id = positiveInt(params.id);
  const item = id ? await liveContentItem(request, id) : null;

  return item ? ok({ item }) : fail(404, "NOT_FOUND", "هذا الإعلان انتهى أو لم يعد متاحًا.");
});
