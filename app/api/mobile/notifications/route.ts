import { countUnreadNotifications, listNotifications } from "@/src/server/notifications";
import { shapeNotification } from "@/src/server/mobile";
import { ok, positiveInt, withMobileUser } from "@/src/server/mobile-api";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

/** The notification centre: same records as the website's notifications page. */
export const GET = withMobileUser(async ({ request, user }) => {
  const before = positiveInt(new URL(request.url).searchParams.get("before")) ?? undefined;
  const [items, unread] = await Promise.all([
    listNotifications(user.id, PAGE_SIZE + 1, before),
    countUnreadNotifications(user.id),
  ]);
  const page = items.slice(0, PAGE_SIZE);

  return ok({
    notifications: page.map((item) => shapeNotification(request, item)),
    unread,
    nextCursor: items.length > PAGE_SIZE ? page[page.length - 1].id : null,
  });
});
