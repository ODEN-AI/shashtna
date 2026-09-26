import { db } from "@/src/prisma/db";
import { fail, ok, readJson, serializeMobileUser, withMobileUser } from "@/src/server/mobile-api";

export const dynamic = "force-dynamic";

const CONTACT_PREFERENCES = ["TELEGRAM", "WHATSAPP", "FACEBOOK", "PHONE"];

/** The signed-in account (also used to restore a session on app start). */
export const GET = withMobileUser(async ({ user }) => ok({ user }));

/** Name, contact preference and notification preferences. */
export const PATCH = withMobileUser(async ({ request, user }) => {
  const body = await readJson(request);
  const update: { name?: string; preferredContact?: string | null; renewalReminders?: boolean; marketingOptIn?: boolean } = {};

  if (body.name !== undefined) {
    const name = String(body.name ?? "").trim().slice(0, 120);

    if (name.length < 2) {
      return fail(400, "VALIDATION", "الاسم مطلوب.");
    }

    update.name = name;
  }

  if (body.preferredContact !== undefined) {
    const value = String(body.preferredContact ?? "").trim().toUpperCase();

    if (value && !CONTACT_PREFERENCES.includes(value)) {
      return fail(400, "VALIDATION", "اختيار غير صحيح.");
    }

    update.preferredContact = value || null;
  }

  if (typeof body.renewalReminders === "boolean") {
    update.renewalReminders = body.renewalReminders;
  }

  if (typeof body.marketingOptIn === "boolean") {
    update.marketingOptIn = body.marketingOptIn;
  }

  if (!Object.keys(update).length) {
    return ok({ user });
  }

  const row = await db.orm.public.User.where({ id: user.id }).update(update);

  return row ? ok({ user: serializeMobileUser(row), message: "تم الحفظ." }) : fail(500, "SERVER_ERROR", "تعذر الحفظ.");
});
