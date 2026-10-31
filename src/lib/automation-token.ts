import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * The scheduled function proves it is ours with an HMAC of the day's run key,
 * keyed by AUTH_SECRET (no new secret to manage). A token is only good for
 * one job on one Baghdad day. netlify/functions/daily-digest.mts computes the
 * same value; keep the two in step.
 */
export function automationToken(secret: string, key: string) {
  return createHmac("sha256", secret).update(`automation:${key}`).digest("hex");
}

export function verifyAutomationToken(secret: string | undefined, key: string, token: string | null | undefined) {
  if (!secret || secret.trim().length < 32 || !token) return false;

  const expected = Buffer.from(automationToken(secret, key));
  const given = Buffer.from(token);

  return expected.length === given.length && timingSafeEqual(expected, given);
}
