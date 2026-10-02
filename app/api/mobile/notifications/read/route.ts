import { ok, positiveInt, readJson, withMobileUser } from "@/src/server/mobile/http";
import { countUnreadNotifications, markNotificationsRead } from "@/src/server/notifications";

export const dynamic = "force-dynamic";

/** `{ id }` marks one notification read, `{ all: true }` all of them (own notifications only). */
export const POST = withMobileUser(async ({ request, user }) => {
  const body = await readJson(request);
  const id = positiveInt(body.id);

  if (id || body.all === true) {
    await markNotificationsRead(user.id, id ?? undefined);
  }

  return ok({ unread: await countUnreadNotifications(user.id) });
});
