import { ok, positiveInt, withMobileUser } from "@/src/server/mobile/http";
import { shapeNotification } from "@/src/server/mobile/shape";
import { countUnreadNotifications, listNotifications } from "@/src/server/notifications";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

/** The notification centre: the same records as the website's notifications page. `?before=<id>` pages back. */
export const GET = withMobileUser(async ({ request, user }) => {
  const before = positiveInt(new URL(request.url).searchParams.get("before")) ?? undefined;
  const [items, unread] = await Promise.all([listNotifications(user.id, PAGE_SIZE + 1, before), countUnreadNotifications(user.id)]);
  const page = items.slice(0, PAGE_SIZE);

  return ok({
    notifications: page.map(shapeNotification),
    unread,
    nextCursor: items.length > PAGE_SIZE ? page[page.length - 1].id : null,
  });
});
