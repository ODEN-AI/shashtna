/**
 * Subscription credentials in admin responses. The password is never sent
 * to the browser by default: responses carry `password: null` and
 * `hasPassword`. Revealing it is a separate, audited request
 * (POST /api/admin/subscriptions/[id]/credentials).
 */
export function maskedPassword(password: string | null | undefined) {
  return { password: null, hasPassword: Boolean(password && String(password).length) };
}
