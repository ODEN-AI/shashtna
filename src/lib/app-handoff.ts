import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * App → website sign-in handoff (chapter 2, customer app). See docs/app-handoff.md.
 *
 * The customer app shows website pages (store, checkout, points, chat,
 * tickets) inside the app. To open them already signed in, the app asks for
 * a one-time code with its Bearer session and POSTs it (never in a URL) to
 * /app/handoff, which sets the normal website session cookie.
 *
 * The code is short-lived (60 s), signed with AUTH_SECRET under its own
 * purpose prefix — so a handoff code can never be used as a session token,
 * and a session token can never be used as a handoff code.
 */

export const HANDOFF_TTL_SECONDS = 60;

const PURPOSE = "shashtna:app-handoff:v1";

type HandoffPayload = { sub: number; iat: number; exp: number; n: string };

function secret() {
  const value = String(process.env.AUTH_SECRET ?? "").trim();

  if (value.length < 32) throw new Error("AUTH_SECRET must be configured and contain at least 32 characters.");

  return value;
}

function sign(encoded: string) {
  return createHmac("sha256", secret()).update(`${PURPOSE}.${encoded}`).digest("base64url");
}

export function createHandoffCode(userId: number, now: number = Date.now()) {
  const iat = Math.floor(now / 1000);
  const payload: HandoffPayload = { sub: userId, iat, exp: iat + HANDOFF_TTL_SECONDS, n: randomBytes(9).toString("base64url") };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");

  return { code: `${encoded}.${sign(encoded)}`, expiresIn: HANDOFF_TTL_SECONDS };
}

/** The user id a valid, unexpired code was issued for; null otherwise. */
export function verifyHandoffCode(code: unknown, now: number = Date.now()): number | null {
  if (typeof code !== "string" || code.length > 400) return null;

  const [encoded, signature, extra] = code.split(".");

  if (!encoded || !signature || extra !== undefined) return null;

  const expected = Buffer.from(sign(encoded));
  const given = Buffer.from(signature);

  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Partial<HandoffPayload>;
    const seconds = Math.floor(now / 1000);

    if (!Number.isInteger(payload.sub) || (payload.sub as number) <= 0) return null;
    if (typeof payload.exp !== "number" || payload.exp < seconds) return null;
    if (typeof payload.iat !== "number" || payload.iat > seconds + 5) return null;

    return payload.sub as number;
  } catch {
    return null;
  }
}

/** Pages the app may open: the customer's own area and the store. Anything else lands on the dashboard. */
const ALLOWED = ["/dashboard", "/plans", "/checkout", "/orders", "/receipts", "/subscriptions", "/points", "/support", "/account", "/notifications", "/help", "/status"];

export function safeNext(value: unknown) {
  const raw = typeof value === "string" ? value.trim() : "";

  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\") || raw.length > 300 || /[\u0000-\u001f]/.test(raw)) return "/dashboard";

  const path = raw.split(/[?#]/)[0];

  return ALLOWED.some((prefix) => path === prefix || path.startsWith(`${prefix}/`)) ? raw : "/dashboard";
}

/** Cookie that turns on the website's app mode (no site header, footer or menus inside the app). Not a credential. */
export const APP_MODE_COOKIE = "shashtna_app";
