/**
 * Only same-site relative paths are accepted as post-login destinations
 * ("/checkout?plan=x"), never "//evil.com" or "https://…".
 */
export function safeRedirect(value: unknown, fallback = "/dashboard") {
  const text = String(value ?? "").trim();

  if (!text.startsWith("/") || text.startsWith("//") || text.startsWith("/\\")) {
    return fallback;
  }

  if (/[\u0000-\u001f]/.test(text)) {
    return fallback;
  }

  return text;
}

/**
 * Where to go after sign-in / registration. Older links pass `plan=<slug>`
 * instead of a redirect; those continue to checkout for that plan.
 */
export function postAuthDestination(params: { redirect?: unknown; plan?: unknown }) {
  const plan = String(params.plan ?? "").trim();

  if (!params.redirect && plan && /^[\w؀-ۿ-]{1,80}$/.test(plan)) {
    return `/checkout?plan=${encodeURIComponent(plan)}`;
  }

  return safeRedirect(params.redirect);
}
