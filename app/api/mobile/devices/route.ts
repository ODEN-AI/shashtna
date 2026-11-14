import { checkDeviceInput, isExpoToken } from "@/src/lib/push";
import { fail, ok, readJson, withMobileUser } from "@/src/server/mobile/http";
import { pushEnabled, registerDevice, unregisterDevice } from "@/src/server/push";

export const dynamic = "force-dynamic";

/**
 * Push-token registration (docs/push.md). The phone's Expo push token is
 * stored for the signed-in account (a token signed in elsewhere moves to
 * this account). Additive to the older contract: `deviceId` is now a number
 * and `push` says whether the owner has push on. The token is never logged.
 */
export const POST = withMobileUser(async ({ request, user }) => {
  const checked = checkDeviceInput(await readJson(request));

  if (!checked.ok) return fail(400, "INVALID", checked.error);

  const deviceId = await registerDevice(user.id, checked.value);

  return ok({ deviceId, push: (await pushEnabled()) ? "ACTIVE" : "OFF" });
});

/** Sign-out: this phone stops receiving this account's pushes. */
export const DELETE = withMobileUser(async ({ request, user }) => {
  const body = await readJson(request);

  if (isExpoToken(body.token)) await unregisterDevice(user.id, body.token);

  return ok();
});
