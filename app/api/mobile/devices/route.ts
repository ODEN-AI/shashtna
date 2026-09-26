import { PUSH_PLATFORMS, isExpoPushToken, pickEnum } from "@/src/lib/push";
import { fail, ok, readJson, withMobileUser } from "@/src/server/mobile-api";
import { registerDevice, unregisterDevice } from "@/src/server/push";

export const dynamic = "force-dynamic";

/**
 * Registers this phone's push token for the signed-in account. Called after
 * login, on every app start and whenever the token changes.
 */
export const POST = withMobileUser(async ({ request, user }) => {
  const body = await readJson(request);
  const token = body.token;
  const platform = pickEnum(body.platform, PUSH_PLATFORMS);

  if (!isExpoPushToken(token) || !platform) {
    return fail(400, "VALIDATION", "رمز الإشعارات غير صالح.");
  }

  const device = await registerDevice(user.id, {
    token,
    platform,
    deviceName: typeof body.deviceName === "string" ? body.deviceName : null,
    appVersion: typeof body.appVersion === "string" ? body.appVersion : null,
  });

  return ok({ deviceId: device?.id ?? null });
});

/** Logout: stop sending this account's notifications to this phone. */
export const DELETE = withMobileUser(async ({ request, user }) => {
  const body = await readJson(request);

  if (typeof body.token === "string" && body.token) {
    await unregisterDevice(user.id, body.token);
  }

  return ok();
});
