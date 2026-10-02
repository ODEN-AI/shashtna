import { passwordSignIn } from "@/src/server/customer-auth";
import { verifyAuthToken } from "@/src/lib/mobile-auth";
import { fail, ok, readJson, serializeMobileUser, withPublic } from "@/src/server/mobile/http";
import { issuedAfterRevocation, reissueAfter, sessionsRevokedAt } from "@/src/server/mobile/sessions";

export const dynamic = "force-dynamic";

/** App sign-in: the website's accounts, passwords, login throttle and session token. */
export const POST = withPublic(async ({ request }) => {
  const body = await readJson(request);
  const result = await passwordSignIn(body.phone, body.password, request.headers);

  if (!result.ok && result.reason === "MISSING") {
    return fail(400, "VALIDATION", "يرجى إدخال رقم الهاتف وكلمة المرور.");
  }

  if (!result.ok && result.reason === "RATE_LIMITED") {
    const minutes = Math.ceil(result.retryAfter / 60);
    return Response.json(
      { success: false, code: "RATE_LIMITED", retryAfter: result.retryAfter, message: `محاولات دخول كثيرة. حاول مرة أخرى بعد ${minutes} دقيقة.`, error: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": String(result.retryAfter), "Cache-Control": "private, no-store" } },
    );
  }

  if (!result.ok) {
    return fail(401, "INVALID_CREDENTIALS", "رقم الهاتف أو كلمة المرور غير صحيحة.");
  }

  // A sign-in in the same second as a "sign out everywhere" would get a token
  // that the revocation rule refuses: issue it in the next second instead.
  let session = result.session;
  const revokedAt = await sessionsRevokedAt(result.user.id);
  if (!issuedAfterRevocation(verifyAuthToken(session.token)?.iat ?? 0, revokedAt)) {
    session = await reissueAfter(result.user, revokedAt ?? Date.now());
  }

  return ok({ token: session.token, expiresAt: session.expiresAt, user: serializeMobileUser(result.user) });
});
