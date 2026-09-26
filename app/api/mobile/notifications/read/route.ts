import { countUnreadNotifications, markNotificationsRead } from "@/src/server/notifications";
import { ok, positiveInt, readJson, withMobileUser } from "@/src/server/mobile-api";

export const dynamic = "force-dynamic";

/** `{ id }` marks one notification read; `{ all: true }` marks all. */
export const POST = withMobileUser(async ({ request, user }) => {
  const body = await readJson(request);
  const id = positiveInt(body.id);

  if (id || body.all === true) {
    await markNotificationsRead(user.id, id ?? undefined);
  }

  return ok({ unread: await countUnreadNotifications(user.id) });
});
