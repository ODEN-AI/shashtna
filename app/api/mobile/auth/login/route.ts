import { attemptLogin } from "@/src/server/login-guard";
import { fail, ok, readJson, serializeMobileUser, withPublic } from "@/src/server/mobile-api";
import { issueSession } from "@/src/server/sessions";

export const dynamic = "force-dynamic";

/** Mobile sign-in: same accounts, passwords and lockout rules as the website. */
export const POST = withPublic(async ({ request }) => {
  const body = await readJson(request);
  const result = await attemptLogin(body.phone, body.password);

  if (!result.ok) {
    return fail(result.status, result.code, result.message);
  }

  const session = issueSession(result.user);

  return ok({ token: session.token, expiresAt: session.expiresAt, user: serializeMobileUser(result.user) });
});
